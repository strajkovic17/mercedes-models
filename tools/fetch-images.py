#!/usr/bin/env python3
"""
Populate assets/img/ with real photographs of each model.

Two sources, chosen with --source:

  commons   (default) Wikimedia Commons. Files are catalogued by chassis code
            — W206, X254, R232 — so a search reliably returns the RIGHT car.
            Only free licences are kept (CC BY/BY-SA/CC0/public domain).

  unsplash  Unsplash. Far better photography, but it is stock: searching
            "Mercedes-Benz GLC" returns attractive Mercedes photos, not
            necessarily a GLC, and never a specific model year. Good for
            atmosphere, unreliable for a catalogue that names each car.
            Needs a free API key in UNSPLASH_ACCESS_KEY.

    python3 tools/fetch-images.py                      # commons, missing only
    python3 tools/fetch-images.py --source unsplash
    python3 tools/fetch-images.py --force              # replace existing
    python3 tools/fetch-images.py --only eqs-sedan g-class
    python3 tools/fetch-images.py --width 1600         # default 1400

Attribution for everything downloaded is written to assets/img/CREDITS.md.
Standard library only — no pip install. Needs unrestricted network access, so
run it on your own machine.
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MODELS_JS = ROOT / 'assets' / 'js' / 'models.js'
IMG_DIR = ROOT / 'assets' / 'img'
CREDITS = IMG_DIR / 'CREDITS.md'

API = 'https://commons.wikimedia.org/w/api.php'
UNSPLASH_API = 'https://api.unsplash.com'
# Unsplash requires the app name on attribution links it sends traffic through.
UTM = 'utm_source=mercedes_models_site&utm_medium=referral'
# Commons asks that automated clients identify themselves and stay polite.
UA = ('mercedes-models-site/1.0 '
      '(+https://github.com/strajkovic17/mercedes-models; image fetcher)')
# Wikimedia and Unsplash both throttle hard from shared CI addresses, so every
# request goes through one global pacer rather than a sleep at the call site.
MIN_INTERVAL = 1.1
MAX_RETRIES = 5
_last_request = 0.0

# Licences we are willing to ship. Anything else (fair use, non-commercial,
# no-derivatives) is skipped rather than quietly downloaded.
OK_LICENCE = re.compile(
    r'^(cc[- ]?(by|by[- ]sa|zero|0)|public domain|pd|no restrictions)', re.I
)
BAD_LICENCE = re.compile(r'(non[- ]?commercial|no[- ]?deriv|fair use|\bnc\b|\bnd\b)', re.I)


def _pace():
    """Keep at least MIN_INTERVAL between any two outbound requests."""
    global _last_request
    wait = MIN_INTERVAL - (time.monotonic() - _last_request)
    if wait > 0:
        time.sleep(wait)
    _last_request = time.monotonic()


def _open(url, headers=None, timeout=45):
    """
    One request, retrying on the throttling and transient statuses.

    429 is the norm rather than the exception from CI addresses: Wikimedia
    rate-limits shared runner IPs hard. Retry-After is honoured when sent,
    otherwise back off exponentially.
    """
    hdrs = {'User-Agent': UA}
    hdrs.update(headers or {})
    delay = 2.0
    for attempt in range(1, MAX_RETRIES + 1):
        _pace()
        try:
            return urllib.request.urlopen(
                urllib.request.Request(url, headers=hdrs), timeout=timeout
            ).read()
        except urllib.error.HTTPError as exc:
            if exc.code not in (429, 503, 502, 504) or attempt == MAX_RETRIES:
                raise
            retry_after = exc.headers.get('Retry-After') if exc.headers else None
            try:
                pause = float(retry_after) if retry_after else delay
            except ValueError:
                pause = delay
            pause = min(max(pause, 1.0), 60.0)
            print(f'    throttled ({exc.code}), waiting {pause:.0f}s '
                  f'[attempt {attempt}/{MAX_RETRIES}]')
            time.sleep(pause)
            delay = min(delay * 2, 60.0)
    raise RuntimeError('unreachable')


def get_json(url, headers=None):
    """GET a URL and parse JSON, with our User-Agent and retry policy applied."""
    return json.loads(_open(url, headers))


def api(**params):
    """One Commons API call, returning parsed JSON."""
    params.setdefault('format', 'json')
    params.setdefault('formatversion', '2')
    return get_json(API + '?' + urllib.parse.urlencode(params))


def parse_models():
    """
    Pull id / name / imageSearch out of models.js.

    Parsing JS with regex is normally a bad idea; it is acceptable here only
    because this reads three flat string fields from a file in the same repo,
    written in a known shape. If models.js is reformatted, fix this.
    """
    src = MODELS_JS.read_text(encoding='utf-8')
    out = []
    for block in re.finditer(
        r"id: '([^']+)',\s*\n\s*name: '((?:[^'\\]|\\.)*)',", src
    ):
        mid, name = block.group(1), block.group(2).replace("\\'", "'")
        tail = src[block.end():block.end() + 6000]
        terms = re.search(r'imageSearch: \[([^\]]*)\]', tail)
        if not terms:
            continue
        parsed = [t.replace("\\'", "'") for t in re.findall(r"'((?:[^'\\]|\\.)*)'", terms.group(1))]
        out.append({'id': mid, 'name': name, 'terms': parsed})
    return out


def search_files(term, limit=14):
    """File-namespace search on Commons, newest-relevance first."""
    data = api(
        action='query', list='search', srsearch=f'{term} filetype:bitmap',
        srnamespace=6, srlimit=limit,
    )
    return [hit['title'] for hit in data.get('query', {}).get('search', [])]


def files_info(titles, width):
    """
    Metadata for many File: pages in ONE request.

    Asking per-title was the whole problem: ~15 requests per model got the run
    throttled into uselessness. The API takes up to 50 piped titles at a time,
    which turns a model into two requests — one search, one metadata batch.
    """
    if not titles:
        return {}
    data = api(
        action='query', titles='|'.join(titles[:50]), prop='imageinfo',
        iiprop='url|size|extmetadata|mime', iiurlwidth=width,
    )
    out = {}
    for page in data.get('query', {}).get('pages', []):
        if page.get('missing') or 'imageinfo' not in page:
            continue
        info = page['imageinfo'][0]
        if info.get('mime') not in ('image/jpeg', 'image/png'):
            continue
        # Reject anything too small or portrait — these sit in 16:9 cards.
        w, h = info.get('width', 0), info.get('height', 1)
        if w < 900 or w / max(h, 1) < 1.2:
            continue

        meta = info.get('extmetadata', {})
        licence = meta.get('LicenseShortName', {}).get('value', '').strip()
        if BAD_LICENCE.search(licence) or not OK_LICENCE.match(licence):
            continue

        artist = re.sub(r'<[^>]+>', '', meta.get('Artist', {}).get('value', '')).strip()
        out[page['title']] = {
            'title': page['title'],
            'url': info.get('thumburl') or info['url'],
            'descurl': info.get('descriptionurl', ''),
            'licence': licence,
            'artist': artist or 'Unknown',
        }
    return out


def download(url, dest):
    data = _open(url, timeout=90)
    if len(data) < 8000:
        raise ValueError(f'suspiciously small response ({len(data)} bytes)')
    dest.write_bytes(data)
    return len(data)


def commons_candidates(term, width):
    """Candidate photos from Wikimedia Commons for one search term."""
    titles = search_files(term)
    infos = files_info(titles, width)
    out = []
    for title in titles:                 # keep the search's relevance order
        info = infos.get(title)
        if info:
            info['key'] = title
            info['source'] = 'Wikimedia Commons'
            out.append(info)
    return out


def unsplash_terms(model):
    """
    Unsplash queries built from the model's NAME, not its chassis code.
    Nobody tags a stock photo "S206", so the Commons terms are useless here.
    """
    name = model['name']
    # Names like "Mercedes-AMG GT Coupe" already carry the marque; only the
    # bare ones ("GLC SUV", "EQS Sedan") need it prepended.
    if name.startswith('Mercedes'):
        terms = [name, ' '.join(name.split()[:2])]
    else:
        terms = [f'Mercedes-Benz {name}', f'Mercedes-Benz {name.split()[0]}']
    terms.append('Mercedes-Benz car')
    seen, ordered = set(), []
    for t in terms:
        if t not in seen:
            seen.add(t)
            ordered.append(t)
    return ordered


def unsplash_candidates(term, width):
    """
    Candidate photos from Unsplash for one search term.

    Everything on Unsplash is under the Unsplash License (free commercial use,
    no permission needed), so there is no licence filtering to do — but the API
    terms require attribution and a download-endpoint ping, both handled here.
    """
    key = os.environ.get('UNSPLASH_ACCESS_KEY', '').strip()
    if not key:
        raise RuntimeError(
            'UNSPLASH_ACCESS_KEY is not set — register a free app at '
            'https://unsplash.com/developers and export the Access Key'
        )
    q = urllib.parse.urlencode({
        'query': term, 'per_page': 12, 'orientation': 'landscape',
        'content_filter': 'high',
    })
    data = get_json(f'{UNSPLASH_API}/search/photos?{q}',
                    headers={'Authorization': f'Client-ID {key}',
                             'Accept-Version': 'v1'})
    out = []
    for photo in data.get('results', []):
        if photo.get('width', 0) < 900:
            continue
        user = photo.get('user') or {}
        name = user.get('name') or 'Unknown'
        profile = f"{user.get('links', {}).get('html', '')}?{UTM}"
        # raw + w= lets us request exactly the width we want.
        raw = (photo.get('urls') or {}).get('raw', '')
        out.append({
            'key': photo['id'],
            'title': (photo.get('description')
                      or photo.get('alt_description') or photo['id'])[:90],
            'url': f'{raw}&w={width}&fm=jpg&q=85' if raw else photo['urls']['regular'],
            'descurl': f"{photo.get('links', {}).get('html', '')}?{UTM}",
            'licence': 'Unsplash License',
            'artist': f'{name} ({profile})',
            'source': 'Unsplash',
            'download_location': (photo.get('links') or {}).get('download_location', ''),
        })
    return out


def unsplash_ping_download(info):
    """
    Unsplash's API terms require hitting download_location when a photo is
    actually downloaded. It credits the photographer; skipping it is a TOS
    violation, so a failure here is reported rather than swallowed.
    """
    loc = info.get('download_location')
    if not loc:
        return
    key = os.environ.get('UNSPLASH_ACCESS_KEY', '').strip()
    try:
        get_json(loc, headers={'Authorization': f'Client-ID {key}'})
    except Exception as exc:
        print(f'    warning: download ping failed ({exc})')


def fetch_one(model, width, seen, source):
    """Walk the model's search terms until one yields a usable photo."""
    if source == 'unsplash':
        terms, produce = unsplash_terms(model), unsplash_candidates
    else:
        terms, produce = model['terms'], commons_candidates

    for term in terms:
        try:
            candidates = produce(term, width)
        except RuntimeError:
            raise  # missing API key — fatal, not worth retrying 36 times
        except Exception as exc:
            print(f'    search failed for "{term}": {exc}')
            continue
        for info in candidates:
            if info['key'] in seen:
                continue  # don't give two models the same photograph
            dest = IMG_DIR / f"{model['id']}.jpg"
            try:
                size = download(info['url'], dest)
            except Exception as exc:
                print(f"    download failed for {info['key']}: {exc}")
                continue
            if source == 'unsplash':
                unsplash_ping_download(info)
            seen.add(info['key'])
            print(f"    ✓ {size // 1024} KB — {info['title']}  [{info['licence']}]")
            return info
    return None


def write_credits(rows):
    lines = [
        '# Image credits', '',
        'Photographs fetched from Wikimedia Commons by `tools/fetch-images.py`.',
        'Each is reproduced under the licence named below; follow the link for the',
        'full terms and the original file page.', '',
        '| Model | Photographer | Licence | Source |',
        '| --- | --- | --- | --- |',
    ]
    for mid, info in sorted(rows.items()):
        art = info['artist'].replace('|', '/')[:70]
        lines.append(
            f"| `{mid}` | {art} | {info['licence']} | [{info['title']}]({info['descurl']}) |"
        )
    lines.append('')
    CREDITS.write_text('\n'.join(lines), encoding='utf-8')


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--force', action='store_true', help='re-fetch images that already exist')
    ap.add_argument('--only', nargs='+', metavar='ID', help='limit to these model ids')
    ap.add_argument('--width', type=int, default=1400, help='target width in pixels')
    ap.add_argument('--source', choices=('commons', 'unsplash'), default='commons',
                    help='where to fetch from (default: commons)')
    args = ap.parse_args()

    if args.source == 'unsplash':
        if not os.environ.get('UNSPLASH_ACCESS_KEY', '').strip():
            sys.exit(
                'UNSPLASH_ACCESS_KEY is not set.\n'
                'Register a free app at https://unsplash.com/developers, then:\n'
                '  export UNSPLASH_ACCESS_KEY=your_access_key'
            )
        print('Note: Unsplash is stock photography. It will return handsome\n'
              '      Mercedes photos, but not reliably the specific model or\n'
              '      model year named on each card. Check the results.\n')

    models = parse_models()
    if not models:
        sys.exit('Could not parse any models out of assets/js/models.js')
    if args.only:
        wanted = set(args.only)
        unknown = wanted - {m['id'] for m in models}
        if unknown:
            sys.exit(f"Unknown model id(s): {', '.join(sorted(unknown))}")
        models = [m for m in models if m['id'] in wanted]

    IMG_DIR.mkdir(parents=True, exist_ok=True)
    print(f'Fetching photographs for {len(models)} model(s) '
          f'from {args.source} into {IMG_DIR}\n')

    credits, seen, missed = {}, set(), []
    for i, model in enumerate(models, 1):
        dest = IMG_DIR / f"{model['id']}.jpg"
        print(f"[{i}/{len(models)}] {model['name']}")
        if dest.exists() and not args.force:
            print('    already present, skipping (use --force to replace)')
            continue
        try:
            info = fetch_one(model, args.width, seen, args.source)
        except RuntimeError as exc:
            sys.exit(f'\n{exc}')
        if info:
            credits[model['id']] = info
        else:
            missed.append(model['id'])
            print('    ✗ no suitable freely-licensed photo found')

    if credits:
        # Keep credits already on disk for models we skipped this run.
        write_credits(credits)
        print(f'\nWrote {CREDITS.relative_to(ROOT)} ({len(credits)} entries)')

    print(f'\nDone. {len(credits)} fetched, {len(missed)} missing.')
    if missed:
        print('Missing (the SVG silhouette will show for these):')
        for mid in missed:
            print(f'  - {mid}')
        if args.source == 'commons':
            print('\nTry widening that model\'s imageSearch terms in '
                  'assets/js/models.js,\nor retry with --source unsplash.')
        else:
            print('\nTry --source commons, which matches models far more '
                  'accurately.')


if __name__ == '__main__':
    main()
