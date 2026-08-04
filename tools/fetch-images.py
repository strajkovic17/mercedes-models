#!/usr/bin/env python3
"""
Populate assets/img/ with real photographs of each model.

Photographs come from Wikimedia Commons, which is queried through its public
API — the script searches for each model rather than guessing at file paths, so
it self-corrects when Commons reorganises. Only freely-licensed files are kept,
and attribution for every downloaded image is written to assets/img/CREDITS.md.

    python3 tools/fetch-images.py              # fetch everything still missing
    python3 tools/fetch-images.py --force      # re-fetch, replacing existing
    python3 tools/fetch-images.py --only eqs-sedan g-class
    python3 tools/fetch-images.py --width 1600 # default 1400

Standard library only — no pip install. Needs unrestricted network access to
commons.wikimedia.org, so run it on your own machine.
"""

import argparse
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MODELS_JS = ROOT / 'assets' / 'js' / 'models.js'
IMG_DIR = ROOT / 'assets' / 'img'
CREDITS = IMG_DIR / 'CREDITS.md'

API = 'https://commons.wikimedia.org/w/api.php'
# Commons asks that automated clients identify themselves and stay polite.
UA = 'mercedes-models-site/1.0 (static site image fetcher; stdlib urllib)'
PAUSE = 0.4

# Licences we are willing to ship. Anything else (fair use, non-commercial,
# no-derivatives) is skipped rather than quietly downloaded.
OK_LICENCE = re.compile(
    r'^(cc[- ]?(by|by[- ]sa|zero|0)|public domain|pd|no restrictions)', re.I
)
BAD_LICENCE = re.compile(r'(non[- ]?commercial|no[- ]?deriv|fair use|\bnc\b|\bnd\b)', re.I)


def api(**params):
    """One Commons API call, returning parsed JSON."""
    params.setdefault('format', 'json')
    params.setdefault('formatversion', '2')
    url = API + '?' + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=45) as r:
        return json.load(r)


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


def file_info(title, width):
    """Metadata plus a scaled URL for one File: page, or None if unusable."""
    data = api(
        action='query', titles=title, prop='imageinfo',
        iiprop='url|size|extmetadata|mime', iiurlwidth=width,
    )
    pages = data.get('query', {}).get('pages', [])
    if not pages or 'imageinfo' not in pages[0]:
        return None
    info = pages[0]['imageinfo'][0]
    if info.get('mime') not in ('image/jpeg', 'image/png'):
        return None
    # Reject anything too small or portrait — these sit in 16:9 cards.
    w, h = info.get('width', 0), info.get('height', 1)
    if w < 900 or w / max(h, 1) < 1.2:
        return None

    meta = info.get('extmetadata', {})
    licence = meta.get('LicenseShortName', {}).get('value', '')
    if BAD_LICENCE.search(licence) or not OK_LICENCE.match(licence.strip()):
        return None

    artist = re.sub(r'<[^>]+>', '', meta.get('Artist', {}).get('value', '')).strip()
    return {
        'title': title,
        'url': info.get('thumburl') or info['url'],
        'descurl': info.get('descriptionurl', ''),
        'licence': licence,
        'artist': artist or 'Unknown',
    }


def download(url, dest):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=90) as r:
        data = r.read()
    if len(data) < 8000:
        raise ValueError(f'suspiciously small response ({len(data)} bytes)')
    dest.write_bytes(data)
    return len(data)


def fetch_one(model, width, seen):
    """Walk the model's search terms until one yields a usable photo."""
    for term in model['terms']:
        try:
            titles = search_files(term)
        except Exception as exc:
            print(f'    search failed for "{term}": {exc}')
            continue
        for title in titles:
            if title in seen:
                continue  # don't give two models the same photograph
            time.sleep(PAUSE)
            try:
                info = file_info(title, width)
            except Exception as exc:
                print(f'    metadata failed for {title}: {exc}')
                continue
            if not info:
                continue
            dest = IMG_DIR / f"{model['id']}.jpg"
            try:
                size = download(info['url'], dest)
            except Exception as exc:
                print(f'    download failed for {title}: {exc}')
                continue
            seen.add(title)
            print(f"    ✓ {size // 1024} KB — {title}  [{info['licence']}]")
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
    args = ap.parse_args()

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
    print(f'Fetching photographs for {len(models)} model(s) into {IMG_DIR}\n')

    credits, seen, missed = {}, set(), []
    for i, model in enumerate(models, 1):
        dest = IMG_DIR / f"{model['id']}.jpg"
        print(f"[{i}/{len(models)}] {model['name']}")
        if dest.exists() and not args.force:
            print('    already present, skipping (use --force to replace)')
            continue
        info = fetch_one(model, args.width, seen)
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
        print('\nTry widening that model\'s imageSearch terms in assets/js/models.js.')


if __name__ == '__main__':
    main()
