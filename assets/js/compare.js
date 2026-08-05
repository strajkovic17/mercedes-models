/* Comparison page: pick up to three models, see the specs against each other. */

const picker = document.getElementById('picker');
const tableWrap = document.getElementById('tableWrap');
const note = document.getElementById('note');

/*
 * Each row declares how to read a value, how to display it, and which
 * direction counts as "better" — 1 for higher, -1 for lower, 0 for rows
 * where highlighting a winner would be meaningless.
 */
const ROWS = [
  { label: 'Price from', get: (m) => m.price, show: (m) => fmtPrice(m.price), better: -1 },
  { label: 'Series', get: () => null, show: (m) => m.series, better: 0 },
  { label: 'Body style', get: () => null, show: (m) => m.bodyLabel, better: 0 },
  { label: 'Segment', get: () => null, show: (m) => m.segment, better: 0 },
  { label: 'Powertrain', get: () => null, show: (m) => m.fuels.join(' / '), better: 0 },
  { label: 'Engine', get: () => null, show: (m) => m.engine, better: 0 },
  { label: 'Transmission', get: () => null, show: (m) => m.transmission, better: 0 },
  { label: 'Drive', get: () => null, show: (m) => m.drivetrain, better: 0 },
  { label: 'Power', get: (m) => m.kw, show: (m) => `${m.kw} kW (${m.ps} PS)`, better: 1 },
  { label: 'Torque', get: (m) => m.torque, show: (m) => `${m.torque} Nm`, better: 1 },
  {
    label: '0–100 km/h',
    get: (m) => m.zeroTo100,
    show: (m) => `${m.zeroTo100.toFixed(1)}s`,
    better: -1,
  },
  { label: 'Top speed', get: (m) => m.topSpeed, show: (m) => `${m.topSpeed} km/h`, better: 1 },
  {
    label: 'Battery',
    get: (m) => m.battery || null,
    show: (m) => (m.battery ? `${m.battery} kWh` : '—'),
    better: 1,
  },
  {
    label: 'Electric range',
    get: (m) => m.range || null,
    show: (m) => (m.range ? `${m.range} km` : '—'),
    better: 1,
  },
  { label: 'Efficiency', get: () => null, show: (m) => m.economy, better: 0 },
  { label: 'Seats', get: (m) => m.seats, show: (m) => m.seats, better: 1 },
  { label: 'Doors', get: () => null, show: (m) => m.doors, better: 0 },
  {
    label: 'Luggage',
    get: (m) => m.cargo,
    show: (m) => `${m.cargo} litres`,
    better: 1,
  },
  {
    label: 'Length',
    get: () => null,
    show: (m) => `${m.dims.length} mm`,
    better: 0,
  },
  {
    label: 'Wheelbase',
    get: () => null,
    show: (m) => `${m.dims.wheelbase} mm`,
    better: 0,
  },
  {
    label: 'Kerb weight',
    get: (m) => m.weight,
    show: (m) => `${m.weight.toLocaleString('de-DE')} kg`,
    better: -1,
  },
  { label: 'Variants', get: (m) => m.variants.length, show: (m) => m.variants.length, better: 1 },
];

/* ── Picker chips ────────────────────────────────────────────────────────── */

function renderPicker() {
  const selected = readCompare();
  const full = selected.length >= COMPARE_MAX;

  picker.innerHTML = MODELS.map((m) => {
    const on = selected.includes(m.id);
    return `<button class="chip" type="button" data-id="${esc(m.id)}"
             aria-pressed="${on}"${!on && full ? ' disabled' : ''}>${esc(m.name)}</button>`;
  }).join('');
}

/* ── Table ───────────────────────────────────────────────────────────────── */

/** Ids of the models holding the best value in a row, or an empty set. */
function winners(row, models) {
  if (!row.better) return new Set();
  const values = models
    .map((m) => ({ id: m.id, v: row.get(m) }))
    .filter((x) => typeof x.v === 'number' && Number.isFinite(x.v));
  // Nothing to crown if only one model has a figure at all.
  if (values.length < 2) return new Set();

  const best = values.reduce(
    (acc, x) => (row.better === 1 ? Math.max(acc, x.v) : Math.min(acc, x.v)),
    row.better === 1 ? -Infinity : Infinity
  );
  // Every model tying the best value is highlighted; a full tie is not a win.
  const tied = values.filter((x) => x.v === best);
  return tied.length === values.length ? new Set() : new Set(tied.map((x) => x.id));
}

function renderTable() {
  const models = readCompare().map(getModel).filter(Boolean);

  if (!models.length) {
    tableWrap.innerHTML =
      '<div class="empty">Select up to three models above to compare them.</div>';
    note.textContent = '';
    return;
  }

  const head = models
    .map(
      (m) => `
    <th class="compare-head">
      <div class="compare-head-media">
        <img src="${esc(m.image)}" alt="${esc(m.name)}" data-model="${esc(m.id)}">
      </div>
      <h3><a href="model.html?id=${encodeURIComponent(m.id)}">${esc(m.name)}</a></h3>
      <button class="btn-remove" type="button" data-remove="${esc(m.id)}">Remove</button>
    </th>`
    )
    .join('');

  const body = ROWS.map((row) => {
    const best = winners(row, models);
    const cells = models
      .map(
        (m) =>
          `<td class="${best.has(m.id) ? 'is-best' : ''}">${esc(row.show(m))}</td>`
      )
      .join('');
    return `<tr><th>${esc(row.label)}</th>${cells}</tr>`;
  }).join('');

  tableWrap.innerHTML = `
<table class="compare-table">
  <thead><tr><th></th>${head}</tr></thead>
  <tbody>${body}</tbody>
</table>`;

  for (const img of tableWrap.querySelectorAll('img[data-model]')) {
    attachImageFallback(img, getModel(img.dataset.model));
  }

  const mixed = new Set(models.map((m) => m.fuel)).size > 1;
  note.textContent = mixed
    ? 'Efficiency figures are not directly comparable across different powertrains, so no winner is marked on that row.'
    : `Comparing ${models.length} of ${MODELS.length} models.`;
}

function renderAll() {
  renderPicker();
  renderTable();
}

/* ── Events ──────────────────────────────────────────────────────────────── */

picker.addEventListener('click', (e) => {
  const chip = e.target.closest('[data-id]');
  if (!chip) return;
  toggleCompare(chip.dataset.id);
  renderAll();
});

tableWrap.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-remove]');
  if (!btn) return;
  toggleCompare(btn.dataset.remove);
  renderAll();
});

mountChrome('compare');
renderAll();
