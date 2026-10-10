# Site background photographs — provenance

Two Unsplash photographs that were hot-linked from `images.unsplash.com` as the
full-page atmosphere behind the site (`body::before`). They are now self-hosted
(owner rule: self-host art; Vercel bot challenges and third-party CDNs break
hot-links). These are the masters; they are **not served**.
`public/backgrounds/photo/*.avif|webp` are derived from them by
`python scripts/build-background-art.py`.

Licence: the Unsplash License (https://unsplash.com/license) — free to download,
copy, modify and use, including commercially, without permission or attribution.
They were served from `images.unsplash.com` (not Unsplash+, which is served from
`plus.unsplash.com` under a different licence). The site has never shown a credit
for them; none is required.

Downloaded 2026-10-10 from the same image IDs the CSS used, as a 2400 px JPEG
(`?w=2400&q=90&fm=jpg&fit=crop`), untouched.

| File | Scene | Unsplash image | Size | SHA-256 |
|---|---|---|---|---|
| network-night.jpg | `network` (the default scene) | `photo-1781650104690-a5309d91a26b` | 2400×1600 | 6058fa7b50c77052bf4b41cdda44bbfbb2a1d618a210d9b0c00b9fbc23b8a5a0 |
| wrigley-field.jpg | `wrigley` (the original Wrigley Field look) | `photo-1666366330282-b11566b272cf` | 2400×1800 | a0cec4f5392a35d3c5e50a75aa6ad02f28b3e5b6c1e0fec4bc859869c9026078 |
