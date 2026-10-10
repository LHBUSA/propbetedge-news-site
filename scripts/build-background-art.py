"""Builds the self-hosted site background photographs.

Masters live in assets-src/backgrounds/ (never served; see PROVENANCE.md there).
Derivatives are written to public/backgrounds/photo/ as AVIF + WebP and are
committed, so the Vite build never depends on an image toolchain.

    python scripts/build-background-art.py

Widths: 2200 (the size the hot-linked CSS requested) for screens wider than
720px, 1280 for phones, 640 for the scene-selector preview cards. The photos are
painted at 26-35% opacity under colour filters, so AVIF q50 / WebP q70 match the
previously served Unsplash files (AVIF q~72) on screen at about half the bytes.

Requires Pillow >= 11.2 with AVIF support (PIL.features.check('avif')).
"""
from pathlib import Path
from PIL import Image, features

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets-src' / 'backgrounds'
OUT = ROOT / 'public' / 'backgrounds' / 'photo'

JOBS = {
    'network-night': ('network-night.jpg', (640, 1280, 2200)),
    'wrigley-field': ('wrigley-field.jpg', (640, 1280, 2200)),
}


def main():
    assert features.check('avif'), 'Pillow was built without AVIF support'
    OUT.mkdir(parents=True, exist_ok=True)
    for name, (file, widths) in JOBS.items():
        im = Image.open(SRC / file).convert('RGB')
        for w in widths:
            h = round(im.height * w / im.width)
            r = im.resize((w, h), Image.LANCZOS)
            r.save(OUT / f'{name}-{w}.avif', quality=50, speed=4)
            r.save(OUT / f'{name}-{w}.webp', quality=70, method=6)
            print(f'{name}-{w}  {w}x{h}  avif {(OUT / f"{name}-{w}.avif").stat().st_size // 1024} KB'
                  f'  webp {(OUT / f"{name}-{w}.webp").stat().st_size // 1024} KB')


if __name__ == '__main__':
    main()
