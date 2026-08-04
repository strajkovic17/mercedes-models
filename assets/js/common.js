/*
 * Shared helpers: formatting, the compare selection store, and header wiring.
 * Loaded by every page before its own page script.
 */

/* ── Formatting ──────────────────────────────────────────────────────────── */

const fmtPrice = (n) =>
  '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });

const fmtPriceShort = (n) =>
  n >= 1000000
    ? '$' + (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'
    : '$' + Math.round(n / 1000) + 'k';

/** Range for an EV, economy for everything else. */
function rangeOrEconomy(m) {
  return m.range && m.fuel === 'Electric' ? `${m.range} mi` : m.economy;
}

/** Badge text and modifier class for a model's powertrain / sub-brand. */
function badgeFor(m) {
  if (m.family === 'Maybach') return { text: 'Maybach', cls: '' };
  if (m.family === 'AMG') return { text: 'AMG', cls: 'is-amg' };
  if (m.fuel === 'Electric') return { text: 'Electric', cls: 'is-electric' };
  if (m.fuel === 'Plug-in Hybrid') return { text: 'Hybrid', cls: 'is-hybrid' };
  return { text: m.bodyLabel, cls: '' };
}

/** Escape text destined for innerHTML. */
function esc(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

/* ── Compare selection ───────────────────────────────────────────────────── */
/* Persisted so a selection survives navigating into a detail page and back.  */

const COMPARE_KEY = 'mb-compare';
const COMPARE_MAX = 3;

function readCompare() {
  try {
    const raw = JSON.parse(localStorage.getItem(COMPARE_KEY) || '[]');
    // Drop anything that no longer resolves to a model, e.g. after a data edit.
    return Array.isArray(raw) ? raw.filter(getModel).slice(0, COMPARE_MAX) : [];
  } catch {
    return [];
  }
}

function writeCompare(ids) {
  try {
    localStorage.setItem(COMPARE_KEY, JSON.stringify(ids.slice(0, COMPARE_MAX)));
  } catch {
    /* Private browsing with storage disabled — selection just won't persist. */
  }
  document.dispatchEvent(new CustomEvent('compare:change', { detail: ids }));
}

/** Add or remove an id. Returns true if the model ended up selected. */
function toggleCompare(id) {
  const ids = readCompare();
  const at = ids.indexOf(id);
  if (at > -1) {
    ids.splice(at, 1);
  } else {
    if (ids.length >= COMPARE_MAX) return false;
    ids.push(id);
  }
  writeCompare(ids);
  return ids.includes(id);
}

/* ── Header ──────────────────────────────────────────────────────────────── */

const STAR_SVG = `
<svg class="star" viewBox="0 0 100 100" aria-hidden="true">
  <circle cx="50" cy="50" r="45"/>
  <path d="M50 50 L50 8 M50 50 L14 71 M50 50 L86 71"/>
</svg>`;

function renderHeader(current) {
  const count = readCompare().length;
  return `
<header class="site-header">
  <div class="shell">
    <a class="brand" href="index.html">
      ${STAR_SVG}
      <span class="brand-name">Mercedes-Benz</span>
    </a>
    <nav class="site-nav">
      <a href="index.html"${current === 'models' ? ' aria-current="page"' : ''}>Models</a>
      <a href="compare.html"${current === 'compare' ? ' aria-current="page"' : ''}>Compare</a>
      <a class="compare-pill" href="compare.html" data-count="${count}" id="comparePill">
        Compare <span id="compareCount">${count}</span>
      </a>
    </nav>
  </div>
</header>`;
}

function renderFooter() {
  return `
<footer class="site-footer">
  <div class="shell">
    <span>An independent reference for the current Mercedes-Benz passenger-car range.</span>
    <span>Figures are manufacturer specifications and may vary by market.</span>
  </div>
</footer>`;
}

/** Keep the header pill in step with the selection, on any page. */
function mountChrome(current) {
  const header = document.getElementById('header');
  const footer = document.getElementById('footer');
  if (header) header.innerHTML = renderHeader(current);
  if (footer) footer.innerHTML = renderFooter();

  document.addEventListener('compare:change', () => {
    const n = readCompare().length;
    const pill = document.getElementById('comparePill');
    const label = document.getElementById('compareCount');
    if (pill) pill.dataset.count = String(n);
    if (label) label.textContent = String(n);
  });
}
