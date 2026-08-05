/* Catalogue page: filtering, search, sorting and the model grid. */

const grid = document.getElementById('grid');
const resultCount = document.getElementById('resultCount');
const btnReset = document.getElementById('btnReset');

const controls = {
  search: document.getElementById('search'),
  body: document.getElementById('filterBody'),
  fuel: document.getElementById('filterFuel'),
  family: document.getElementById('filterFamily'),
  seats: document.getElementById('filterSeats'),
  price: document.getElementById('filterPrice'),
  sort: document.getElementById('sortBy'),
};

/* ── Populate the data-driven selects ────────────────────────────────────── */

function fillSelect(select, values) {
  for (const v of values) {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    select.appendChild(opt);
  }
}

fillSelect(controls.body, BODY_TYPES);
fillSelect(controls.fuel, FUEL_TYPES);
fillSelect(controls.family, FAMILIES);

/* ── Filtering ───────────────────────────────────────────────────────────── */

function matchesSearch(m, q) {
  if (!q) return true;
  const haystack = [
    m.name,
    m.family,
    m.series,
    m.bodyLabel,
    m.segment,
    m.fuels.join(' '),
    m.engine,
    m.tagline,
    ...m.variants.map((v) => `${v.name} ${v.engine}`),
  ]
    .join(' ')
    .toLowerCase();
  // Every whitespace-separated term must appear somewhere.
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}

function currentFilters() {
  return {
    q: controls.search.value.trim(),
    body: controls.body.value,
    fuel: controls.fuel.value,
    family: controls.family.value,
    seats: controls.seats.value,
    price: controls.price.value,
    sort: controls.sort.value,
  };
}

function isFiltered(f) {
  return Boolean(f.q || f.body || f.fuel || f.family || f.seats || f.price);
}

function applyFilters(f) {
  let out = MODELS.filter((m) => {
    if (!matchesSearch(m, f.q)) return false;
    if (f.body && m.bodyLabel !== f.body) return false;
    if (f.fuel && !m.fuels.includes(f.fuel)) return false;
    if (f.family && m.family !== f.family) return false;
    if (f.seats) {
      const want = Number(f.seats);
      // "2 seats" is exact; the rest are minimums.
      if (want === 2 ? m.seats !== 2 : m.seats < want) return false;
    }
    if (f.price) {
      const [lo, hi] = f.price.split('-').map(Number);
      if (m.price < lo || m.price > hi) return false;
    }
    return true;
  });

  const sorters = {
    name: (a, b) => a.name.localeCompare(b.name),
    'price-asc': (a, b) => a.price - b.price,
    'price-desc': (a, b) => b.price - a.price,
    power: (a, b) => b.kw - a.kw,
    quick: (a, b) => a.zeroTo100 - b.zeroTo100,
  };
  out = out.sort(sorters[f.sort] || sorters.name);
  return out;
}

/* ── Rendering ───────────────────────────────────────────────────────────── */

function cardHTML(m, selected) {
  const badge = badgeFor(m);
  const href = `model.html?id=${encodeURIComponent(m.id)}`;
  return `
<article class="card">
  <a class="card-media" href="${href}" aria-label="${esc(m.name)}">
    <img src="${esc(m.image)}" alt="${esc(m.name)}" loading="lazy" data-model="${esc(m.id)}">
    <span class="badge ${badge.cls}">${esc(badge.text)}</span>
  </a>
  <div class="card-body">
    <a href="${href}"><h3>${esc(m.name)}</h3></a>
    <p class="card-series">${esc(m.series)} · ${esc(m.segment)}</p>
    <p class="card-tagline">${esc(m.tagline)}</p>
    <div class="card-specs">
      <div><strong>${m.kw}</strong><span>kW</span></div>
      <div><strong>${m.zeroTo100.toFixed(1)}s</strong><span>0–100 km/h</span></div>
      <div><strong>${fmtPriceShort(m.price)}</strong><span>From</span></div>
    </div>
    <div class="card-actions">
      <a class="card-link" href="${href}">Explore</a>
      <button class="btn-compare" type="button" data-compare="${esc(m.id)}"
              aria-pressed="${selected}">${selected ? 'Added' : 'Compare'}</button>
    </div>
  </div>
</article>`;
}

function render() {
  const f = currentFilters();
  const list = applyFilters(f);
  const selected = readCompare();

  grid.innerHTML = list.length
    ? list.map((m) => cardHTML(m, selected.includes(m.id))).join('')
    : `<div class="empty">
         <p>No models match those filters.</p>
         <button class="btn-reset" type="button" data-reset>Clear all filters</button>
       </div>`;

  // Swap in a silhouette wherever the hotlinked press image fails to load.
  for (const img of grid.querySelectorAll('img[data-model]')) {
    attachImageFallback(img, getModel(img.dataset.model));
  }

  resultCount.textContent =
    `${list.length} of ${MODELS.length} model${MODELS.length === 1 ? '' : 's'}`;
  btnReset.hidden = !isFiltered(f);
}

/* ── Hero statistics, derived rather than hard-coded ─────────────────────── */

function renderStats() {
  const variants = MODELS.reduce((n, m) => n + m.variants.length, 0);
  const diesel = MODELS.filter((m) => m.fuels.includes('Diesel')).length;
  const peak = Math.max(...MODELS.flatMap((m) => m.variants.map((v) => v.kw)));
  document.getElementById('statModels').textContent = MODELS.length;
  document.getElementById('statVariants').textContent = variants;
  document.getElementById('statDiesel').textContent = diesel;
  document.getElementById('statPower').textContent = peak.toLocaleString('de-DE');
}

/* ── Events ──────────────────────────────────────────────────────────────── */

function resetAll() {
  controls.search.value = '';
  controls.body.value = '';
  controls.fuel.value = '';
  controls.family.value = '';
  controls.seats.value = '';
  controls.price.value = '';
  render();
}

for (const el of Object.values(controls)) {
  el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', render);
}

btnReset.addEventListener('click', resetAll);

grid.addEventListener('click', (e) => {
  const reset = e.target.closest('[data-reset]');
  if (reset) return resetAll();

  const btn = e.target.closest('[data-compare]');
  if (!btn) return;
  const id = btn.dataset.compare;
  const wasSelected = btn.getAttribute('aria-pressed') === 'true';
  const nowSelected = toggleCompare(id);

  if (!wasSelected && !nowSelected) {
    // The selection was already full — say so rather than failing silently.
    btn.textContent = `Max ${COMPARE_MAX}`;
    setTimeout(() => { btn.textContent = 'Compare'; }, 1400);
    return;
  }
  btn.setAttribute('aria-pressed', String(nowSelected));
  btn.textContent = nowSelected ? 'Added' : 'Compare';
});

mountChrome('models');
renderStats();
render();
