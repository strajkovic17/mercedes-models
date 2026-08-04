/*
 * Locally drawn car silhouettes, one per body style.
 *
 * These exist so the site degrades gracefully: every remote press image is
 * hotlinked, and hotlinks rot. When an <img> fails to load we swap in the
 * matching silhouette rather than leave a broken-image box on the page.
 * They are also what renders if the page is opened with no network at all.
 */

const SILHOUETTE_PATHS = {
  sedan: {
    body:
      'M14,104 L14,88 Q15,76 34,72 L104,60 Q142,34 200,32 L248,33 Q292,36 326,60 L372,70 ' +
      'Q388,74 388,88 L388,104 Z',
    glass:
      'M116,58 Q148,40 196,38 L196,58 Z M208,38 L246,39 Q282,42 310,58 L208,58 Z',
  },
  estate: {
    body:
      'M14,104 L14,88 Q15,76 34,72 L104,60 Q142,34 200,32 L300,33 Q340,34 352,44 ' +
      'L360,66 L374,70 Q388,74 388,90 L388,104 Z',
    glass:
      'M116,58 Q148,40 196,38 L196,58 Z M208,38 L296,39 Q330,40 340,50 L346,58 L208,58 Z',
  },
  coupe: {
    body:
      'M14,104 L14,90 Q15,78 34,74 L100,64 Q146,34 202,32 L242,34 Q296,44 330,68 ' +
      'L374,74 Q388,78 388,90 L388,104 Z',
    glass:
      'M114,62 Q152,40 198,38 L198,62 Z M210,38 L240,40 Q286,50 314,62 L210,62 Z',
  },
  cabriolet: {
    body:
      'M14,104 L14,90 Q15,78 34,74 L102,66 L150,62 Q190,44 236,46 L272,52 Q312,60 334,70 ' +
      'L374,76 Q388,80 388,92 L388,104 Z',
    glass: 'M152,60 Q186,46 230,46 L236,60 Z',
    topDown: true,
  },
  roadster: {
    body:
      'M12,104 L12,92 Q13,80 32,76 L96,68 L146,62 Q184,46 226,48 L266,54 Q310,62 336,72 ' +
      'L376,78 Q390,82 390,94 L390,104 Z',
    glass: 'M148,60 Q180,48 220,48 L226,60 Z',
    topDown: true,
  },
  suv: {
    body:
      'M12,102 L12,74 Q13,62 32,58 L96,50 Q132,26 194,24 L262,26 Q312,30 340,52 ' +
      'L374,58 Q390,62 390,76 L390,102 Z',
    glass:
      'M108,48 Q140,30 190,28 L190,48 Z M202,28 L258,30 Q302,34 324,48 L202,48 Z',
  },
  'suv-coupe': {
    body:
      'M12,102 L12,76 Q13,64 32,60 L96,52 Q132,26 194,24 L250,26 Q306,36 342,62 ' +
      'L376,66 Q390,70 390,82 L390,102 Z',
    glass:
      'M108,50 Q140,30 190,28 L190,50 Z M202,28 L246,30 Q294,40 322,54 L202,54 Z',
  },
  offroad: {
    body:
      'M16,100 L16,54 Q16,44 28,44 L64,44 L64,30 Q64,22 76,22 L316,22 Q328,22 328,30 ' +
      'L328,44 L372,44 Q384,44 384,54 L384,100 Z',
    glass:
      'M80,40 L186,40 L186,26 L80,26 Z M198,26 L308,26 L308,40 L198,40 Z',
    boxy: true,
  },
  supercar: {
    body:
      'M10,102 L10,86 Q11,76 28,72 L88,62 Q136,36 196,34 L246,36 Q306,44 348,66 ' +
      'L378,72 Q392,76 392,88 L392,102 Z',
    glass: 'M124,60 Q162,42 200,40 L200,60 Z M212,40 L244,42 Q292,50 320,60 L212,60 Z',
  },
};

/* Monotonic counter backing the per-instance element ids above. */
let silhouetteSeq = 0;

/**
 * Build an inline SVG silhouette for a body style.
 * Returns a data-URI-free SVG string so it can be dropped straight into innerHTML.
 */
function silhouetteSVG(body, label) {
  const spec = SILHOUETTE_PATHS[body] || SILHOUETTE_PATHS.sedan;
  // Wheels sit slightly higher and wider apart on the boxy off-roaders.
  const wheels = spec.boxy
    ? [{ x: 92, y: 100, r: 27 }, { x: 306, y: 100, r: 27 }]
    : [{ x: 96, y: 102, r: 25 }, { x: 306, y: 102, r: 25 }];

  // Ids must be unique per instance — several silhouettes share a page, and
  // duplicate gradient/mask ids would make every one of them use the first.
  const uid = `sil${++silhouetteSeq}`;

  return `
<svg viewBox="0 0 400 140" role="img" aria-label="${label} silhouette" class="silhouette">
  <defs>
    <linearGradient id="${uid}-g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="var(--sil-top)"/>
      <stop offset="100%" stop-color="var(--sil-bottom)"/>
    </linearGradient>
    <!-- Punches wheel arches out of the body so the tyres sit in openings
         rather than on top of a solid slab. -->
    <mask id="${uid}-m">
      <rect x="0" y="0" width="400" height="140" fill="#fff"/>
      ${wheels
        .map((w) => `<circle cx="${w.x}" cy="${w.y}" r="${w.r + 4}" fill="#000"/>`)
        .join('')}
    </mask>
  </defs>
  ${wheels
    .map(
      (w) => `
  <circle cx="${w.x}" cy="${w.y}" r="${w.r}" fill="var(--sil-tyre)"/>
  <circle cx="${w.x}" cy="${w.y}" r="${w.r * 0.52}" fill="var(--sil-rim)"/>`
    )
    .join('')}
  <g mask="url(#${uid}-m)">
    <path d="${spec.body}" fill="url(#${uid}-g)"/>
    <path d="${spec.glass}" fill="var(--sil-glass)"/>
  </g>
  <rect x="10" y="126" width="380" height="2" rx="1" fill="var(--sil-shadow)"/>
</svg>`.trim();
}

/**
 * Wire an <img> so that a failed remote load is replaced by the silhouette.
 * Used everywhere an image is rendered.
 */
function attachImageFallback(img, model) {
  const swap = () => {
    const holder = img.parentElement;
    if (!holder || holder.dataset.fellBack === 'true') return;
    holder.dataset.fellBack = 'true';
    holder.innerHTML = silhouetteSVG(model.body, model.name);
  };
  img.addEventListener('error', swap, { once: true });
  // An image that already failed before the listener attached reports
  // complete === true with zero natural width.
  if (img.complete && img.naturalWidth === 0) swap();
}
