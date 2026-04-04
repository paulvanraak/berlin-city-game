/**
 * MANDJE — Cloudflare Worker: Albert Heijn + Jumbo prijzen proxy
 *
 * SETUP (eenmalig, ~5 minuten):
 * 1. Ga naar https://dash.cloudflare.com → Workers & Pages → Create
 * 2. Klik "Create Worker" → geef het een naam (bijv. "mandje-prices")
 * 3. Vervang de inhoud met deze hele file
 * 4. Klik "Deploy"
 * 5. Kopieer de worker URL (bijv. https://mandje-prices.jouwnaam.workers.dev)
 * 6. Plak die URL in app.js bij: const WORKER_URL = '...'
 *
 * Gebruik:
 *   ?q=melk         → AH prijs (standaard)
 *   ?q=melk&sm=ah   → AH prijs
 *   ?q=melk&sm=jumbo → Jumbo prijs
 */

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
        },
      });
    }

    const url   = new URL(request.url);
    const query = url.searchParams.get('q');
    const sm    = url.searchParams.get('sm') || 'ah';
    if (!query) return json({ error: 'no query' }, 400);

    try {
      if (sm === 'jumbo') return await fetchJumbo(query);
      return await fetchAH(query);
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  },
};

// ── Albert Heijn ────────────────────────────────────────────────────────────

async function fetchAH(query) {
  const tokenRes = await fetch(
    'https://api.ah.nl/mobile-auth/v1/auth/token/anonymous',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: 'appie-android' }),
    }
  );
  if (!tokenRes.ok) return json({ price: null, reason: 'token_failed' });
  const { access_token } = await tokenRes.json();

  const searchRes = await fetch(
    `https://api.ah.nl/mobile-services/product/search/v2?query=${encodeURIComponent(query)}&page=0&size=5`,
    {
      headers: {
        Authorization: `Bearer ${access_token}`,
        'x-client-name': 'appie-android',
        'x-client-version': '8.22.3',
      },
    }
  );
  if (!searchRes.ok) return json({ price: null, reason: 'search_failed' });
  const data = await searchRes.json();

  const products = data.products || [];
  if (!products.length) return json({ price: null, reason: 'not_found' });

  const prices = products
    .slice(0, 3)
    .map(p => p.priceBeforeBonus ?? p.currentPrice?.now ?? null)
    .filter(p => p !== null && p > 0);

  if (!prices.length) return json({ price: null, reason: 'no_price' });
  return json({
    price:   Math.min(...prices),
    product: products[0].description ?? query,
    unit:    products[0].unitSize ?? '',
  });
}

// ── Jumbo ───────────────────────────────────────────────────────────────────

async function fetchJumbo(query) {
  const searchRes = await fetch(
    `https://mobileapi.jumbo.com/v17/search?q=${encodeURIComponent(query)}&offset=0&limit=5`,
    {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent':   'Jumbo/8.0 Android',
      },
    }
  );
  if (!searchRes.ok) return json({ price: null, reason: 'search_failed' });
  const data = await searchRes.json();

  const products = data.products?.data || [];
  if (!products.length) return json({ price: null, reason: 'not_found' });

  const prices = products
    .slice(0, 3)
    .map(p => {
      const pd = p.product?.data;
      if (!pd) return null;
      // Bedragen zijn in centen
      const promo   = pd.prices?.promotionalPrice?.amount;
      const regular = pd.prices?.price?.amount;
      const raw     = promo ?? regular ?? null;
      return raw !== null ? raw / 100 : null;
    })
    .filter(p => p !== null && p > 0);

  if (!prices.length) return json({ price: null, reason: 'no_price' });
  const pd = products[0].product?.data;
  return json({
    price:   Math.min(...prices),
    product: pd?.title ?? query,
    unit:    pd?.quantity ?? '',
  });
}

// ── Hulpfunctie ─────────────────────────────────────────────────────────────

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
