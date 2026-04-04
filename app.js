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
}

function trackFreq(name) {
  freq[name] = (freq[name] || 0) + 1;
  store.set('mnd_freq', freq);
}

function getSuggestions(q) {
  if (!q) return [];
  const lq = q.toLowerCase();
  return Object.entries(freq)
    .filter(([n]) => n.toLowerCase().includes(lq))
    .sort(([,a],[,b]) => b - a)
    .map(([n, c]) => ({ name: n, count: c }))
    .slice(0, 6);
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
    card.dataset.id = list.id;
    card.innerHTML = `
      <div class="list-card-icon">🛒</div>
      <div class="list-card-body">
        <div class="list-card-name">${esc(list.name)}</div>
        <div class="list-card-meta">${total} items · ${date}</div>
      </div>
      <div class="list-card-pct">${pct}%</div>
      <button class="list-card-del" data-id="${list.id}">Verwijder</button>`;

    // Long press reveals delete
    let timer;
    card.addEventListener('touchstart', () => { timer = setTimeout(() => card.classList.toggle('reveal-del'), 500); }, { passive: true });
    card.addEventListener('touchend', () => clearTimeout(timer), { passive: true });
    card.addEventListener('touchmove', () => clearTimeout(timer), { passive: true });

    card.querySelector('.list-card-del').addEventListener('click', e => {
      e.stopPropagation();
      lists = lists.filter(l => l.id !== list.id);
      save();
      renderHome();
    });

    card.addEventListener('click', e => {
      if (e.target.closest('.list-card-del')) return;
      card.classList.remove('reveal-del');
      openList(list.id);
    });

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
      const qtyStr = item.unit === 'gram'
        ? `${item.qty || 1} gram`
        : (item.qty && item.qty > 1) ? `${item.qty} stuks` : '';

      const row = document.createElement('div');
      row.className = 'item-row' + (item.checked ? ' done' : '');
      row.innerHTML = `
        <button class="check-btn ${item.checked ? 'is-checked' : ''}" data-id="${item.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5" width="12" height="12"><polyline points="20 6 9 17 4 12"/></svg>
        </button>
        <div class="item-body">
          <div class="item-name">${esc(item.name)}</div>
          ${qtyStr ? `<div class="item-qty">${qtyStr}</div>` : ''}
        </div>
        ${item.fromBase ? '<span class="basis-tag">basis</span>' : ''}
        <button class="item-del" data-id="${item.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg>
        </button>`;

      row.querySelector('.check-btn').addEventListener('click', () => {
        item.checked = !item.checked;
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
  baseItems.push({ id, name, catId: catId || 'overig', skipped: false });
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
  list.items.push({ id: uid(), name, catId: catId || 'overig', qty, unit, checked: false, fromBase: false });
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
// ADD / AUTOCOMPLETE / QTY
// ══════════════════════════════════════════════════════
function resetAdd() {
  pending = null;
  document.getElementById('itemInput').value = '';
  document.getElementById('qtyStage').style.display = 'none';
  document.getElementById('acDropdown').style.display = 'none';
  document.getElementById('qtyVal').value = 1;
  document.getElementById('btnStuks').classList.add('active');
  document.getElementById('btnGram').classList.remove('active');
}

function showQty(name, catId) {
  pending = { name, catId };
  document.getElementById('qtyName').textContent = name;
  document.getElementById('qtyStage').style.display = '';
  document.getElementById('acDropdown').style.display = 'none';
  document.getElementById('itemInput').value = '';
  document.getElementById('qtyVal').value = 1;
  document.getElementById('btnStuks').classList.add('active');
  document.getElementById('btnGram').classList.remove('active');
  document.getElementById('qtyVal').focus();
}

function confirmAdd() {
  if (!pending) return;
  const qty  = Math.max(1, parseInt(document.getElementById('qtyVal').value) || 1);
  const unit = document.getElementById('btnStuks').classList.contains('active') ? 'stuks' : 'gram';
  addWeekItem(pending.name, pending.catId, qty, unit);
  resetAdd();
}

function renderAC(q) {
  const dd = document.getElementById('acDropdown');
  const sugg = getSuggestions(q);
  if (!sugg.length) { dd.style.display = 'none'; return; }

  dd.innerHTML = sugg.map(s => `
    <div class="autocomplete-item" data-name="${esc(s.name)}">
      <span class="ac-icon">↑</span>
      <span class="ac-name">${esc(s.name)}</span>
      <span class="ac-count">${s.count}×</span>
    </div>`).join('');

  dd.querySelectorAll('.autocomplete-item').forEach(el => {
    el.addEventListener('mousedown', e => e.preventDefault());
    el.addEventListener('click', () => {
      const catId = document.getElementById('itemCat').value || 'overig';
      showQty(el.dataset.name, catId);
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

  // Splash → Home
  setTimeout(() => {
    showScreen('screen-home');
    renderHome();
  }, 2000);

  // ── New list ────────────────────────────────────────
  document.getElementById('btnNewList').addEventListener('click', () => {
    document.getElementById('newListName').value = '';
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
    const name = itemInput.value.trim();
    if (!name) return;
    const catId = document.getElementById('itemCat').value || 'overig';
    showQty(name, catId);
  });

  // ── Qty ──────────────────────────────────────────────
  document.getElementById('qtyMin').addEventListener('click', () => {
    const i = document.getElementById('qtyVal');
    i.value = Math.max(1, parseInt(i.value) - 1);
  });
  document.getElementById('qtyPlus').addEventListener('click', () => {
    const i = document.getElementById('qtyVal');
    i.value = parseInt(i.value) + 1;
  });
  document.getElementById('btnStuks').addEventListener('click', () => {
    document.getElementById('btnStuks').classList.add('active');
    document.getElementById('btnGram').classList.remove('active');
  });
  document.getElementById('btnGram').addEventListener('click', () => {
    document.getElementById('btnGram').classList.add('active');
    document.getElementById('btnStuks').classList.remove('active');
  });
  document.getElementById('btnQtyCancel').addEventListener('click', resetAdd);
  document.getElementById('btnQtyConfirm').addEventListener('click', confirmAdd);

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
    const name  = document.getElementById('basisInput').value.trim();
    const catId = document.getElementById('basisCat').value || 'overig';
    if (!name) { document.getElementById('basisInput').focus(); return; }
    addBaseItem(name, catId);
    document.getElementById('basisInput').value = '';
    document.getElementById('basisInput').focus();
  });

  document.getElementById('basisInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btnBasisAdd').click();
  });
});

// Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
