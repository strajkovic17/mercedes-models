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
  img/              ← photographs, populated by tools/fetch-images.py (gitignored)
  js/
    models.js       ← all model data (the only file you need to edit for content)
    silhouettes.js  ← SVG car silhouettes + image fallback wiring
    common.js       ← formatting, compare store, header/footer
    catalog.js · model.js · compare.js
tools/
  fetch-images.py   ← downloads freely-licensed photos from Wikimedia Commons
```

## Images

Photographs live locally in `assets/img/<model-id>.jpg` and are **not committed** —
they are third-party works under their own licences. Fetch them with one command:

```sh
python3 tools/fetch-images.py
```

That pulls a freely-licensed photograph for each of the 36 models from Wikimedia
Commons and writes per-image attribution to `assets/img/CREDITS.md`. Standard
library only, no `pip install`.

```sh
python3 tools/fetch-images.py --force                  # replace existing files
python3 tools/fetch-images.py --only eqs-sedan g-class # just these models
python3 tools/fetch-images.py --width 1600             # larger images
```

The script *searches* Commons per model rather than guessing at file paths, so it
self-corrects as Commons changes. It skips anything non-commercial, no-derivatives,
or too small, and won't hand the same photograph to two models. If a model resolves
to the wrong car, widen or reorder its `imageSearch` terms in `assets/js/models.js`
and re-run with `--only <id>`.

> **Not yet run against the live API.** The environment this was built in blocks
> `commons.wikimedia.org`, so the parser, licence filter and failure handling are
> tested but the live fetch is not. Expect to tune a few `imageSearch` terms on the
> first run.

**Prefer your own photography?** Drop JPEGs at `assets/img/<model-id>.jpg` and
they take precedence — the fetcher skips files that already exist.

### The fallback

Any model with no image file shows a locally drawn SVG silhouette instead, so the
site looks finished before you fetch anything, with a missing file, or with no
network at all. There is a silhouette per body style — sedan, estate, coupé,
cabriolet, roadster, SUV, SUV coupé, off-roader and supercar. Real photos and
silhouettes coexist happily in the same grid.

## Deploying to GitHub Pages

`.github/workflows/deploy-pages.yml` publishes the site on every push to
`claude/mercedes-benz-models-site-7cig85`, and on manual dispatch. It needs no
build step — the repo root is uploaded as the Pages artifact.

**Pages has to be switched on once, by hand.** The workflow tries to do it itself
(`configure-pages` with `enablement: true`), but the Actions token cannot create a
Pages site — it fails with *"Create Pages site failed: Resource not accessible by
integration"*. That permission belongs to the repository owner.

This repository is **private**, and Pages on a private repository requires GitHub
Pro, Team or Enterprise. On a free account, make the repository public first.

1. **Settings → Pages**
2. **Source: GitHub Actions**
3. **Actions → Deploy to GitHub Pages → Run workflow**, choosing the branch above

The site then lands at:

```
https://strajkovic17.github.io/mercedes-models/
```

Pushes to the branch redeploy automatically from that point on.

Photographs are gitignored, so a deployed site shows SVG silhouettes until you run
the fetcher and commit the results — or drop the images in and remove `*.jpg` from
`assets/img/.gitignore`.

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
