# Mercedes-Benz — Model Range

A static reference site covering the current (2025/26) Mercedes-Benz passenger-car
line-up: 36 models across saloons, estates, coupés, cabriolets, SUVs, off-roaders,
the EQ electric range, Mercedes-AMG and Mercedes-Maybach.

## Running it

No build step and no dependencies. Either open `index.html` directly, or serve the
folder:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

It deploys as-is to GitHub Pages, Netlify, or any static host.

## Pages

| File | What it does |
| --- | --- |
| `index.html` | Catalogue with live search, six filters and five sort orders |
| `model.html?id=<model-id>` | Detail page: key figures, highlights, variants, full specification, related models |
| `compare.html` | Up to three models side by side, with the best figure in each row highlighted |

The comparison selection is held in `localStorage`, so it survives navigating into
a model page and back.

## Layout

```
index.html · model.html · compare.html
assets/
  css/style.css
  js/
    models.js       ← all model data (the only file you need to edit for content)
    silhouettes.js  ← SVG car silhouettes + image fallback wiring
    common.js       ← formatting, compare store, header/footer
    catalog.js · model.js · compare.js
```

## Images — please read

Car photography is **hotlinked** from Mercedes-Benz media URLs rather than bundled.
Two consequences worth knowing:

1. **The URLs are unverified.** They follow the shape of the official media CDN
   paths, but the network policy of the environment this was built in blocks
   `mercedes-benz.com` and `mbusa.com`, so none of them could be checked against a
   live server. Expect some or all to 404 until they are replaced.
2. **They are not licensed for reuse.** Hotlinked press images are fine for a
   private reference, but swap in your own photography before publishing anything
   public-facing.

Because of that, every `<img>` is wired to a locally drawn SVG silhouette that
takes over the moment a remote image fails to load — so the site looks finished
whether the links resolve, 404, or the page is opened with no network at all.
There is a silhouette per body style (sedan, estate, coupé, cabriolet, roadster,
SUV, SUV coupé, off-roader, supercar).

To use your own images, edit the `image` field on each entry in
`assets/js/models.js`. That is the only place image URLs are defined — local paths
such as `assets/img/c-class.jpg` work equally well.

## Adding or editing a model

Append an object to `MODELS` in `assets/js/models.js`. The filter dropdowns, hero
statistics, comparison rows and related-model sections are all derived from the
data, so nothing else needs touching. `id` must be unique — it is what `model.html`
deep-links to, and a duplicate is reported in the browser console.

## Figures

Specifications are manufacturer/press figures for the US market, in imperial units.
Prices are MSRP in USD excluding destination, taxes and options, and will drift
from what dealers actually quote.

This is an independent reference and is not affiliated with or endorsed by
Mercedes-Benz Group AG.
