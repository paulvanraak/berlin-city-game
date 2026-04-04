// === Data Model ===
// categories: [{id, name, icon, order}]
// baseItems: [{id, name, categoryId, skipped}]  skipped = tijdelijk overslaan deze week
// weekItems: [{id, name, categoryId, checked, fromBase, baseId}]

const CATEGORIES = [
  { id: 'groente',   name: 'Groente & Fruit',   icon: '🥦' },
  { id: 'zuivel',    name: 'Zuivel & Eieren',    icon: '🥛' },
  { id: 'vlees',     name: 'Vlees & Vis',        icon: '🥩' },
  { id: 'droogkast', name: 'Droogkast',          icon: '🥫' },
  { id: 'brood',     name: 'Brood & Bakkerij',   icon: '🍞' },
  { id: 'diepvries', name: 'Diepvries',          icon: '❄️' },
  { id: 'drogist',   name: 'Drogisterij',        icon: '🧴' },
  { id: 'overig',    name: 'Overig',             icon: '🛒' },
];

// === Storage ===
const storage = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  },
  set(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
};

// === State ===
let baseItems = storage.get('baseItems', []);
let weekItems = storage.get('weekItems', null);

// First run: load base into week
if (weekItems === null) {
  weekItems = buildWeekFromBase();
  storage.set('weekItems', weekItems);
}

function buildWeekFromBase() {
  return baseItems
    .filter(b => !b.skipped)
    .map(b => ({
      id: uid(),
      name: b.name,
      categoryId: b.categoryId,
      checked: false,
      fromBase: true,
      baseId: b.id
    }));
}

function uid() { return Math.random().toString(36).slice(2, 10); }

// === Save ===
function save() {
  storage.set('baseItems', baseItems);
  storage.set('weekItems', weekItems);
}

// === Populate category dropdowns ===
function fillSelects() {
  const selects = document.querySelectorAll('.quick-add select');
  selects.forEach(sel => {
    const current = sel.value;
    sel.innerHTML = '<option value="">Categorie...</option>';
    CATEGORIES.forEach(c => {
      const o = document.createElement('option');
      o.value = c.id;
      o.textContent = c.icon + ' ' + c.name;
      sel.appendChild(o);
    });
    if (current) sel.value = current;
  });
}

// === Render Week List ===
function renderWeek() {
  const container = document.getElementById('weekList');
  const empty = document.getElementById('weekEmpty');
  container.innerHTML = '';

  const total = weekItems.length;
  const done  = weekItems.filter(i => i.checked).length;

  document.getElementById('progressFill').style.width = total ? (done / total * 100) + '%' : '0%';
  document.getElementById('progressLabel').textContent = `${done} / ${total}`;

  if (total === 0) { empty.style.display = ''; return; }
  empty.style.display = 'none';

  // Group by category, unchecked first within each group
  CATEGORIES.forEach(cat => {
    const items = weekItems.filter(i => i.categoryId === cat.id);
    if (!items.length) return;

    // Sort: unchecked first
    items.sort((a, b) => a.checked - b.checked);

    const group = document.createElement('div');
    group.className = 'category-group';

    const doneInCat  = items.filter(i => i.checked).length;
    group.innerHTML = `
      <div class="category-header">
        <span class="category-icon">${cat.icon}</span>
        <span class="category-name">${cat.name}</span>
        <span class="category-count">${doneInCat}/${items.length}</span>
      </div>`;

    items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'item-row' + (item.checked ? ' is-checked' : '');
      row.innerHTML = `
        <div class="item-check ${item.checked ? 'checked' : ''}" data-id="${item.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <span class="item-label">${escHtml(item.name)}</span>
        ${item.fromBase ? '<span class="item-badge">basis</span>' : ''}
        <button class="btn-delete" data-id="${item.id}" title="Verwijder">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>`;
      group.appendChild(row);
    });

    container.appendChild(group);
  });

  // Uncategorized / fallback
  const uncatItems = weekItems.filter(i => !CATEGORIES.find(c => c.id === i.categoryId));
  if (uncatItems.length) {
    // treat as 'overig'
  }

  // Events
  container.querySelectorAll('.item-check').forEach(el => {
    el.addEventListener('click', () => toggleWeekItem(el.dataset.id));
  });
  container.querySelectorAll('.btn-delete').forEach(el => {
    el.addEventListener('click', () => deleteWeekItem(el.dataset.id));
  });
}

// === Render Basis List ===
function renderBasis() {
  const container = document.getElementById('basisList');
  const empty = document.getElementById('basisEmpty');
  container.innerHTML = '';

  if (!baseItems.length) { empty.style.display = ''; return; }
  empty.style.display = 'none';

  CATEGORIES.forEach(cat => {
    const items = baseItems.filter(i => i.categoryId === cat.id);
    if (!items.length) return;

    // Sort: active first, skipped last
    items.sort((a, b) => (a.skipped ? 1 : 0) - (b.skipped ? 1 : 0));

    const group = document.createElement('div');
    group.className = 'category-group';

    const skippedCount = items.filter(i => i.skipped).length;
    group.innerHTML = `
      <div class="category-header">
        <span class="category-icon">${cat.icon}</span>
        <span class="category-name">${cat.name}</span>
        <span class="category-count">${skippedCount > 0 ? skippedCount + ' overgeslagen' : items.length + ' items'}</span>
      </div>`;

    items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'item-row' + (item.skipped ? ' is-skipped' : '');
      row.innerHTML = `
        <div class="item-check ${item.skipped ? 'skipped' : ''}" data-id="${item.id}" title="${item.skipped ? 'Terug activeren' : 'Overslaan deze week'}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <span class="item-label">${escHtml(item.name)}</span>
        <button class="btn-delete" data-id="${item.id}" title="Permanent verwijderen">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>`;
      group.appendChild(row);
    });

    container.appendChild(group);
  });

  container.querySelectorAll('.item-check').forEach(el => {
    el.addEventListener('click', () => toggleBaseSkip(el.dataset.id));
  });
  container.querySelectorAll('.btn-delete').forEach(el => {
    el.addEventListener('click', () => deleteBaseItem(el.dataset.id));
  });
}

// === Actions: Week ===
function toggleWeekItem(id) {
  const item = weekItems.find(i => i.id === id);
  if (!item) return;
  item.checked = !item.checked;
  save();
  renderWeek();
}

function deleteWeekItem(id) {
  weekItems = weekItems.filter(i => i.id !== id);
  save();
  renderWeek();
}

function addWeekItem(name, categoryId) {
  weekItems.push({ id: uid(), name, categoryId: categoryId || 'overig', checked: false, fromBase: false });
  save();
  renderWeek();
}

// === Actions: Base ===
function toggleBaseSkip(id) {
  const item = baseItems.find(i => i.id === id);
  if (!item) return;
  item.skipped = !item.skipped;

  // Sync to week list
  if (item.skipped) {
    // Remove from week if not yet checked
    weekItems = weekItems.filter(w => !(w.baseId === id && !w.checked));
  } else {
    // Add back to week if not already there and not checked-off previously
    const already = weekItems.find(w => w.baseId === id);
    if (!already) {
      weekItems.push({ id: uid(), name: item.name, categoryId: item.categoryId, checked: false, fromBase: true, baseId: id });
    }
  }

  save();
  renderBasis();
  renderWeek();
}

function deleteBaseItem(id) {
  baseItems = baseItems.filter(i => i.id !== id);
  // Also remove from weeklist if present and unchecked
  weekItems = weekItems.filter(w => !(w.baseId === id && !w.checked));
  save();
  renderBasis();
  renderWeek();
}

function addBaseItem(name, categoryId) {
  const id = uid();
  baseItems.push({ id, name, categoryId: categoryId || 'overig', skipped: false });
  // Also add to current weeklist
  weekItems.push({ id: uid(), name, categoryId: categoryId || 'overig', checked: false, fromBase: true, baseId: id });
  save();
  renderBasis();
  renderWeek();
}

// === New Week ===
function startNewWeek() {
  // Reset skipped flags on base
  baseItems.forEach(b => { b.skipped = false; });
  // Rebuild week list fresh from base
  weekItems = buildWeekFromBase();
  save();
  renderBasis();
  renderWeek();
}

// === Helpers ===
function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// === UI Events ===
document.addEventListener('DOMContentLoaded', () => {
  fillSelects();
  renderWeek();
  renderBasis();

  // Tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tab' + cap(tab.dataset.tab)).classList.add('active');
    });
  });

  // Quick add to week
  const quickInput    = document.getElementById('quickInput');
  const quickCategory = document.getElementById('quickCategory');
  document.getElementById('btnQuickAdd').addEventListener('click', () => {
    const name = quickInput.value.trim();
    if (!name) { quickInput.focus(); return; }
    addWeekItem(name, quickCategory.value || 'overig');
    quickInput.value = '';
    quickInput.focus();
  });
  quickInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btnQuickAdd').click();
  });

  // Add to basis
  const basisInput    = document.getElementById('basisInput');
  const basisCategory = document.getElementById('basisCategory');
  document.getElementById('btnBasisAdd').addEventListener('click', () => {
    const name = basisInput.value.trim();
    if (!name) { basisInput.focus(); return; }
    addBaseItem(name, basisCategory.value || 'overig');
    basisInput.value = '';
    basisInput.focus();
  });
  basisInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btnBasisAdd').click();
  });

  // New week modal
  document.getElementById('btnNewWeek').addEventListener('click', () => {
    document.getElementById('modalNewWeek').style.display = 'flex';
  });
  document.getElementById('btnNewWeekCancel').addEventListener('click', () => {
    document.getElementById('modalNewWeek').style.display = 'none';
  });
  document.getElementById('btnNewWeekConfirm').addEventListener('click', () => {
    startNewWeek();
    document.getElementById('modalNewWeek').style.display = 'none';
  });
  document.getElementById('modalNewWeek').addEventListener('click', e => {
    if (e.target === e.currentTarget) e.currentTarget.style.display = 'none';
  });
});

function cap(str) { return str.charAt(0).toUpperCase() + str.slice(1); }

// === Service Worker registration ===
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
