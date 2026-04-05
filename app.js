'use strict';

// ══════════════════════════════════════════════════════
// CATEGORIES
// ══════════════════════════════════════════════════════
const CATS = [
  { id: 'groente',   name: 'Groente & Fruit',  icon: '🥦' },
  { id: 'zuivel',    name: 'Zuivel & Eieren',  icon: '🥛' },
  { id: 'vlees',     name: 'Vlees & Vis',      icon: '🥩' },
  { id: 'droogkast', name: 'Droogkast',        icon: '🥫' },
  { id: 'brood',     name: 'Brood & Bakkerij', icon: '🍞' },
  { id: 'diepvries', name: 'Diepvries',        icon: '❄️'  },
  { id: 'drogist',   name: 'Drogisterij',      icon: '🧴' },
  { id: 'overig',    name: 'Overig',           icon: '🛒' },
];

// ══════════════════════════════════════════════════════
// SUPERMARKT PRIJSVERGELIJKING
// Gemiddelde prijzen (€) per supermarkt, NL 2024-2025
// ══════════════════════════════════════════════════════
const SUPERMARKETS = [
  { id: 'ah',    label: 'Albert Heijn', color: '#00A0E2', offset: 1.00, live: true  },
  { id: 'jumbo', label: 'Jumbo',        color: '#FDB913', offset: 0.93, live: true  },
  { id: 'plus',  label: 'Plus',         color: '#E4202D', offset: 0.96, live: false },
  { id: 'lidl',  label: 'Lidl',         color: '#0050AA', offset: 0.80, live: false },
  { id: 'aldi',  label: 'Aldi',         color: '#1B4F9B', offset: 0.77, live: false },
  { id: 'dirk',  label: 'Dirk',         color: '#E31E24', offset: 0.82, live: false },
  { id: 'vomar', label: 'Vomar',        color: '#F58220', offset: 0.78, live: false },
];

// URL van jouw Cloudflare Worker (zie worker.js voor setup instructies)
const WORKER_URL = '';

// ══════════════════════════════════════════════════════
// FIREBASE CONFIG — vul in na aanmaken Firebase project
// Laat leeg voor lokale modus (geen sync)
// ══════════════════════════════════════════════════════
const FIREBASE_CONFIG = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};

// ══════════════════════════════════════════════════════
// EDAMAM RECEPT API — gratis op developer.edamam.com (10.000 calls/maand)
// ══════════════════════════════════════════════════════
const EDAMAM_APP_ID  = '';           // ← vul in
const EDAMAM_APP_KEY = '';           // ← vul in

const CACHE_TTL = 24 * 60 * 60 * 1000;

function getCachedPrice(sm, name) {
  try {
    const raw = localStorage.getItem(`${sm}p_${name}`);
    if (!raw) return null;
    const { price, ts } = JSON.parse(raw);
    return Date.now() - ts < CACHE_TTL ? price : null;
  } catch { return null; }
}

function setCachedPrice(sm, name, price) {
  localStorage.setItem(`${sm}p_${name}`, JSON.stringify({ price, ts: Date.now() }));
}

async function fetchLivePrice(sm, name) {
  const cached = getCachedPrice(sm, name);
  if (cached !== null) return cached;
  if (!WORKER_URL) return null;
  try {
    const res = await fetch(`${WORKER_URL}?q=${encodeURIComponent(name)}&sm=${sm}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.price) { setCachedPrice(sm, name, data.price); return data.price; }
    return null;
  } catch { return null; }
}

async function fetchLivePrices(items) {
  if (!WORKER_URL) return { ah: {}, jumbo: {} };
  const names = [...new Set(items.filter(i => !i.checked).map(i => i.name))];
  const result = { ah: {}, jumbo: {} };
  for (let i = 0; i < names.length; i += 6) {
    const batch = names.slice(i, i + 6);
    await Promise.all(batch.flatMap(name => [
      fetchLivePrice('ah',    name).then(p => { if (p) result.ah[name]    = p; }),
      fetchLivePrice('jumbo', name).then(p => { if (p) result.jumbo[name] = p; }),
    ]));
  }
  return result;
}

// keywords: lowercase woorden die in de itemnaam kunnen voorkomen
// prijzen per eenheid (stuk / 500g / 1L afhankelijk van product)
const PRICE_DB = [
  // ── Groente ──────────────────────────────────────────
  { kw:['tomaat','tomaten','kerstomaat'],          ah:2.49, jumbo:2.29, plus:2.39, lidl:1.99, aldi:1.89 },
  { kw:['komkommer'],                             ah:0.99, jumbo:0.89, plus:0.95, lidl:0.79, aldi:0.75 },
  { kw:['paprika'],                               ah:1.99, jumbo:1.79, plus:1.89, lidl:1.49, aldi:1.39 },
  { kw:['broccoli'],                              ah:1.29, jumbo:1.19, plus:1.25, lidl:0.99, aldi:0.89 },
  { kw:['bloemkool'],                             ah:1.49, jumbo:1.35, plus:1.39, lidl:1.09, aldi:0.99 },
  { kw:['spinazie'],                              ah:2.29, jumbo:2.09, plus:2.19, lidl:1.79, aldi:1.69 },
  { kw:['sla','ijsbergsla','veldsla','rucola'],   ah:1.09, jumbo:0.99, plus:1.05, lidl:0.79, aldi:0.69 },
  { kw:['champignon'],                            ah:1.79, jumbo:1.59, plus:1.69, lidl:1.29, aldi:1.19 },
  { kw:['ui','rode ui'],                          ah:1.49, jumbo:1.29, plus:1.39, lidl:0.99, aldi:0.95 },
  { kw:['knoflook'],                              ah:0.79, jumbo:0.69, plus:0.75, lidl:0.55, aldi:0.49 },
  { kw:['prei'],                                  ah:1.09, jumbo:0.99, plus:1.05, lidl:0.79, aldi:0.75 },
  { kw:['wortel','wortels'],                      ah:1.29, jumbo:1.19, plus:1.19, lidl:0.89, aldi:0.85 },
  { kw:['aardappel'],                             ah:2.49, jumbo:2.19, plus:2.29, lidl:1.79, aldi:1.69 },
  { kw:['zoete aardappel'],                       ah:1.99, jumbo:1.79, plus:1.89, lidl:1.49, aldi:1.39 },
  { kw:['courgette'],                             ah:1.29, jumbo:1.19, plus:1.25, lidl:0.99, aldi:0.89 },
  { kw:['avocado'],                               ah:1.29, jumbo:1.19, plus:1.19, lidl:0.99, aldi:0.89 },
  { kw:['boerenkool'],                            ah:1.49, jumbo:1.35, plus:1.39, lidl:1.09, aldi:0.99 },
  { kw:['sperzieboon'],                           ah:2.49, jumbo:2.19, plus:2.29, lidl:1.89, aldi:1.79 },
  // ── Fruit ────────────────────────────────────────────
  { kw:['banaan'],                                ah:1.79, jumbo:1.59, plus:1.69, lidl:1.29, aldi:1.19 },
  { kw:['appel'],                                 ah:2.49, jumbo:2.29, plus:2.39, lidl:1.99, aldi:1.89 },
  { kw:['peer'],                                  ah:2.29, jumbo:2.09, plus:2.19, lidl:1.79, aldi:1.69 },
  { kw:['sinaasappel'],                           ah:2.29, jumbo:2.09, plus:2.19, lidl:1.79, aldi:1.69 },
  { kw:['mandarijn'],                             ah:2.49, jumbo:2.29, plus:2.39, lidl:1.99, aldi:1.89 },
  { kw:['druif'],                                 ah:3.49, jumbo:3.19, plus:3.29, lidl:2.79, aldi:2.59 },
  { kw:['aardbei'],                               ah:2.99, jumbo:2.79, plus:2.89, lidl:2.49, aldi:2.29 },
  { kw:['mango'],                                 ah:1.99, jumbo:1.79, plus:1.89, lidl:1.49, aldi:1.39 },
  // ── Zuivel ───────────────────────────────────────────
  { kw:['melk','volle melk','halfvolle melk','magere melk'], ah:1.09, jumbo:0.99, plus:1.05, lidl:0.85, aldi:0.82 },
  { kw:['boter'],                                 ah:2.29, jumbo:2.09, plus:2.19, lidl:1.79, aldi:1.69 },
  { kw:['yoghurt'],                               ah:1.09, jumbo:0.99, plus:1.05, lidl:0.79, aldi:0.75 },
  { kw:['griekse yoghurt'],                       ah:1.49, jumbo:1.35, plus:1.39, lidl:1.09, aldi:0.99 },
  { kw:['kwark'],                                 ah:1.49, jumbo:1.29, plus:1.39, lidl:1.09, aldi:0.99 },
  { kw:['slagroom','room'],                       ah:1.49, jumbo:1.29, plus:1.39, lidl:1.09, aldi:0.99 },
  { kw:['karnemelk'],                             ah:0.99, jumbo:0.89, plus:0.95, lidl:0.75, aldi:0.72 },
  { kw:['kaas','gouda','belegen','jong belegen'],  ah:4.99, jumbo:4.49, plus:4.79, lidl:3.99, aldi:3.69 },
  { kw:['mozzarella'],                            ah:1.49, jumbo:1.35, plus:1.39, lidl:1.09, aldi:0.99 },
  { kw:['feta'],                                  ah:2.49, jumbo:2.29, plus:2.39, lidl:1.99, aldi:1.89 },
  { kw:['roomkaas','smeerkaas'],                  ah:1.99, jumbo:1.79, plus:1.89, lidl:1.49, aldi:1.39 },
  { kw:['eieren','ei'],                           ah:2.49, jumbo:2.29, plus:2.39, lidl:1.99, aldi:1.89 },
  // ── Vlees ────────────────────────────────────────────
  { kw:['gehakt','rundergehakt','varkensgehakt','half-om-half'], ah:4.99, jumbo:4.49, plus:4.79, lidl:3.99, aldi:3.69 },
  { kw:['kipfilet','kip','kipdrumstick','kippendij'], ah:5.99, jumbo:5.49, plus:5.79, lidl:4.99, aldi:4.69 },
  { kw:['spek'],                                  ah:2.49, jumbo:2.29, plus:2.39, lidl:1.99, aldi:1.89 },
  { kw:['ham'],                                   ah:2.79, jumbo:2.49, plus:2.69, lidl:2.19, aldi:1.99 },
  { kw:['rookworst','braadworst','worst'],         ah:2.79, jumbo:2.49, plus:2.69, lidl:2.19, aldi:1.99 },
  { kw:['hamburger'],                             ah:3.99, jumbo:3.69, plus:3.79, lidl:3.29, aldi:2.99 },
  { kw:['zalm'],                                  ah:6.99, jumbo:6.49, plus:6.79, lidl:5.99, aldi:5.49 },
  { kw:['tonijn'],                                ah:1.49, jumbo:1.29, plus:1.39, lidl:1.09, aldi:0.99 },
  { kw:['garnalen'],                              ah:5.99, jumbo:5.49, plus:5.79, lidl:4.99, aldi:4.69 },
  // ── Droogkast ─────────────────────────────────────────
  { kw:['pasta','spaghetti','penne','fusilli','tagliatelle','macaroni'], ah:1.49, jumbo:1.29, plus:1.39, lidl:0.99, aldi:0.89 },
  { kw:['rijst','basmatirijst','zilvervliesrijst'], ah:1.99, jumbo:1.79, plus:1.89, lidl:1.49, aldi:1.39 },
  { kw:['couscous','quinoa','bulgur'],            ah:2.49, jumbo:2.29, plus:2.39, lidl:1.99, aldi:1.89 },
  { kw:['bloem'],                                 ah:1.29, jumbo:1.09, plus:1.19, lidl:0.89, aldi:0.85 },
  { kw:['suiker','basterdsuiker'],                ah:1.49, jumbo:1.29, plus:1.39, lidl:1.09, aldi:0.99 },
  { kw:['olijfolie'],                             ah:4.99, jumbo:4.49, plus:4.79, lidl:3.99, aldi:3.69 },
  { kw:['zonnebloemolie','olie'],                 ah:2.99, jumbo:2.69, plus:2.89, lidl:2.29, aldi:2.09 },
  { kw:['tomatenpuree','gezeefde tomaten','tomaten blik'], ah:0.99, jumbo:0.89, plus:0.95, lidl:0.69, aldi:0.65 },
  { kw:['kokosmelk'],                             ah:1.79, jumbo:1.59, plus:1.69, lidl:1.29, aldi:1.19 },
  { kw:['bouillon'],                              ah:1.49, jumbo:1.29, plus:1.39, lidl:1.09, aldi:0.99 },
  { kw:['soep'],                                  ah:1.79, jumbo:1.59, plus:1.69, lidl:1.29, aldi:1.19 },
  { kw:['mosterd'],                               ah:1.49, jumbo:1.29, plus:1.39, lidl:1.09, aldi:0.99 },
  { kw:['mayonaise'],                             ah:2.49, jumbo:2.29, plus:2.39, lidl:1.99, aldi:1.89 },
  { kw:['ketchup'],                               ah:1.99, jumbo:1.79, plus:1.89, lidl:1.49, aldi:1.39 },
  { kw:['sambal','pesto','harissa'],              ah:2.29, jumbo:1.99, plus:2.09, lidl:1.69, aldi:1.59 },
  { kw:['pindakaas'],                             ah:2.99, jumbo:2.69, plus:2.89, lidl:2.29, aldi:2.09 },
  { kw:['jam'],                                   ah:1.99, jumbo:1.79, plus:1.89, lidl:1.49, aldi:1.39 },
  { kw:['hagelslag'],                             ah:1.99, jumbo:1.79, plus:1.89, lidl:1.59, aldi:1.49 },
  { kw:['honing'],                                ah:2.99, jumbo:2.69, plus:2.89, lidl:2.29, aldi:2.09 },
  { kw:['havermout','muesli','granola','cruesli'], ah:2.49, jumbo:2.19, plus:2.29, lidl:1.89, aldi:1.69 },
  { kw:['crackers','rijstwafels','beschuit'],     ah:1.99, jumbo:1.79, plus:1.89, lidl:1.49, aldi:1.39 },
  { kw:['chocolade','cacao'],                     ah:2.49, jumbo:2.29, plus:2.39, lidl:1.99, aldi:1.89 },
  { kw:['linzen','kikkererwt','bonen'],           ah:1.49, jumbo:1.29, plus:1.39, lidl:0.99, aldi:0.89 },
  // ── Brood ────────────────────────────────────────────
  { kw:['brood','volkoren','meergranen'],         ah:2.29, jumbo:2.09, plus:2.19, lidl:1.79, aldi:1.65 },
  { kw:['stokbrood','ciabatta','focaccia'],       ah:1.49, jumbo:1.29, plus:1.39, lidl:0.99, aldi:0.89 },
  { kw:['croissant'],                             ah:2.99, jumbo:2.69, plus:2.89, lidl:2.29, aldi:2.09 },
  { kw:['wrap','tortilla','pita','naan'],         ah:1.99, jumbo:1.79, plus:1.89, lidl:1.49, aldi:1.39 },
  // ── Drogisterij ──────────────────────────────────────
  { kw:['shampoo'],                               ah:3.99, jumbo:3.49, plus:3.79, lidl:2.49, aldi:2.29 },
  { kw:['conditioner'],                           ah:3.99, jumbo:3.49, plus:3.79, lidl:2.49, aldi:2.29 },
  { kw:['tandpasta'],                             ah:2.49, jumbo:2.29, plus:2.39, lidl:1.69, aldi:1.49 },
  { kw:['zeep','handzeep'],                       ah:2.29, jumbo:1.99, plus:2.09, lidl:1.49, aldi:1.39 },
  { kw:['deodorant'],                             ah:3.49, jumbo:3.19, plus:3.29, lidl:2.49, aldi:2.29 },
  { kw:['wasmiddel'],                             ah:9.99, jumbo:8.99, plus:9.49, lidl:6.99, aldi:6.49 },
  { kw:['afwasmiddel','vaatwas'],                 ah:2.49, jumbo:2.29, plus:2.39, lidl:1.79, aldi:1.59 },
  { kw:['wc-papier','toiletpapier'],              ah:4.99, jumbo:4.49, plus:4.79, lidl:3.49, aldi:3.29 },
  { kw:['keukenpapier'],                          ah:2.99, jumbo:2.69, plus:2.89, lidl:1.99, aldi:1.89 },
  { kw:['vuilniszak'],                            ah:2.99, jumbo:2.69, plus:2.89, lidl:1.99, aldi:1.89 },
  // ── Overig ───────────────────────────────────────────
  { kw:['koffie','espresso','filterkoffie'],      ah:4.99, jumbo:4.49, plus:4.79, lidl:3.99, aldi:3.69 },
  { kw:['thee'],                                  ah:2.49, jumbo:2.29, plus:2.39, lidl:1.79, aldi:1.59 },
  { kw:['sap','jus','sinaasappelsap','appelsap'], ah:1.99, jumbo:1.79, plus:1.89, lidl:1.49, aldi:1.39 },
  { kw:['cola','fris'],                           ah:1.89, jumbo:1.69, plus:1.79, lidl:1.29, aldi:0.99 },
  { kw:['water','spa'],                           ah:0.79, jumbo:0.69, plus:0.75, lidl:0.55, aldi:0.49 },
  { kw:['chips'],                                 ah:2.49, jumbo:2.29, plus:2.39, lidl:1.99, aldi:1.89 },
  { kw:['noten','amandel','cashew','walnoot','pinda'], ah:3.99, jumbo:3.49, plus:3.79, lidl:2.99, aldi:2.69 },
  { kw:['wijn','rode wijn','witte wijn'],         ah:6.99, jumbo:6.49, plus:6.79, lidl:5.49, aldi:4.99 },
  { kw:['bier'],                                  ah:5.99, jumbo:5.49, plus:5.79, lidl:4.49, aldi:3.99 },
];

// Match een itemnaam tegen PRICE_DB
function matchPrice(name) {
  const ln = name.toLowerCase();
  return PRICE_DB.find(e => e.kw.some(k => ln.includes(k) || k.includes(ln)));
}

// Bereken welke supermarkt het voordeligst is voor de lijst
// livePrices = { ah: {name: price}, jumbo: {name: price} }
function calcPriceAdvice(items, livePrices = { ah: {}, jumbo: {} }) {
  const totals = {};
  SUPERMARKETS.forEach(sm => { totals[sm.id] = 0; });
  let matched = 0, liveCount = 0;

  items.filter(i => !i.checked).forEach(item => {
    const liveAH    = livePrices.ah[item.name];
    const liveJumbo = livePrices.jumbo[item.name];
    const entry     = matchPrice(item.name);
    if (!liveAH && !entry) return;
    matched++;
    if (liveAH) liveCount++;

    const qty = item.unit === 'gram'
      ? Math.max(1, Math.round((item.qty || 1) / 500))
      : Math.max(1, item.qty || 1);

    const ahBase = liveAH ?? entry.ah;

    SUPERMARKETS.forEach(sm => {
      let price;
      if (sm.id === 'ah') {
        price = ahBase;
      } else if (sm.id === 'jumbo') {
        price = liveJumbo ?? (ahBase * sm.offset);
      } else if (!liveAH && entry && entry[sm.id] !== undefined) {
        price = entry[sm.id];
      } else {
        price = ahBase * sm.offset;
      }
      totals[sm.id] += price * qty;
    });
  });

  if (matched < 2) return null;
  const ranked = SUPERMARKETS
    .map(sm => ({ ...sm, total: totals[sm.id] }))
    .sort((a, b) => a.total - b.total);
  return { ranked, matched, total: items.filter(i => !i.checked).length, liveCount, isLive: liveCount > 0 };
}

// ══════════════════════════════════════════════════════
// DUTCH GROCERY VOCABULARY (voor autocomplete zonder geschiedenis)
// ══════════════════════════════════════════════════════
const VOCAB = [
  // Groente & Fruit
  'Tomaten','Komkommer','Paprika','Sla','Spinazie','Broccoli','Bloemkool','Courgette',
  'Ui','Rode ui','Knoflook','Prei','Wortel','Wortels','Aardappelen','Zoete aardappel',
  'Champignons','Avocado','Sperziebonen','Erwten','Maïs','Spruitjes','Knolselderij',
  'Rucola','IJsbergsla','Veldsla','Andijvie','Witlof','Selderij','Radijs','Biet',
  'Venkel','Asperges','Artisjok','Boerenkool','Paksoi','Gember','Jalapeño',
  'Bananen','Appels','Peren','Sinaasappels','Mandarijnen','Citroenen','Limoenen',
  'Druiven','Aardbeien','Frambozen','Blauwe bessen','Meloen','Watermeloen',
  'Mango','Ananas','Kiwi','Perziken','Nectarines','Pruimen','Abrikozen','Vijgen',
  // Zuivel
  'Melk','Volle melk','Halfvolle melk','Magere melk','Boter','Halvarine','Margarine',
  'Yoghurt','Griekse yoghurt','Kwark','Vla','Slagroom','Koffiemelk','Karnemelk',
  'Eieren','Kaas','Jong belegen kaas','Belegen kaas','Gouda','Cheddar','Brie','Camembert',
  'Mozzarella','Feta','Ricotta','Roomkaas','Smeerkaas','Parmezaan',
  // Vlees & Vis
  'Gehakt','Half-om-half gehakt','Rundergehakt','Varkensgehakt','Kipfilet','Kip',
  'Kipdrumsticks','Kippendijen','Kalkoen','Spek','Ham','Rookvlees','Salami',
  'Worst','Rookworst','Braadworst','Hamburger','Biefstuk','Rundvlees','Varkensvlees',
  'Zalm','Kabeljauw','Tilapia','Tonijn','Garnalen','Mosselen','Makreel','Haring',
  // Droogkast
  'Pasta','Spaghetti','Penne','Fusilli','Tagliatelle','Lasagnebladen','Macaroni',
  'Rijst','Basmatirijst','Zilvervliesrijst','Couscous','Quinoa','Bulgur','Linzen',
  'Kikkererwten','Bruine bonen','Witte bonen','Kidneybonen',
  'Bloem','Suiker','Basterdsuiker','Zout','Peper','Olijfolie','Zonnebloemolie',
  'Azijn','Witte wijnazijn','Balsamicoazijn','Ketjap','Sojasaus','Worcestersaus',
  'Tomatenpuree','Gezeefde tomaten','Tomaten blik','Kokosmelk','Bouillonblokjes',
  'Mosterd','Mayonaise','Ketchup','Sambal','Pesto','Harissa',
  'Havermout','Muesli','Cornflakes','Granola','Cruesli',
  'Pindakaas','Jam','Hagelslag','Appelstroop','Honing','Nutella',
  'Crackers','Rijstwafels','Beschuit','Knäckebröd',
  'Chocolade','Pure chocolade','Melkchocolade','Cacao','Vanillesuiker',
  'Soep','Tomatensoep','Groentesoep','Kippensoep',
  // Brood
  'Brood','Wit brood','Bruin brood','Volkoren brood','Meergranen brood',
  'Stokbrood','Ciabatta','Focaccia','Croissants','Bagels','Wraps','Tortilla wraps',
  'Pita brood','Naan','Roggebrood','Knip brood',
  // Diepvries
  'Diepvries spinazie','Diepvries erwten','Diepvries edamame','Diepvries groenten',
  'Diepvries frites','Diepvries pizza','Diepvries vis','Diepvries garnalen',
  'IJs','Roomijs',
  // Drogisterij
  'Shampoo','Conditioner','Tandpasta','Tandenborstel','Zeep','Handzeep',
  'Deodorant','Scheerschuim','Scheermesjes','Bodylotion','Zonnebrand',
  'Wasmiddel','Wasverzachter','Afwasmiddel','Vaatwasblokjes','Wc-papier',
  'Keukenpapier','Aluminiumfolie','Plasticfolie','Ziplocbakjes','Vuilniszakken',
  // Overig
  'Koffie','Espresso','Filterkoffie','Oploskoffie','Thee','Groene thee',
  'Sinaasappelsap','Appelsap','Jus d\'orange','Cola','Spa','Water','Mineraalwater',
  'Wijn','Rode wijn','Witte wijn','Bier',
  'Chips','Noten','Amandelen','Cashewnoten','Walnoten','Pinda\'s','Popcorn','Pretzels',
];

// ══════════════════════════════════════════════════════
// STORAGE
// ══════════════════════════════════════════════════════
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v != null ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { localStorage.setItem(k, JSON.stringify(v)); },
};

// ══════════════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════════════
let lists     = store.get('mnd_lists', []);
let baseItems = store.get('mnd_base', []);
let freq      = store.get('mnd_freq', {});
let activeId  = null;
let pending   = null; // {name, catId}

const uid = () => Math.random().toString(36).slice(2, 11);
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const activeList = () => lists.find(l => l.id === activeId) || null;

function save() {
  store.set('mnd_lists', lists);
  store.set('mnd_base', baseItems);
  store.set('mnd_freq', freq);
  if (typeof cloud !== 'undefined' && cloud.isEnabled()) cloud.push();
}

function trackFreq(name) {
  freq[name] = (freq[name] || 0) + 1;
  store.set('mnd_freq', freq);
}

// ══════════════════════════════════════════════════════
// WEEKNUMMER IN LIJSTNAAM
// ══════════════════════════════════════════════════════
function suggestListName() {
  const now = new Date();
  const weekOfMonth = Math.ceil(now.getDate() / 7);
  const maanden = ['Januari','Februari','Maart','April','Mei','Juni',
                   'Juli','Augustus','September','Oktober','November','December'];
  const maand = maanden[now.getMonth()];
  return `Week ${weekOfMonth} ${maand}`;
}

// ══════════════════════════════════════════════════════
// AUTO-CATEGORIE op basis van naam
// ══════════════════════════════════════════════════════
const CAT_RULES = [
  { cat: 'groente',   words: ['tomaat','tomaten','komkommer','paprika','sla','spinazie','broccoli','bloemkool','courgette','ui','knoflook','prei','wortel','aardappel','champignon','avocado','sperzieboon','erwt','maïs','spruitje','knolselderi','rucola','andijvie','witlof','selderi','radijs','biet','venkel','asperge','artisjok','boerenkool','paksoi','gember','jalapeño','banaan','appel','peer','sinaasappel','mandarijn','citroen','limoen','druif','aardbei','framboos','blauwe bes','meloen','watermeloen','mango','ananas','kiwi','perzik','nectarine','pruim','abrikoos','vijg','fruit','groente'] },
  { cat: 'zuivel',    words: ['melk','boter','halvarine','margarine','yoghurt','kwark','vla','slagroom','koffiemelk','karnemelk','ei','eieren','kaas','gouda','cheddar','brie','camembert','mozzarella','feta','ricotta','roomkaas','smeerkaas','parmezaan','zuivel'] },
  { cat: 'vlees',     words: ['gehakt','kipfilet','kip','kalkoen','spek','ham','rookvlees','salami','worst','rookworst','braadworst','hamburger','biefstuk','rundvlees','varkensvlees','zalm','kabeljauw','tilapia','tonijn','garnalen','mosselen','makreel','haring','vis','vlees'] },
  { cat: 'droogkast', words: ['pasta','spaghetti','penne','fusilli','tagliatelle','lasagne','macaroni','rijst','couscous','quinoa','bulgur','linzen','kikkererwt','boon','bonen','bloem','suiker','zout','peper','olijfolie','olie','azijn','ketjap','sojasaus','worcester','tomatenpuree','tomaten blik','kokosmelk','bouillon','mosterd','mayonaise','ketchup','sambal','pesto','harissa','havermout','muesli','cornflakes','granola','pindakaas','jam','hagelslag','appelstroop','honing','nutella','cracker','rijstwafel','beschuit','chocolade','cacao','soep','ingeblikt','blik'] },
  { cat: 'brood',     words: ['brood','stokbrood','ciabatta','focaccia','croissant','bagel','wrap','tortilla','pita','naan','rogge','knip'] },
  { cat: 'diepvries', words: ['diepvries','frites','ijs','roomijs','frozen'] },
  { cat: 'drogist',   words: ['shampoo','conditioner','tandpasta','tandenborstel','zeep','deodorant','scheerschuim','scheermesje','bodylotion','zonnebrand','wasmiddel','wasverzachter','afwasmiddel','vaatwas','wc-papier','keukenpapier','aluminiumfolie','plasticfolie','vuilniszak'] },
  { cat: 'overig',    words: ['koffie','espresso','thee','sap','cola','water','wijn','bier','chips','noten','amandel','cashew','walnoot','pinda','popcorn','pretzel'] },
];

function guessCat(name) {
  const lname = name.toLowerCase();
  for (const rule of CAT_RULES) {
    if (rule.words.some(w => lname.includes(w))) return rule.cat;
  }
  return 'overig';
}

function getSuggestions(q) {
  if (!q) return [];
  const lq = q.toLowerCase();

  // Merge VOCAB + freq into one scored list
  const seen = new Set();
  const results = [];

  // From frequency (personal history) — highest score boost
  Object.entries(freq).forEach(([name, count]) => {
    if (name.toLowerCase().includes(lq)) {
      seen.add(name.toLowerCase());
      results.push({ name, score: count + 100 });
    }
  });

  // From built-in vocab
  VOCAB.forEach(name => {
    if (name.toLowerCase().includes(lq) && !seen.has(name.toLowerCase())) {
      // Prefix match scores higher
      const score = name.toLowerCase().startsWith(lq) ? 10 : 1;
      results.push({ name, score });
    }
  });

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, 7);
}

// ══════════════════════════════════════════════════════
// SCREENS — simple show/hide, no transform transitions
// (avoids the overlap bug)
// ══════════════════════════════════════════════════════
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('is-active'));
  document.getElementById(id).classList.add('is-active');
}

// ══════════════════════════════════════════════════════
// SELECTS
// ══════════════════════════════════════════════════════
function fillSelect(el) {
  el.innerHTML = '<option value="">Categorie</option>';
  CATS.forEach(c => {
    const o = document.createElement('option');
    o.value = c.id;
    o.textContent = c.icon + '\u00A0' + c.name;
    el.appendChild(o);
  });
}

// ══════════════════════════════════════════════════════
// RENDER HOME
// ══════════════════════════════════════════════════════
function renderHome() {
  const cards   = document.getElementById('homeCards');
  const section = document.getElementById('homeSection');
  const empty   = document.getElementById('homeEmpty');

  if (!lists.length) {
    section.style.display = 'none';
    empty.style.display = '';
    return;
  }

  section.style.display = '';
  empty.style.display = 'none';
  cards.innerHTML = '';

  [...lists].reverse().forEach(list => {
    const total = list.items.length;
    const done  = list.items.filter(i => i.checked).length;
    const pct   = total ? Math.round(done / total * 100) : 0;
    const date  = new Date(list.createdAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });

    const card = document.createElement('div');
    card.className = 'list-card';

    // Main tappable area — opens list
    const main = document.createElement('div');
    main.className = 'list-card-main';
    main.innerHTML = `
      <div class="list-card-icon">🛒</div>
      <div class="list-card-body">
        <div class="list-card-name">${esc(list.name)}</div>
        <div class="list-card-meta">${total} items · ${date}</div>
      </div>
      <div class="list-card-pct">${pct ? pct + '%' : ''}</div>`;
    main.addEventListener('click', () => openList(list.id));

    // Delete button — separate, always visible
    const del = document.createElement('button');
    del.className = 'list-card-del';
    del.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>`;
    del.addEventListener('click', e => {
      e.stopPropagation();
      lists = lists.filter(l => l.id !== list.id);
      save();
      renderHome();
    });

    card.appendChild(main);
    card.appendChild(del);
    cards.appendChild(card);
  });
}

// ══════════════════════════════════════════════════════
// RENDER LIST
// ══════════════════════════════════════════════════════
function renderList() {
  const list = activeList();
  if (!list) return;

  document.getElementById('listLargeTitle').textContent = list.name;
  document.getElementById('listSmallTitle').textContent  = list.name;

  const total = list.items.length;
  const done  = list.items.filter(i => i.checked).length;
  document.getElementById('progressFill').style.width   = total ? (done / total * 100) + '%' : '0%';
  document.getElementById('progressLabel').textContent  = `${done} / ${total}`;

  const container = document.getElementById('listItems');
  container.innerHTML = '';

  CATS.forEach(cat => {
    const items = list.items.filter(i => i.catId === cat.id);
    if (!items.length) return;

    items.sort((a, b) => (a.checked ? 1 : 0) - (b.checked ? 1 : 0));

    const doneN = items.filter(i => i.checked).length;

    const sec = document.createElement('div');
    sec.className = 'cat-section';
    sec.innerHTML = `
      <div class="cat-header">
        <span class="cat-emoji">${cat.icon}</span>
        <span class="cat-name">${cat.name}</span>
        <span class="cat-tally">${doneN}/${items.length}</span>
      </div>
      <div class="cat-card"></div>`;

    const card = sec.querySelector('.cat-card');

    items.forEach(item => {
      const qty  = item.qty  || 1;
      const unit = item.unit || 'stuks';
      const qtyLabel = unit === 'gram' ? `${qty}g` : `${qty}×`;

      const row = document.createElement('div');
      row.className = 'item-row' + (item.checked ? ' done' : '');
      row.innerHTML = `
        <button class="check-btn ${item.checked ? 'is-checked' : ''}">
          <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5" width="12" height="12"><polyline points="20 6 9 17 4 12"/></svg>
        </button>
        <div class="item-body">
          <div class="item-name">${esc(item.name)}</div>
          ${item.fromRecipe ? `<div class="item-recipe-tag">🍳 ${esc(item.fromRecipe)}</div>` : ''}
        </div>
        <div class="item-stepper">
          <button class="step-btn step-min">−</button>
          <span class="step-val">${qtyLabel}</span>
          <button class="step-btn step-plus">+</button>
        </div>
        <button class="item-del">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>`;

      row.querySelector('.check-btn').addEventListener('click', () => {
        item.checked = !item.checked;
        save(); renderList();
      });

      row.querySelector('.step-min').addEventListener('click', () => {
        if (item.qty <= 1) return;
        item.qty = (item.qty || 1) - 1;
        save(); renderList();
      });

      row.querySelector('.step-plus').addEventListener('click', () => {
        item.qty = (item.qty || 1) + 1;
        save(); renderList();
      });

      row.querySelector('.item-del').addEventListener('click', () => {
        list.items = list.items.filter(i => i.id !== item.id);
        save(); renderList();
      });

      card.appendChild(row);
    });

    container.appendChild(sec);
  });

  // Prijsadvies onderaan
  renderPriceAdvice(list);
}

// ══════════════════════════════════════════════════════
// RENDER PRIJSADVIES — floating sticky bar + modal
// ══════════════════════════════════════════════════════
let _lastAdvice = null;

async function renderPriceAdvice(list) {
  const bar  = document.getElementById('priceBar');
  const name = document.getElementById('priceBarName');

  // Toon direct statische schatting
  const staticAdvice = calcPriceAdvice(list.items);
  _lastAdvice = staticAdvice;
  if (!staticAdvice) { bar.style.display = 'none'; return; }
  name.textContent = staticAdvice.ranked[0].label;
  bar.style.display = '';

  // Haal live prijzen op op achtergrond
  if (!WORKER_URL) return;
  const livePrices = await fetchLivePrices(list.items);
  const liveAdvice = calcPriceAdvice(list.items, livePrices);
  if (liveAdvice) {
    _lastAdvice = liveAdvice;
    name.textContent = liveAdvice.ranked[0].label + (liveAdvice.isLive ? ' ●' : '');
  }
}

function openPriceModal() {
  const advice = _lastAdvice;
  if (!advice) return;

  const best    = advice.ranked[0];
  const savings = advice.ranked[advice.ranked.length - 1].total - best.total;

  const rows = advice.ranked.map((sm, i) => `
    <div class="pm-row ${i === 0 ? 'pm-row--best' : ''}">
      <span class="pm-rank">${i === 0 ? '🏆' : i + 1}</span>
      <span class="pm-label">${esc(sm.label)}</span>
      <span class="pm-amount">€\u00A0${sm.total.toFixed(2)}${sm.live && advice.isLive ? '<small class="pm-live"> live</small>' : '<small class="pm-est"> ~</small>'}</span>
    </div>`).join('');

  document.getElementById('priceModalContent').innerHTML = `
    <div class="pm-banner">
      Meest voordelig: <strong>${esc(best.label)}</strong>
      ${savings > 0.50 ? `<br>Bespaar tot <strong>€\u00A0${savings.toFixed(2)}</strong> t.o.v. ${esc(advice.ranked[advice.ranked.length-1].label)}` : ''}
    </div>
    <div class="pm-rows">${rows}</div>
    <p class="pm-meta">${advice.matched} van ${advice.total} items herkend${advice.isLive ? ` · ${advice.liveCount} met live prijs` : ''}</p>
    <p class="pm-disclaimer">${advice.isLive
      ? 'AH &amp; Jumbo: live prijzen. Plus, Lidl, Aldi, Dirk, Vomar: schatting op basis van gemiddelden 2025.'
      : 'Gebaseerd op gemiddelde NL supermarktprijzen 2025. Actuele prijzen kunnen afwijken.'
    }</p>`;

  document.getElementById('priceModal').style.display = 'flex';
}

// ══════════════════════════════════════════════════════
// RENDER BASIS
// ══════════════════════════════════════════════════════
function renderBasis() {
  const container = document.getElementById('basisItems');
  const empty     = document.getElementById('basisEmpty');
  container.innerHTML = '';

  if (!baseItems.length) { empty.style.display = ''; return; }
  empty.style.display = 'none';

  CATS.forEach(cat => {
    const items = baseItems.filter(i => i.catId === cat.id);
    if (!items.length) return;

    items.sort((a, b) => (a.skipped ? 1 : 0) - (b.skipped ? 1 : 0));

    const sec = document.createElement('div');
    sec.className = 'cat-section';
    sec.innerHTML = `
      <div class="cat-header">
        <span class="cat-emoji">${cat.icon}</span>
        <span class="cat-name">${cat.name}</span>
      </div>
      <div class="cat-card"></div>`;

    const card = sec.querySelector('.cat-card');

    items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'item-row' + (item.skipped ? ' skipped' : '');
      row.innerHTML = `
        <button class="check-btn ${item.skipped ? 'is-skipped' : ''}" data-id="${item.id}" title="${item.skipped ? 'Activeren' : 'Overslaan deze week'}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" width="12" height="12"><polyline points="20 6 9 17 4 12"/></svg>
        </button>
        <div class="item-body">
          <div class="item-name">${esc(item.name)}</div>
        </div>
        <button class="item-del" data-id="${item.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg>
        </button>`;

      row.querySelector('.check-btn').addEventListener('click', () => toggleBaseSkip(item.id));
      row.querySelector('.item-del').addEventListener('click', () => deleteBase(item.id));
      card.appendChild(row);
    });

    container.appendChild(sec);
  });
}

// ══════════════════════════════════════════════════════
// ACTIONS
// ══════════════════════════════════════════════════════
function openList(id) {
  activeId = id;
  resetAdd();
  renderList();
  showScreen('screen-list');
  document.getElementById('listScroll').scrollTop = 0;
}

function createList(name, withBase) {
  const items = withBase
    ? baseItems.filter(b => !b.skipped).map(b => ({
        id: uid(), name: b.name, catId: b.catId,
        qty: 1, unit: 'stuks',
        checked: false, fromBase: true, baseId: b.id
      }))
    : [];
  const list = { id: uid(), name, createdAt: Date.now(), items };
  lists.push(list);
  save();
  renderHome();
  openList(list.id);
}

function toggleBaseSkip(id) {
  const item = baseItems.find(i => i.id === id);
  if (!item) return;
  item.skipped = !item.skipped;

  const list = activeList();
  if (list) {
    if (item.skipped) {
      list.items = list.items.filter(w => !(w.baseId === id && !w.checked));
    } else {
      if (!list.items.find(w => w.baseId === id)) {
        list.items.push({ id: uid(), name: item.name, catId: item.catId, qty: 1, unit: 'stuks', checked: false, fromBase: true, baseId: id });
      }
    }
  }

  save();
  renderBasis();
  if (list) renderList();
}

function deleteBase(id) {
  baseItems = baseItems.filter(i => i.id !== id);
  const list = activeList();
  if (list) list.items = list.items.filter(w => !(w.baseId === id && !w.checked));
  save();
  renderBasis();
  if (list) renderList();
}

function addBaseItem(name, catId) {
  const id = uid();
  const resolvedCat = (catId && catId !== 'overig') ? catId : guessCat(name);
  baseItems.push({ id, name, catId: resolvedCat, skipped: false });
  trackFreq(name);
  const list = activeList();
  if (list) list.items.push({ id: uid(), name, catId: catId || 'overig', qty: 1, unit: 'stuks', checked: false, fromBase: true, baseId: id });
  save();
  renderBasis();
  if (list) renderList();
}

function addWeekItem(name, catId, qty, unit) {
  const list = activeList();
  if (!list) return;
  // Auto-detect category if not specified
  const resolvedCat = (catId && catId !== 'overig') ? catId : guessCat(name);
  // Don't add duplicate (same name, unchecked)
  if (list.items.find(i => i.name.toLowerCase() === name.toLowerCase() && !i.checked)) return;
  list.items.push({ id: uid(), name, catId: resolvedCat, qty: qty || 1, unit: unit || 'stuks', checked: false, fromBase: false });
  trackFreq(name);
  save();
  renderList();
}

function newWeek() {
  const list = activeList();
  if (!list) return;
  baseItems.forEach(b => { b.skipped = false; });
  list.items = list.items.filter(i => !i.fromBase);
  list.items.forEach(i => { i.checked = false; });
  baseItems.forEach(b => {
    list.items.push({ id: uid(), name: b.name, catId: b.catId, qty: 1, unit: 'stuks', checked: false, fromBase: true, baseId: b.id });
  });
  save();
  renderBasis();
  renderList();
}

// ══════════════════════════════════════════════════════
// ADD / AUTOCOMPLETE
// ══════════════════════════════════════════════════════
function resetAdd() {
  document.getElementById('itemInput').value = '';
  document.getElementById('acDropdown').style.display = 'none';
  document.getElementById('itemInput').blur();
}

// Direct toevoegen — geen tussenstap
function quickAdd(name) {
  if (!name.trim()) return;
  addWeekItem(name.trim(), '', 1, 'stuks');
  resetAdd();
}

function renderAC(q, target = 'week') {
  const ddId = target === 'basis' ? 'acBasisDropdown' : 'acDropdown';
  const dd   = document.getElementById(ddId);
  const sugg = getSuggestions(q);
  if (!sugg.length) { dd.style.display = 'none'; return; }

  dd.innerHTML = sugg.map(s => {
    const cat = CATS.find(c => c.id === guessCat(s.name));
    const catLabel = cat ? cat.icon : '';
    return `<div class="autocomplete-item" data-name="${esc(s.name)}">
      <span class="ac-cat">${catLabel}</span>
      <span class="ac-name">${esc(s.name)}</span>
      ${s.score > 100 ? `<span class="ac-count">${s.score - 100}×</span>` : ''}
    </div>`;
  }).join('');

  dd.querySelectorAll('.autocomplete-item').forEach(el => {
    el.addEventListener('mousedown', e => e.preventDefault());
    el.addEventListener('click', () => {
      if (target === 'basis') {
        addBaseItem(el.dataset.name, '');
        document.getElementById('basisInput').value = '';
        dd.style.display = 'none';
      } else {
        quickAdd(el.dataset.name);
      }
    });
  });

  dd.style.display = '';
}

// ══════════════════════════════════════════════════════
// BOTTOM SHEET
// ══════════════════════════════════════════════════════
function openSheet() {
  renderBasis();
  const sheet = document.getElementById('basisSheet');
  sheet.classList.add('open');
}

function closeSheet() {
  document.getElementById('basisSheet').classList.remove('open');
}

// ══════════════════════════════════════════════════════
// SCROLL COMPACT NAV
// ══════════════════════════════════════════════════════
function setupCompact(scrollId, navId) {
  document.getElementById(scrollId).addEventListener('scroll', function() {
    document.getElementById(navId).classList.toggle('compact', this.scrollTop > 50);
  }, { passive: true });
}

// ══════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  // Fill category selects
  ['itemCat', 'basisCat'].forEach(id => {
    const el = document.getElementById(id);
    if (el) fillSelect(el);
  });

  setupCompact('homeScroll', 'homeNav');
  setupCompact('listScroll', 'listNav');

  // Splash → Home: crossfade dissolve
  setTimeout(() => {
    renderHome();
    const splash = document.getElementById('screen-splash');
    const home   = document.getElementById('screen-home');
    // Show home underneath first
    home.classList.add('is-active');
    // Fade splash out on top
    splash.style.transition = 'opacity 0.65s ease';
    splash.style.opacity = '0';
    splash.style.zIndex  = '5';
    setTimeout(() => {
      splash.classList.remove('is-active');
      splash.style.cssText = '';
    }, 700);
  }, 2000);

  // ── New list ────────────────────────────────────────
  document.getElementById('btnNewList').addEventListener('click', () => {
    document.getElementById('newListName').value = suggestListName();
    document.getElementById('loadBase').checked = true;
    document.getElementById('modalList').style.display = 'flex';
    setTimeout(() => document.getElementById('newListName').focus(), 80);
  });

  document.getElementById('btnListCancel').addEventListener('click', () => {
    document.getElementById('modalList').style.display = 'none';
  });

  document.getElementById('btnListConfirm').addEventListener('click', () => {
    const name = document.getElementById('newListName').value.trim() || 'Lijst';
    const wb   = document.getElementById('loadBase').checked;
    document.getElementById('modalList').style.display = 'none';
    createList(name, wb);
  });

  document.getElementById('newListName').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btnListConfirm').click();
  });

  document.getElementById('modalList').addEventListener('click', e => {
    if (e.target === e.currentTarget) e.currentTarget.style.display = 'none';
  });

  // ── Back ─────────────────────────────────────────────
  document.getElementById('btnBack').addEventListener('click', () => {
    resetAdd();
    renderHome();
    showScreen('screen-home');
    activeId = null;
  });

  // ── Autocomplete ─────────────────────────────────────
  const itemInput = document.getElementById('itemInput');

  itemInput.addEventListener('input', () => renderAC(itemInput.value.trim()));

  itemInput.addEventListener('blur', () => {
    setTimeout(() => { document.getElementById('acDropdown').style.display = 'none'; }, 150);
  });

  itemInput.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    quickAdd(itemInput.value.trim());
  });

  document.getElementById('btnAddItem').addEventListener('click', () => {
    quickAdd(itemInput.value.trim());
  });

  // ── New week ─────────────────────────────────────────
  document.getElementById('btnNewWeek').addEventListener('click', () => {
    document.getElementById('modalWeek').style.display = 'flex';
  });
  document.getElementById('btnWeekCancel').addEventListener('click', () => {
    document.getElementById('modalWeek').style.display = 'none';
  });
  document.getElementById('btnWeekConfirm').addEventListener('click', () => {
    document.getElementById('modalWeek').style.display = 'none';
    newWeek();
  });
  document.getElementById('modalWeek').addEventListener('click', e => {
    if (e.target === e.currentTarget) e.currentTarget.style.display = 'none';
  });

  // ── Basis sheet ──────────────────────────────────────
  document.getElementById('btnBasisFromHome').addEventListener('click', openSheet);
  document.getElementById('btnBasisFromList').addEventListener('click', openSheet);
  document.getElementById('btnBasisClose').addEventListener('click', closeSheet);
  document.getElementById('sheetBackdrop').addEventListener('click', closeSheet);

  document.getElementById('btnBasisAdd').addEventListener('click', () => {
    const name = document.getElementById('basisInput').value.trim();
    if (!name) { document.getElementById('basisInput').focus(); return; }
    addBaseItem(name, '');   // categorie wordt auto-gedetecteerd
    document.getElementById('basisInput').value = '';
    document.getElementById('acBasisDropdown').style.display = 'none';
    document.getElementById('basisInput').focus();
  });

  document.getElementById('basisInput').addEventListener('input', () => {
    renderAC(document.getElementById('basisInput').value.trim(), 'basis');
  });

  document.getElementById('basisInput').addEventListener('blur', () => {
    setTimeout(() => { document.getElementById('acBasisDropdown').style.display = 'none'; }, 150);
  });

  // ── Prijsbalk + modal ─────────────────────────────────
  document.getElementById('btnPriceBar').addEventListener('click', openPriceModal);
  document.getElementById('btnPriceClose').addEventListener('click', () => {
    document.getElementById('priceModal').style.display = 'none';
  });
  document.getElementById('priceModal').addEventListener('click', e => {
    if (e.target === e.currentTarget) e.currentTarget.style.display = 'none';
  });

  // ── Recept sheet ──────────────────────────────────────
  document.getElementById('btnOpenRecipe').addEventListener('click', () => {
    if (!activeId) {
      document.getElementById('recipeContent').innerHTML =
        '<p class="recipe-hint">Open eerst een lijst om recepten toe te voegen.</p>';
    }
    openRecipeSheet();
  });
  document.getElementById('btnRecipeClose').addEventListener('click', closeRecipeSheet);
  document.getElementById('recipeBackdrop').addEventListener('click', closeRecipeSheet);
  document.getElementById('btnRecipeSearch').addEventListener('click', () => {
    searchRecipes(document.getElementById('recipeInput').value.trim());
  });
  document.getElementById('recipeInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') searchRecipes(document.getElementById('recipeInput').value.trim());
  });

  // ── Sync modal ────────────────────────────────────────
  document.getElementById('btnSync').addEventListener('click', () => {
    const sc = document.getElementById('syncContent');
    if (!FIREBASE_CONFIG.apiKey) {
      sc.innerHTML = `
        <p style="font-size:.9rem;color:var(--t2);margin-bottom:12px;">
          Firebase is niet geconfigureerd. Stel <code>FIREBASE_CONFIG</code> in app.js in om synchronisatie tussen apparaten te gebruiken.
        </p>
        <ol style="font-size:.85rem;color:var(--t2);line-height:1.7;padding-left:18px;">
          <li>Maak een gratis project aan op <strong>firebase.google.com</strong></li>
          <li>Voeg een web-app toe en kopieer de config</li>
          <li>Plak de waarden in <code>FIREBASE_CONFIG</code> in app.js</li>
          <li>Activeer Firestore in je Firebase project</li>
        </ol>`;
    } else {
      const code = cloud.getCode() || '—';
      sc.innerHTML = `
        <p style="font-size:.9rem;color:var(--t2);margin-bottom:12px;">Deel deze code met je huisgenoten om dezelfde lijsten te delen:</p>
        <div style="text-align:center;font-size:2rem;font-weight:800;letter-spacing:4px;margin:16px 0;color:var(--t1);">${esc(code)}</div>
        <p style="font-size:.85rem;color:var(--t2);margin-bottom:8px;">Of voer een bestaande code in:</p>
        <div style="display:flex;gap:8px;margin-bottom:4px;">
          <input id="joinCodeInput" class="modal-input" style="margin:0;flex:1;height:44px;font-size:1rem;" type="text" placeholder="Bijv. ABC123" maxlength="6" autocomplete="off" autocorrect="off" spellcheck="false">
          <button class="btn-primary" style="flex-shrink:0;height:44px;padding:0 16px;" id="btnJoinHousehold">Deelnemen</button>
        </div>
        <div id="joinError" style="font-size:.8rem;color:var(--red);min-height:18px;"></div>`;
      setTimeout(() => {
        const joinBtn = document.getElementById('btnJoinHousehold');
        if (joinBtn) {
          joinBtn.addEventListener('click', async () => {
            const codeVal = (document.getElementById('joinCodeInput').value || '').trim().toUpperCase();
            if (codeVal.length !== 6) {
              document.getElementById('joinError').textContent = 'Code moet 6 tekens zijn.';
              return;
            }
            joinBtn.disabled = true;
            joinBtn.textContent = 'Laden…';
            try {
              await cloud.joinHousehold(codeVal);
              document.getElementById('modalSync').style.display = 'none';
            } catch (err) {
              document.getElementById('joinError').textContent = err.message;
              joinBtn.disabled = false;
              joinBtn.textContent = 'Deelnemen';
            }
          });
        }
      }, 50);
    }
    document.getElementById('modalSync').style.display = 'flex';
  });
  document.getElementById('btnSyncClose').addEventListener('click', () => {
    document.getElementById('modalSync').style.display = 'none';
  });
  document.getElementById('modalSync').addEventListener('click', e => {
    if (e.target === e.currentTarget) e.currentTarget.style.display = 'none';
  });

  // ── Firebase cloud init ───────────────────────────────
  cloud.init().then(() => renderHome());
});

// ══════════════════════════════════════════════════════
// EN → NL INGREDIENT VERTALING (60+ entries)
// ══════════════════════════════════════════════════════
const EN_NL = {
  // Vegetables
  'tomato': 'tomaat', 'tomatoes': 'tomaten', 'cherry tomatoes': 'kerstomaten',
  'cucumber': 'komkommer', 'bell pepper': 'paprika', 'red bell pepper': 'rode paprika',
  'green bell pepper': 'groene paprika', 'yellow bell pepper': 'gele paprika',
  'onion': 'ui', 'onions': 'uien', 'red onion': 'rode ui', 'garlic': 'knoflook',
  'garlic cloves': 'knoflookteentjes', 'broccoli': 'broccoli', 'spinach': 'spinazie',
  'lettuce': 'sla', 'carrot': 'wortel', 'carrots': 'wortels',
  'potato': 'aardappel', 'potatoes': 'aardappelen', 'sweet potato': 'zoete aardappel',
  'mushroom': 'champignon', 'mushrooms': 'champignons', 'zucchini': 'courgette',
  'courgette': 'courgette', 'cauliflower': 'bloemkool', 'leek': 'prei',
  'celery': 'selderij', 'avocado': 'avocado', 'corn': 'maïs',
  'peas': 'erwten', 'green beans': 'sperziebonen', 'asparagus': 'asperges',
  'kale': 'boerenkool', 'cabbage': 'kool', 'red cabbage': 'rode kool',
  'ginger': 'gember', 'chili': 'chili', 'jalapeno': 'jalapeño',
  'spring onion': 'bosui', 'scallion': 'bosui',
  // Fruit
  'apple': 'appel', 'apples': 'appels', 'banana': 'banaan', 'bananas': 'bananen',
  'lemon': 'citroen', 'lemons': 'citroenen', 'lime': 'limoen',
  'orange': 'sinaasappel', 'strawberry': 'aardbei', 'strawberries': 'aardbeien',
  'mango': 'mango', 'pineapple': 'ananas', 'grapes': 'druiven',
  // Dairy & eggs
  'milk': 'melk', 'butter': 'boter', 'cream': 'room', 'heavy cream': 'slagroom',
  'sour cream': 'zure room', 'yogurt': 'yoghurt', 'cheese': 'kaas',
  'parmesan': 'parmezaan', 'mozzarella': 'mozzarella', 'feta': 'feta',
  'cheddar': 'cheddar', 'cream cheese': 'roomkaas', 'ricotta': 'ricotta',
  'eggs': 'eieren', 'egg': 'ei',
  // Meat & fish
  'chicken': 'kip', 'chicken breast': 'kipfilet', 'chicken thighs': 'kippendijen',
  'ground beef': 'rundergehakt', 'beef': 'rundvlees', 'pork': 'varkensvlees',
  'bacon': 'spek', 'ham': 'ham', 'salmon': 'zalm', 'tuna': 'tonijn',
  'shrimp': 'garnalen', 'prawns': 'garnalen', 'cod': 'kabeljauw',
  'turkey': 'kalkoen', 'sausage': 'worst', 'minced meat': 'gehakt',
  // Dry goods
  'pasta': 'pasta', 'spaghetti': 'spaghetti', 'rice': 'rijst',
  'flour': 'bloem', 'sugar': 'suiker', 'salt': 'zout', 'pepper': 'peper',
  'olive oil': 'olijfolie', 'vegetable oil': 'zonnebloemolie',
  'tomato paste': 'tomatenpuree', 'tomato sauce': 'tomatensaus',
  'canned tomatoes': 'tomaten blik', 'coconut milk': 'kokosmelk',
  'broth': 'bouillon', 'chicken broth': 'kippenbouillon', 'beef broth': 'runderbouillon',
  'soy sauce': 'sojasaus', 'mustard': 'mosterd', 'mayonnaise': 'mayonaise',
  'ketchup': 'ketchup', 'honey': 'honing', 'peanut butter': 'pindakaas',
  'vinegar': 'azijn', 'lentils': 'linzen', 'chickpeas': 'kikkererwten',
  'black beans': 'zwarte bonen', 'bread': 'brood', 'oats': 'havermout',
  'quinoa': 'quinoa', 'couscous': 'couscous', 'breadcrumbs': 'paneermeel',
  // Herbs & spices
  'basil': 'basilicum', 'oregano': 'oregano', 'thyme': 'tijm',
  'rosemary': 'rozemarijn', 'parsley': 'peterselie', 'cilantro': 'koriander',
  'cumin': 'komijn', 'paprika powder': 'paprikapoeder', 'turmeric': 'kurkuma',
  'cinnamon': 'kaneel', 'bay leaf': 'laurierblad', 'bay leaves': 'laurierblaadjes',
  'nutmeg': 'nootmuskaat', 'chili powder': 'chilipoeier',
  // Other
  'water': 'water', 'stock': 'bouillon', 'wine': 'wijn', 'red wine': 'rode wijn',
  'white wine': 'witte wijn', 'lemon juice': 'citroensap', 'lime juice': 'limoensap',
  'chocolate': 'chocolade', 'vanilla': 'vanille', 'baking powder': 'bakpoeder',
  'baking soda': 'baking soda', 'yeast': 'gist', 'tofu': 'tofu',
};

function translateIngredient(name) {
  const lower = name.toLowerCase().trim();
  if (EN_NL[lower]) return EN_NL[lower];
  // Try partial match
  for (const [en, nl] of Object.entries(EN_NL)) {
    if (lower.includes(en)) return nl;
  }
  return name; // return original if no translation found
}

function parseIngredient(ing) {
  const raw = ing.original || ing.name || '';
  const name = translateIngredient(ing.name || raw);
  const qty = ing.amount || 1;
  const unit = ing.unit || 'stuks';
  const catId = guessCat(name);
  return { name, qty, unit, catId };
}

// ══════════════════════════════════════════════════════
// FIREBASE CLOUD SYNC MODULE
// Gebruikt anonieme auth + members-array voor beveiliging
// ══════════════════════════════════════════════════════
const cloud = (() => {
  let db = null, auth = null, user = null;
  let householdId = null, unsubscribe = null, enabled = false;

  function genCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // geen 0/O/1/I (verwarring)
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }

  function listenToHousehold(id) {
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    unsubscribe = db.collection('households').doc(id).onSnapshot(snap => {
      if (!snap.exists || snap.metadata.hasPendingWrites) return;
      const data = snap.data();
      if (data.lists)     { lists     = data.lists;     store.set('mnd_lists', lists); }
      if (data.baseItems) { baseItems = data.baseItems; store.set('mnd_base', baseItems); }
      if (data.freq)      { freq      = data.freq;      store.set('mnd_freq', freq); }
      renderHome();
      if (activeId) renderList();
    });
  }

  async function init() {
    if (!FIREBASE_CONFIG.apiKey) return;
    try {
      if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      db   = firebase.firestore();
      auth = firebase.auth();

      // Anoniem inloggen (persistent, zelfde UID bij heropenen)
      auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      const cred = await auth.signInAnonymously();
      user    = cred.user;
      enabled = true;

      householdId = localStorage.getItem('mnd_household');
      if (!householdId) {
        householdId = genCode();
        localStorage.setItem('mnd_household', householdId);
        // Maak huishoud-document aan met eigen UID als eerste lid
        await db.collection('households').doc(householdId).set({
          lists, baseItems, freq,
          members: [user.uid],
          createdAt: Date.now(),
        });
      }
      listenToHousehold(householdId);
    } catch (e) {
      console.warn('Firebase init failed:', e);
      enabled = false;
    }
  }

  async function push() {
    if (!enabled || !db || !householdId) return;
    try {
      // update() preserveert het members-veld (geen set() met merge om UID-verlies te voorkomen)
      await db.collection('households').doc(householdId).update({
        lists, baseItems, freq, updatedAt: Date.now(),
      });
    } catch (e) { console.warn('cloud.push failed:', e); }
  }

  async function joinHousehold(code) {
    if (!enabled || !db) throw new Error('Firebase niet geconfigureerd');
    if (!user) throw new Error('Niet ingelogd');
    const snap = await db.collection('households').doc(code).get();
    if (!snap.exists) throw new Error('Code niet gevonden: ' + code);
    const data = snap.data();

    // Voeg eigen UID toe aan members zodat security rules schrijven toestaan
    if (!data.members?.includes(user.uid)) {
      await db.collection('households').doc(code).update({
        members: firebase.firestore.FieldValue.arrayUnion(user.uid),
      });
    }

    if (data.lists)     { lists     = data.lists;     store.set('mnd_lists', lists); }
    if (data.baseItems) { baseItems = data.baseItems; store.set('mnd_base', baseItems); }
    if (data.freq)      { freq      = data.freq;      store.set('mnd_freq', freq); }
    householdId = code;
    localStorage.setItem('mnd_household', code);
    listenToHousehold(code);
    renderHome();
    if (activeId) renderList();
  }

  function getCode()    { return householdId; }
  function isEnabled()  { return enabled; }

  return { init, push, joinHousehold, getCode, isEnabled };
})();

// ══════════════════════════════════════════════════════
// EDAMAM RECEPT FUNCTIES
// ══════════════════════════════════════════════════════

function openRecipeSheet() {
  document.getElementById('recipeSheet').classList.add('open');
  document.getElementById('recipeInput').value = '';
  document.getElementById('recipeContent').innerHTML = (EDAMAM_APP_ID && EDAMAM_APP_KEY)
    ? '<p class="recipe-hint">Zoek een gerecht om ingrediënten automatisch aan je lijst toe te voegen.</p>'
    : '<p class="recipe-hint">Stel <code>EDAMAM_APP_ID</code> en <code>EDAMAM_APP_KEY</code> in app.js in om recepten te zoeken.</p>';
}

function closeRecipeSheet() {
  document.getElementById('recipeSheet').classList.remove('open');
}

function renderRecipeLoading() {
  document.getElementById('recipeContent').innerHTML = '<div class="recipe-loading">Laden…</div>';
}

// Normaliseer Edamam hit naar intern formaat
function normalizeEdamam(hit) {
  const r = hit.recipe;
  return {
    title:          r.label,
    image:          r.image,
    readyInMinutes: r.totalTime || null,
    extendedIngredients: (r.ingredients || []).map(ing => ({
      name:     ing.food || ing.text,
      amount:   ing.quantity || ing.weight || 1,
      unit:     ing.measure || '',
      measures: { metric: { amount: ing.weight || ing.quantity || 1, unitShort: 'g' } },
    })),
  };
}

async function searchRecipes(query) {
  if (!EDAMAM_APP_ID || !EDAMAM_APP_KEY || !query.trim()) return;
  renderRecipeLoading();
  try {
    const res = await fetch(
      `https://api.edamam.com/api/recipes/v2?type=public&q=${encodeURIComponent(query)}&app_id=${EDAMAM_APP_ID}&app_key=${EDAMAM_APP_KEY}&field=label&field=image&field=totalTime&field=ingredients`
    );
    if (!res.ok) throw new Error('Edamam ' + res.status);
    const data  = await res.json();
    const hits  = (data.hits || []).map(normalizeEdamam);
    if (hits.length) renderRecipeResults(hits);
    else document.getElementById('recipeContent').innerHTML =
      '<p class="recipe-hint">Geen recepten gevonden. Probeer een andere zoekterm.</p>';
  } catch (e) {
    document.getElementById('recipeContent').innerHTML =
      `<p class="recipe-hint" style="color:var(--red)">Fout bij laden: ${esc(e.message)}</p>`;
  }
}

function renderRecipeResults(recipes) {
  const rc = document.getElementById('recipeContent');
  if (!recipes.length) {
    rc.innerHTML = '<p class="recipe-hint">Geen recepten gevonden. Probeer een andere zoekterm.</p>';
    return;
  }
  rc.innerHTML = recipes.map(r => {
    const ingCount = (r.extendedIngredients || []).length || r.usedIngredientCount || '?';
    const thumb = r.image
      ? `<img class="recipe-thumb" src="${esc(r.image)}" alt="" loading="lazy">`
      : `<div class="recipe-thumb recipe-thumb--empty">🍽️</div>`;
    return `<div class="recipe-card" data-id="${r.id}">
      ${thumb}
      <div class="recipe-card-body">
        <div class="recipe-title">${esc(r.title)}</div>
        <div class="recipe-meta">${ingCount} ingrediënten</div>
      </div>
      <svg class="recipe-arrow" viewBox="0 0 12 20" fill="none" stroke="currentColor" stroke-width="2.5" width="6" height="10"><polyline points="2 18 10 10 2 2"/></svg>
    </div>`;
  }).join('');

  rc.querySelectorAll('.recipe-card').forEach((el, i) => {
    el.addEventListener('click', () => renderRecipeDetail(recipes[i]));
  });
}

function renderRecipeDetail(recipe) {
  const rc = document.getElementById('recipeContent');
  const ings = (recipe.extendedIngredients || []).map(ing => {
    const p = parseIngredient(ing);
    const qtyStr = p.unit && p.unit !== 'stuks' ? `${p.qty} ${esc(p.unit)}` : `${p.qty}×`;
    return `<div class="recipe-ing-row"><span class="recipe-ing-qty">${qtyStr}</span><span class="recipe-ing-name">${esc(p.name)}</span></div>`;
  }).join('');

  rc.innerHTML = `
    <button class="recipe-back-btn" id="btnRecipeBack">← Terug</button>
    <div class="recipe-detail-title">${esc(recipe.title)}</div>
    <div class="recipe-ing-list">${ings || '<p class="recipe-hint">Geen ingrediënten beschikbaar.</p>'}</div>
    <button class="recipe-add-all-btn" id="btnAddAllIngredients">Voeg toe aan lijst</button>`;

  document.getElementById('btnRecipeBack').addEventListener('click', () => {
    rc.innerHTML = '<p class="recipe-hint">Zoek een gerecht om ingrediënten automatisch aan je lijst toe te voegen.</p>';
  });

  document.getElementById('btnAddAllIngredients').addEventListener('click', () => {
    addRecipeItems(recipe);
    closeRecipeSheet();
  });
}

function addRecipeItems(recipe) {
  const list = activeList();
  if (!list) { alert('Open eerst een lijst.'); return; }
  (recipe.extendedIngredients || []).forEach(ing => {
    const p = parseIngredient(ing);
    if (!p.name.trim()) return;
    // Avoid exact duplicates
    if (list.items.find(i => i.name.toLowerCase() === p.name.toLowerCase() && !i.checked)) return;
    list.items.push({
      id: uid(),
      name: p.name,
      catId: p.catId,
      qty: Math.max(1, Math.round(p.qty)) || 1,
      unit: p.unit || 'stuks',
      checked: false,
      fromBase: false,
      fromRecipe: recipe.title,
    });
  });
  save();
  renderList();
}

// Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
