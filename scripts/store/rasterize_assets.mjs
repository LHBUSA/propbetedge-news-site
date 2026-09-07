#!/usr/bin/env node
/**
 * Rasterise the vector print files to production PNGs.
 *
 *   node scripts/store/rasterize_assets.mjs
 *   node scripts/store/rasterize_assets.mjs --areas areas.json
 *
 * Printful accepts PNG and JPG for print files, not SVG, so the vector files
 * are the source of truth and these are what actually gets handed to the
 * printer.
 *
 * Rendered through headless Chrome rather than a pure SVG library for one
 * reason that matters to the result: the artwork is set in Playfair Display
 * and JetBrains Mono, and a rasteriser without those fonts silently
 * substitutes Georgia and Courier. The type would still be legible and it
 * would not be our brand. Chrome fetches the real faces and waits for them.
 *
 * Transparency is preserved with omitBackground. A print file with a white
 * rectangle behind it prints a white rectangle.
 *
 * Print-area dimensions: the defaults below are Printful's usual DTG area,
 * but --areas accepts a JSON map written by the live canary so the real
 * per-product dimensions win over an assumption. Aspect ratio is always
 * preserved; the artwork is fitted, never stretched.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIR = path.join(ROOT, 'public', 'store', 'print');

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };

/* Defaults, used only when the live catalog has not told us otherwise. Every
 * one of these is an assumption and is labelled as such in the output. */
const DEFAULT_AREAS = {
  apparel: { w: 1800, h: 2400 },
  cap: { w: 1200, h: 600 },
  mug: { w: 2475, h: 1155 },
};

/* Which area each file belongs to.
 *
 * Matched on the source viewBox exactly, not on aspect ratio. Ratio matching
 * looked reasonable and was wrong: the mug wrap is 2475x1155, a ratio of
 * 2.14, which fell inside a tolerance around the cap's 2.0 and rendered every
 * mug at cap dimensions. That is precisely the silent stretching this script
 * is supposed to prevent, and it was invisible in the output until the
 * numbers were read back. Exact dimensions cannot drift that way. */
function areaOf(svg, areas) {
  const m = /viewBox="0 0 (\d+) (\d+)"/.exec(svg);
  if (!m) return null;
  const w = Number(m[1]), h = Number(m[2]);
  for (const [key, a] of Object.entries(areas)) {
    if (a.w === w && a.h === h) return key;
  }
  /* Unrecognised source dimensions are a failure, not something to round to
   * the nearest known area. */
  return null;
}

/* PNG carries physical resolution in a pHYs chunk: pixels per metre, plus a
 * unit byte. Inserted immediately before IDAT, with its own CRC, because a
 * chunk with a wrong CRC is worse than no chunk at all. */
function setPngDpi(file, dpi) {
  const buf = fs.readFileSync(file);
  if (buf.includes(Buffer.from('pHYs'))) return;
  const ppm = Math.round(dpi / 0.0254);
  const data = Buffer.alloc(9);
  data.writeUInt32BE(ppm, 0);
  data.writeUInt32BE(ppm, 4);
  data.writeUInt8(1, 8);                    // unit: metre
  const type = Buffer.from('pHYs');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(9, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([type, data])) >>> 0, 0);
  const idat = buf.indexOf(Buffer.from('IDAT'));
  const at = idat - 4;                      // start of the IDAT length field
  fs.writeFileSync(file, Buffer.concat([buf.subarray(0, at), len, type, data, crc, buf.subarray(at)]));
}

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const main = async () => {
  const areasPath = opt('--areas');
  const areas = { ...DEFAULT_AREAS };
  let areasSource = 'defaults (assumed; pass --areas from the live canary to override)';
  if (areasPath && fs.existsSync(areasPath)) {
    Object.assign(areas, JSON.parse(fs.readFileSync(areasPath, 'utf8')));
    areasSource = `live catalog via ${areasPath}`;
  }
  console.log(`print areas: ${areasSource}\n`);

  const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.svg'));
  if (!files.length) {
    console.error('No SVG sources in public/store/print/. Run build_assets.mjs first.');
    process.exit(2);
  }

  let chromium;
  try {
    ({ chromium } = await import('playwright-core'));
  } catch {
    console.error('playwright-core is required to rasterise. Install it, or render the SVGs to PNG with any tool that preserves transparency and embeds the brand fonts.');
    process.exit(2);
  }

  const browser = await chromium.launch({ channel: 'chrome' });
  const results = [];

  for (const f of files) {
    const svg = fs.readFileSync(path.join(DIR, f), 'utf8');
    /* Against the MERGED areas, not the defaults. Passing --areas and then
     * matching against the built-in table meant a file authored at a live
     * area was skipped as unrecognised — the override was accepted and then
     * ignored, which is the worst of both. */
    const key = areaOf(svg, areas);
    if (!key) {
      console.log(`  SKIP ${f} — its viewBox matches no known print area; add the area rather than guessing`);
      continue;
    }
    const { w, h } = areas[key];

    /* The SVG is placed in a page sized exactly to the print area and scaled
     * to fit, so the output matches the area's aspect ratio without the
     * artwork being stretched to reach it. */
    const html = `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=JetBrains+Mono:wght@500;700&display=block" rel="stylesheet">
<style>
  html,body{margin:0;padding:0;background:transparent}
  #a{width:${w}px;height:${h}px;display:flex;align-items:center;justify-content:center;overflow:hidden}
  #a svg{width:100%;height:100%;object-fit:contain}
</style></head><body><div id="a">${svg}</div></body></html>`;

    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'load' });
    /* Wait for the real faces; otherwise the first paint uses fallbacks. */
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(250);

    const out = f.replace(/\.svg$/, '.png');
    await page.locator('#a').screenshot({ path: path.join(DIR, out), omitBackground: true });
    await page.close();

    /* Physical resolution, so a printer reading the file sees the density it
     * was rendered for rather than assuming 72. Chrome writes no pHYs chunk,
     * so it is inserted afterwards. */
    const dpi = areas[key]?.dpi ?? null;
    if (dpi) setPngDpi(path.join(DIR, out), dpi);

    const bytes = fs.statSync(path.join(DIR, out)).size;
    results.push({ out, w, h, key, bytes, dpi });
    console.log(`  ${out.padEnd(38)} ${String(w).padStart(4)}x${String(h).padStart(4)}  ${key.padEnd(8)} ${dpi ? `${dpi}dpi` : '  -   '}  ${(bytes / 1024).toFixed(0)} KB`);
  }

  await browser.close();

  /* Transparency check: a print file that lost its alpha is worse than one
   * that failed to render, because it looks fine until it is printed. */
  let opaque = 0;
  for (const r of results) {
    const buf = fs.readFileSync(path.join(DIR, r.out));
    /* PNG colour type lives at byte 25 of the IHDR; 6 is RGBA, 4 is
     * grey+alpha. Anything else has no alpha channel at all. */
    const colorType = buf[25];
    if (colorType !== 6 && colorType !== 4) { opaque += 1; console.log(`  WARNING ${r.out} has no alpha channel (colour type ${colorType})`); }
  }

  console.log(`\n${results.length} PNGs written to public/store/print/`);
  console.log(opaque ? `${opaque} file(s) lost transparency — do not hand those to Printful.` : 'All files carry an alpha channel.');
  console.log('\nThese must be deployed and returning 200 before the canary hands their URLs to Printful.');
};

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
