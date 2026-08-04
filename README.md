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

That pulls a photograph for each of the 36 models and writes per-image attribution
to `assets/img/CREDITS.md`. Standard library only, no `pip install`.

```sh
python3 tools/fetch-images.py --force                  # replace existing files
python3 tools/fetch-images.py --only eqs-sedan g-class # just these models
python3 tools/fetch-images.py --width 1600             # larger images
python3 tools/fetch-images.py --source unsplash        # see below
```

### Choosing a source

| | `commons` (default) | `unsplash` |
| --- | --- | --- |
| Matches the right model | **Yes** — files are catalogued by chassis code (W206, X254, R232) | **No** — stock search, returns Mercedes photos but not reliably *that* model or year |
| Photograph quality | Mixed; car-spotter and press shots | **Excellent**, consistently well lit and composed |
| Licence | CC BY / BY-SA / CC0 / public domain, filtered | Unsplash License — free commercial use |
| Setup | none | free API key |

Use `commons` for a catalogue where each card names a specific car. Use `unsplash`
if you care more about how the page looks than about the GLC card showing an actual
GLC — and expect to hand-pick some replacements.

Unsplash needs a free key from <https://unsplash.com/developers>:

```sh
export UNSPLASH_ACCESS_KEY=your_access_key
python3 tools/fetch-images.py --source unsplash --force
```

The Unsplash path attributes every photographer in `CREDITS.md` with a referral
link and pings the API's download endpoint, both required by their API terms.

The script *searches* Commons per model rather than guessing at file paths, so it
self-corrects as Commons changes. It skips anything non-commercial, no-derivatives,
or too small, and won't hand the same photograph to two models. If a model resolves
to the wrong car, widen or reorder its `imageSearch` terms in `assets/js/models.js`
and re-run with `--only <id>`.

> **Not yet run against a live API.** The environment this was built in blocks
> `commons.wikimedia.org` and `unsplash.com` alike, so the parsers, licence filter,
> query building and failure handling are tested but no live fetch is. Expect to
> tune a few search terms on the first run.

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

### Deploying with photographs

Pages serves whatever is committed, so the images have to be in the repository:

```sh
python3 tools/fetch-images.py            # or --source unsplash
git add assets/img && git commit -m "Add model photographs" && git push
```

The push redeploys automatically. Until that happens the deployed site shows SVG
silhouettes — it is complete and navigable either way, just illustrated rather
than photographed.

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
