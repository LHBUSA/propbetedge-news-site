"""Builds the /pro (All Access) responsive image derivatives.

Originals live in assets-src/pro/ (never served; see assets-src/pro/PROVENANCE.md).
Derivatives are written to public/pro/ as AVIF + WebP at fixed widths and are
committed, so the Vite build never depends on an image toolchain.

    python scripts/build-pro-art.py

Requires Pillow >= 11.2 with AVIF support (PIL.features.check('avif')).
"""
from pathlib import Path
from PIL import Image, features

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets-src' / 'pro'
OUT = ROOT / 'public' / 'pro'

# name -> (source file, crop box or None, widths)
# hero-m is the phone crop of the hero: the stadium bowl and skyline, 4:3.
JOBS = {
    'hero':        ('all-access-hero.png',     None,                    (960, 1600)),
    'hero-m':      ('all-access-hero.png',     (520, 77, 1672, 941),    (640, 960)),
    'network':     ('network-overview.png',    None,                    (640, 1086)),
    'compare':     ('compare-market.png',      None,                    (640, 960, 1600)),
    'predictions': ('predictions-models.png',  None,                    (640, 960, 1600)),
    'ufc':         ('ufc-intelligence.png',    None,                    (640, 1122)),
    'tennis':      ('tennis-intelligence.png', None,                    (640, 1122)),
}


def main():
    assert features.check('avif'), 'Pillow was built without AVIF support'
    OUT.mkdir(parents=True, exist_ok=True)
    for name, (file, box, widths) in JOBS.items():
        im = Image.open(SRC / file).convert('RGB')
        if box:
            im = im.crop(box)
        for w in widths:
            w = min(w, im.width)
            h = round(im.height * w / im.width)
            r = im.resize((w, h), Image.LANCZOS)
            r.save(OUT / f'{name}-{w}.avif', quality=58, speed=4)
            r.save(OUT / f'{name}-{w}.webp', quality=78, method=6)
            print(f'{name}-{w}  {w}x{h}  avif {(OUT / f"{name}-{w}.avif").stat().st_size // 1024} KB'
                  f'  webp {(OUT / f"{name}-{w}.webp").stat().st_size // 1024} KB')


if __name__ == '__main__':
    main()
