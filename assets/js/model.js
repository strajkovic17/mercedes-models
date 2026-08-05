/* Detail page. The model is selected by ?id= in the query string. */

const detail = document.getElementById('detail');
const model = getModel(new URLSearchParams(location.search).get('id'));

mountChrome('');

if (!model) {
  detail.innerHTML = `
<div class="shell">
  <div class="empty" style="margin:80px 0">
    <p>That model could not be found.</p>
    <p><a class="card-link" href="index.html">Back to the range</a></p>
  </div>
</div>`;
} else {
  document.title = `${model.name} — Mercedes-Benz`;
  renderDetail(model);
}

/** Rows for the specification table, skipping anything not applicable. */
function specRows(m) {
  const rows = [
    ['Series', m.series],
    ['Body style', m.bodyLabel],
    ['Segment', m.segment],
    ['Powertrain', m.fuels.join(' / ')],
    ['Engine', m.engine],
    ['Transmission', m.transmission],
    ['Drive', m.drivetrain],
    ['Power', `${m.kw} kW (${m.ps} PS)`],
    ['Torque', `${m.torque} Nm`],
    ['0–100 km/h', `${m.zeroTo100.toFixed(1)} seconds`],
    ['Top speed', `${m.topSpeed} km/h`],
  ];

  if (m.battery) rows.push(['Battery', `${m.battery} kWh`]);
  if (m.range) {
    rows.push([m.fuel === 'Electric' ? 'Range' : 'Electric-only range', `${m.range} km`]);
  }
  if (m.charging) rows.push(['Charging', m.charging]);

  rows.push(
    ['Efficiency', m.economy],
    ['Seats', m.seats],
    ['Doors', m.doors],
    ['Length', `${m.dims.length} mm`],
    ['Width', `${m.dims.width} mm`],
    ['Height', `${m.dims.height} mm`],
    ['Wheelbase', `${m.dims.wheelbase} mm`],
    ['Luggage capacity', `${m.cargo} litres`],
    ['Kerb weight', `${m.weight.toLocaleString('de-DE')} kg`],
    ['In production since', m.intro]
  );

  return rows;
}

function renderDetail(m) {
  const badge = badgeFor(m);
  const selected = readCompare().includes(m.id);
  // Electric cars are quoted as range; everything else as the leading economy
  // figure — except the handful with no official rating at all (the AMG ONE).
  const litres = m.economy.match(/^([\d.]+)/);
  let efficiencyValue = '—';
  let efficiencyUnit = 'Efficiency';
  if (m.fuel === 'Electric') {
    efficiencyValue = m.range;
    efficiencyUnit = 'km range, WLTP';
  } else if (litres) {
    efficiencyValue = litres[1];
    efficiencyUnit = 'L/100 km';
  }

  detail.innerHTML = `
<section class="detail-hero">
  <div class="shell">
    <p class="breadcrumb"><a href="index.html">Models</a> &nbsp;/&nbsp; ${esc(m.family)}</p>
    <div class="detail-head">
      <div>
        <p class="eyebrow">${esc(badge.text)} · ${esc(m.series)}</p>
        <h1>${esc(m.name)}</h1>
      </div>
      <div class="detail-price">
        <p class="eyebrow">From</p>
        <strong>${fmtPrice(m.price)}</strong>
      </div>
    </div>
    <div class="detail-media">
      <img src="${esc(m.image)}" alt="${esc(m.name)}" data-model="${esc(m.id)}">
    </div>
  </div>
</section>

<div class="shell">
  <div class="keyfigs">
    <div><strong>${m.kw}</strong><span>kW (${m.ps} PS)</span></div>
    <div><strong>${m.torque}</strong><span>Nm torque</span></div>
    <div><strong>${m.zeroTo100.toFixed(1)}s</strong><span>0–100 km/h</span></div>
    <div><strong>${m.topSpeed}</strong><span>km/h top speed</span></div>
    <div><strong>${efficiencyValue}</strong><span>${esc(efficiencyUnit)}</span></div>
    <div><strong>${m.seats}</strong><span>Seats</span></div>
  </div>

  <div class="detail-cols">
    <div>
      <h2 class="section-title">Overview</h2>
      <p>${esc(m.description)}</p>
      <p style="color:var(--white);font-size:19px;font-weight:300">${esc(m.tagline)}</p>
      <div class="card-actions" style="margin-top:32px">
        <button class="btn-compare" type="button" id="btnCompareDetail"
                aria-pressed="${selected}" style="margin-left:0;padding:10px 18px">
          ${selected ? 'Added to comparison' : 'Add to comparison'}
        </button>
        <a class="card-link" href="compare.html" style="margin-left:14px">Open comparison</a>
      </div>
    </div>
    <div>
      <h2 class="section-title">Highlights</h2>
      <ul class="feature-list">
        ${m.features.map((f) => `<li>${esc(f)}</li>`).join('')}
      </ul>
    </div>
  </div>

  <section class="detail-section">
    <h2 class="section-title">Variants</h2>
    <div class="table-scroll">
      <table class="variant-table">
        <thead>
          <tr>
            <th>Variant</th><th>Engine</th><th>Power</th><th>0–100 km/h</th><th>From</th>
          </tr>
        </thead>
        <tbody>
          ${m.variants
            .map(
              (v) => `
          <tr>
            <td>${esc(v.name)}</td>
            <td>${esc(v.engine)}</td>
            <td>${v.kw} kW (${v.ps} PS)</td>
            <td>${v.zeroTo100.toFixed(1)}s</td>
            <td>${fmtPrice(v.price)}</td>
          </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>
  </section>

  <section class="detail-section">
    <h2 class="section-title">Full specification</h2>
    <div class="detail-cols" style="padding:0;gap:0 64px">
      ${[0, 1]
        .map(
          (half) => `
      <div class="table-scroll">
        <table class="spec-table"><tbody>
          ${specRows(m)
            .filter((_, i) => i % 2 === half)
            .map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`)
            .join('')}
        </tbody></table>
      </div>`
        )
        .join('')}
    </div>
  </section>

  <section class="detail-section">
    <h2 class="section-title">Elsewhere in the ${esc(m.family)} family</h2>
    <div class="grid" style="margin:0 0 40px">
      ${relatedHTML(m)}
    </div>
  </section>
</div>`;

  for (const img of detail.querySelectorAll('img[data-model]')) {
    attachImageFallback(img, getModel(img.dataset.model));
  }

  const btn = document.getElementById('btnCompareDetail');
  btn.addEventListener('click', () => {
    const wasSelected = btn.getAttribute('aria-pressed') === 'true';
    const nowSelected = toggleCompare(m.id);
    if (!wasSelected && !nowSelected) {
      btn.textContent = `Comparison is full (${COMPARE_MAX})`;
      setTimeout(() => { btn.textContent = 'Add to comparison'; }, 1600);
      return;
    }
    btn.setAttribute('aria-pressed', String(nowSelected));
    btn.textContent = nowSelected ? 'Added to comparison' : 'Add to comparison';
  });
}

/* Same family where possible; otherwise fall back to the same body style so
   the section is never empty for a one-model family such as the AMG ONE. */
function relatedHTML(m) {
  let related = MODELS.filter((x) => x.id !== m.id && x.family === m.family);
  if (!related.length) {
    related = MODELS.filter((x) => x.id !== m.id && x.bodyLabel === m.bodyLabel);
  }
  related = related.slice(0, 3);

  if (!related.length) return '<div class="empty">Nothing closely related.</div>';

  return related
    .map(
      (r) => `
<article class="card">
  <a class="card-media" href="model.html?id=${encodeURIComponent(r.id)}" aria-label="${esc(r.name)}">
    <img src="${esc(r.image)}" alt="${esc(r.name)}" loading="lazy" data-model="${esc(r.id)}">
  </a>
  <div class="card-body">
    <a href="model.html?id=${encodeURIComponent(r.id)}"><h3>${esc(r.name)}</h3></a>
    <p class="card-series">${esc(r.series)}</p>
    <p class="card-tagline">${esc(r.tagline)}</p>
    <div class="card-specs">
      <div><strong>${r.kw}</strong><span>kW</span></div>
      <div><strong>${r.zeroTo100.toFixed(1)}s</strong><span>0–100</span></div>
      <div><strong>${fmtPriceShort(r.price)}</strong><span>From</span></div>
    </div>
  </div>
</article>`
    )
    .join('');
}
