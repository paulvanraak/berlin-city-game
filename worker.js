/**
 * MANDJE — Cloudflare Worker: Albert Heijn prijzen proxy
 *
 * SETUP (eenmalig, ~5 minuten):
 * 1. Ga naar https://dash.cloudflare.com → Workers & Pages → Create
 * 2. Klik "Create Worker" → geef het een naam (bijv. "mandje-prices")
 * 3. Vervang de inhoud met deze hele file
 * 4. Klik "Deploy"
 * 5. Kopieer de worker URL (bijv. https://mandje-prices.jouwnaam.workers.dev)
 * 6. Plak die URL in app.js bij: const WORKER_URL = '...'
 */

export default {
  async fetch(request) {
    // CORS preflight
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
    if (!query) return json({ error: 'no query' }, 400);

    try {
      // Stap 1: Haal anoniem AH token op
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

      // Stap 2: Zoek product
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

      // Pak de laagste niet-null prijs van de eerste 3 resultaten
      const prices = products
        .slice(0, 3)
        .map(p => p.priceBeforeBonus ?? p.currentPrice?.now ?? null)
        .filter(p => p !== null && p > 0);

      if (!prices.length) return json({ price: null, reason: 'no_price' });

      const price = Math.min(...prices);
      return json({
        price,
        product: products[0].description ?? query,
        unit:    products[0].unitSize ?? '',
      });
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  },
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
