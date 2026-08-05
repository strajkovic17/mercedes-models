/*
 * Shared helpers: formatting, the compare selection store, and header wiring.
 * Loaded by every page before its own page script.
 */

/* ── Formatting ──────────────────────────────────────────────────────────── */

/* German formatting: 51.700 € — thin space before the symbol, as is standard. */
const fmtPrice = (n) =>
  n.toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' €';

const fmtPriceShort = (n) =>
  n >= 1000000
    ? (n / 1000000).toFixed(1).replace(/\.0$/, '') + ' Mio. €'
    : Math.round(n / 1000) + '.000 €';

/** Range for an EV, economy for everything else. */
function rangeOrEconomy(m) {
  return m.range && m.fuel === 'Electric' ? `${m.range} km` : m.economy;
}

/** Badge text and modifier class for a model's powertrain / sub-brand. */
function badgeFor(m) {
  if (m.family === 'Maybach') return { text: 'Maybach', cls: '' };
  if (m.family === 'AMG') return { text: 'AMG', cls: 'is-amg' };
  if (m.fuel === 'Electric') return { text: 'Electric', cls: 'is-electric' };
  if (m.fuel === 'Plug-in Hybrid') return { text: 'Hybrid', cls: 'is-hybrid' };
  if (m.fuels.includes('Diesel')) return { text: 'Petrol / Diesel', cls: 'is-diesel' };
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

/* ── Reveal on scroll ────────────────────────────────────────────────────── */

let revealObserver = null;

/**
 * Arm the reveal effect. Called once per page.
 *
 * Nothing is hidden until this succeeds — the .has-reveal class on <html> is
 * what activates the hiding rule — so a browser without IntersectionObserver,
 * or a reader who has asked for reduced motion, simply sees a static page.
 */
function initReveals() {
  const wantsMotion = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!('IntersectionObserver' in window) || !wantsMotion) return;

  document.documentElement.classList.add('has-reveal');

  // A fast scroll — a jump to an anchor, Cmd+End, or restored scroll position —
  // can carry an element from below the fold to above it between two observer
  // ticks. IntersectionObserver never fires in that case (it was not
  // intersecting before or after), leaving the element invisible for good.
  // Sweep once the scrolling settles and reveal anything already passed.
  let sweepTimer = null;
  addEventListener(
    'scroll',
    () => {
      clearTimeout(sweepTimer);
      sweepTimer = setTimeout(revealPassed, 150);
    },
    { passive: true }
  );

  revealObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-revealed');
        revealObserver.unobserve(entry.target); // reveal once, then forget it
      }
    },
    // Fire a little before the element is fully on screen, so the motion has
    // finished by the time it is properly in view.
    { rootMargin: '0px 0px -6% 0px', threshold: 0.04 }
  );
}

/** Reveal anything scrolled past that the observer missed. */
function revealPassed() {
  if (!revealObserver) return;
  for (const el of document.querySelectorAll('[data-reveal]:not(.is-revealed)')) {
    if (el.getBoundingClientRect().bottom < 0) {
      el.classList.add('is-revealed');
      revealObserver.unobserve(el);
    }
  }
}

/**
 * Observe everything marked [data-reveal] inside `root`.
 * Safe to call repeatedly — the grid re-renders on every filter change.
 */
function observeReveals(root) {
  if (!revealObserver) return;
  const items = (root || document).querySelectorAll('[data-reveal]:not(.is-revealed)');
  let staggered = 0;

  for (const el of items) {
    // Anything already scrolled past is shown at once. Without this, changing
    // a filter while scrolled down leaves the cards above the viewport
    // invisible — the observer only ever fires on the way in, so scrolling
    // back up would reveal a column of blanks.
    if (el.getBoundingClientRect().bottom < 0) {
      el.classList.add('is-revealed');
      continue;
    }
    // Stagger within a batch, capped so a long list does not crawl.
    el.style.setProperty('--reveal-delay', `${Math.min(staggered, 7) * 50}ms`);
    revealObserver.observe(el);
    staggered++;
  }
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
  initReveals();
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
