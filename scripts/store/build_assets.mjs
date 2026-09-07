#!/usr/bin/env node
/**
 * Production print files for the PropBetEdge collection.
 *
 *   node scripts/store/build_assets.mjs
 *
 * Writes transparent SVG print files to public/store/print/. Vector, so the
 * same file is correct at any print size and there is no resampling to argue
 * about later.
 *
 * Two constraints drive every choice here.
 *
 * A print file is not a mockup. It carries the artwork alone on transparency,
 * at the aspect ratio of the print area, with no garment, no background and
 * no shadow. Anything else gets printed literally.
 *
 * The art has to survive one colour of ink on cloth. That rules out
 * gradients, thin hairlines and tight counters, so the marks below are built
 * from solid shapes and generous strokes, and the type is set large enough
 * that a 2XL and an S both read.
 *
 * Design language follows the brand: gold on dark, restrained, data-native.
 * No dice, no cards, no money, no flames.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = path.join(ROOT, 'public', 'store', 'print');
fs.mkdirSync(OUT, { recursive: true });

/* Print areas, in the proportions Printful uses. The DTG apparel area is
 * roughly 12x16in; embroidery and mug wraps are their own shapes. */
/* VERIFIED against the live Printful catalog on 2026-09-07, not assumed.
 * The previous mug and cap figures were guesses and both were wrong.
 *
 *   apparel  1800x2400 @150  Bella+Canvas 3001 (71), placement "front"
 *   hoodie   2100x2100 @150  Gildan 18500 (146), placement "front" — SQUARE,
 *                            which is why the hoodie cannot share the tee's
 *                            portrait file
 *   mug      2700x1050 @300  White Glossy Mug (19), placement "default"
 *   cap      UNVERIFIED      the blank is not resolved; see BASE_PRODUCTS.
 *                            The dad-hat family reports 1650x600 @300, but
 *                            until one product is chosen this stays a guess
 *                            and no cap art is regenerated against it. */
const AREA = {
  apparel: { w: 1800, h: 2400, dpi: 150 },
  hoodie: { w: 2100, h: 2100, dpi: 150 },
  mug: { w: 2700, h: 1050, dpi: 300 },
  cap: { w: 1200, h: 600, dpi: 300 },  // UNVERIFIED, and matches no live area
};

/* One ink colour per file. Gold for dark garments, ink for light ones, so a
 * light colourway is a separate file rather than an unreadable compromise. */
const GOLD = '#D4AF37';
const INK = '#14110D';

const svg = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none">\n${body}\n</svg>\n`;

/* The house mark: an octagon ring with a centre node. The octagon is the
 * sport; the node is the data layer. Stroke is heavy enough to embroider. */
function mark(cx, cy, r, color, stroke = Math.max(6, r * 0.12)) {
  const pts = [];
  for (let i = 0; i < 8; i += 1) {
    const a = (Math.PI / 4) * i + Math.PI / 8;
    pts.push(`${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`);
  }
  return `  <polygon points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linejoin="round"/>
  <circle cx="${cx}" cy="${cy}" r="${r * 0.17}" fill="${color}"/>`;
}

/* Type is centred and letter-spaced. The serif is named with a full fallback
 * chain because the renderer that rasterises this may not have Playfair. */
const SERIF = "Playfair Display, Georgia, 'Times New Roman', serif";
const MONO = "JetBrains Mono, ui-monospace, 'Courier New', monospace";

function lines(text, maxChars = 18) {
  const words = String(text).split(/\s+/);
  const out = [];
  let cur = '';
  for (const w of words) {
    if ((`${cur} ${w}`).trim().length > maxChars && cur) { out.push(cur.trim()); cur = w; }
    else cur = `${cur} ${w}`;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/* A slogan tee: the line, set large, with a hairline rule and the wordmark
 * beneath it so the shirt still reads as ours without a logo slab. */
function sloganPrint(text, color) {
  const { w, h } = AREA.apparel;
  const ls = lines(text, 17);
  const size = ls.length > 2 ? 190 : 230;
  const lead = size * 1.16;
  const blockH = ls.length * lead;
  const top = h / 2 - blockH / 2;
  const body = [
    `  <g font-family="${SERIF}" font-size="${size}" fill="${color}" text-anchor="middle">`,
    ...ls.map((l, i) => `    <text x="${w / 2}" y="${(top + lead * (i + 0.78)).toFixed(0)}">${escapeXml(l)}</text>`),
    '  </g>',
    `  <rect x="${w / 2 - 210}" y="${(top + blockH + 78).toFixed(0)}" width="420" height="5" fill="${color}" opacity="0.75"/>`,
    `  <text x="${w / 2}" y="${(top + blockH + 200).toFixed(0)}" font-family="${MONO}" font-size="62" letter-spacing="14" fill="${color}" opacity="0.85" text-anchor="middle">PROPBETEDGE</text>`,
  ].join('\n');
  return svg(w, h, body);
}

function wordmarkPrint(color) {
  const { w, h } = AREA.apparel;
  const cy = h / 2 - 150;
  const body = [
    mark(w / 2, cy, 300, color, 30),
    `  <text x="${w / 2}" y="${cy + 560}" font-family="${SERIF}" font-size="210" fill="${color}" text-anchor="middle">PropBetEdge</text>`,
    `  <text x="${w / 2}" y="${cy + 690}" font-family="${MONO}" font-size="62" letter-spacing="18" fill="${color}" opacity="0.8" text-anchor="middle">SPORTS INTELLIGENCE</text>`,
  ].join('\n');
  return svg(w, h, body);
}

/* The hoodie front is square, and a portrait lockup letterboxed into a square
 * would sit small with dead space either side. So the same elements are
 * composed for the area rather than fitted to it: identical proportions
 * between mark, wordmark and strapline, scaled to the square and centred as
 * one block. Nothing is stretched and nothing is cropped.
 *
 * Kept separate from wordmarkPrint on purpose — the tee's composition is
 * verified against its live area and must not shift because the hoodie
 * needed a different shape. */
function wordmarkSquarePrint(color, area) {
  const { w, h } = area;
  const s = Math.min(w, h) / 1800;
  const r = 300 * s;
  /* Block runs from the top of the mark to the strapline's descender; centre
   * that, rather than centring the mark and letting the type hang low. */
  const top = -r;
  const bottom = 715 * s;
  const y0 = h / 2 - (top + bottom) / 2;
  const body = [
    mark(w / 2, y0, r, color, 30 * s),
    `  <text x="${w / 2}" y="${(y0 + 560 * s).toFixed(0)}" font-family="${SERIF}" font-size="${(210 * s).toFixed(0)}" fill="${color}" text-anchor="middle">PropBetEdge</text>`,
    `  <text x="${w / 2}" y="${(y0 + 690 * s).toFixed(0)}" font-family="${MONO}" font-size="${(62 * s).toFixed(0)}" letter-spacing="${(18 * s).toFixed(0)}" fill="${color}" opacity="0.8" text-anchor="middle">SPORTS INTELLIGENCE</text>`,
  ].join('\n');
  return svg(w, h, body);
}

function fightDnaPrint(color) {
  const { w, h } = AREA.apparel;
  const cx = w / 2, cy = h / 2 - 120;
  /* A double helix read as two opposing arcs through the octagon: the sport
   * and the data, drawn as one object rather than a logo beside a graphic. */
  const rungs = [];
  for (let i = 0; i < 7; i += 1) {
    const t = i / 6;
    const y = cy - 300 + t * 600;
    const dx = Math.sin(t * Math.PI * 2) * 150;
    rungs.push(`  <line x1="${(cx - dx).toFixed(1)}" y1="${y.toFixed(1)}" x2="${(cx + dx).toFixed(1)}" y2="${y.toFixed(1)}" stroke="${color}" stroke-width="16" stroke-linecap="round" opacity="0.9"/>`);
  }
  const helix = (sign) => {
    const pts = [];
    for (let i = 0; i <= 40; i += 1) {
      const t = i / 40;
      const y = cy - 300 + t * 600;
      const x = cx + sign * Math.sin(t * Math.PI * 2) * 150;
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return `  <polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>`;
  };
  const body = [
    mark(cx, cy, 420, color, 26),
    helix(1), helix(-1), ...rungs,
    `  <text x="${cx}" y="${cy + 700}" font-family="${SERIF}" font-size="200" fill="${color}" text-anchor="middle">Fight DNA</text>`,
    `  <text x="${cx}" y="${cy + 820}" font-family="${MONO}" font-size="56" letter-spacing="16" fill="${color}" opacity="0.8" text-anchor="middle">EVIDENCE, NOT TAKES</text>`,
  ].join('\n');
  return svg(w, h, body);
}

function capPrint(color) {
  const { w, h } = AREA.cap;
  /* Embroidery: mark plus wordmark, nothing thinner than the needle can hold. */
  const body = [
    mark(w / 2 - 300, h / 2, 150, color, 26),
    `  <text x="${w / 2 + 90}" y="${h / 2 + 52}" font-family="${SERIF}" font-size="150" fill="${color}" text-anchor="middle">PropBetEdge</text>`,
  ].join('\n');
  return svg(w, h, body);
}

function mugPrint(text, color) {
  const { w, h } = AREA.mug;
  /* Wrap art sits on the right half so it faces a right-handed drinker. */
  const cx = w * 0.72;
  const ls = lines(text, 16);
  const size = 150;
  const lead = size * 1.2;
  const top = h / 2 - (ls.length * lead) / 2;
  const body = text
    ? [
        `  <g font-family="${SERIF}" font-size="${size}" fill="${color}" text-anchor="middle">`,
        ...ls.map((l, i) => `    <text x="${cx}" y="${(top + lead * (i + 0.78)).toFixed(0)}">${escapeXml(l)}</text>`),
        '  </g>',
        `  <text x="${cx}" y="${(top + ls.length * lead + 120).toFixed(0)}" font-family="${MONO}" font-size="48" letter-spacing="12" fill="${color}" opacity="0.85" text-anchor="middle">PROPBETEDGE</text>`,
      ].join('\n')
    : [
        mark(cx, h / 2 - 40, 190, color, 22),
        `  <text x="${cx}" y="${h / 2 + 300}" font-family="${SERIF}" font-size="150" fill="${color}" text-anchor="middle">PropBetEdge</text>`,
      ].join('\n');
  return svg(w, h, body);
}

const escapeXml = (s) => String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));

/* Each entry maps a catalog slug to the print files it needs. A dark and a
 * light variant where the garment comes in both, because one ink colour
 * cannot serve both and compromising would ruin each. */
export const ASSETS = [
  { file: 'propbetedge-wordmark-gold.svg', area: 'apparel', svg: () => wordmarkPrint(GOLD), use: 'dark garments' },
  { file: 'propbetedge-wordmark-ink.svg', area: 'apparel', svg: () => wordmarkPrint(INK), use: 'light garments' },
  { file: 'fight-dna-gold.svg', area: 'apparel', svg: () => fightDnaPrint(GOLD), use: 'dark garments' },
  { file: 'fight-dna-ink.svg', area: 'apparel', svg: () => fightDnaPrint(INK), use: 'light garments' },
  { file: 'trust-the-data-gold.svg', area: 'apparel', svg: () => sloganPrint('Trust the Data. Question the Price.', GOLD), use: 'dark garments' },
  { file: 'trust-the-data-ink.svg', area: 'apparel', svg: () => sloganPrint('Trust the Data. Question the Price.', INK), use: 'light garments' },
  { file: 'no-vibes-gold.svg', area: 'apparel', svg: () => sloganPrint('No Vibes. Just Variance.', GOLD), use: 'dark garments' },
  { file: 'no-vibes-ink.svg', area: 'apparel', svg: () => sloganPrint('No Vibes. Just Variance.', INK), use: 'light garments' },
  { file: 'my-model-said-no-gold.svg', area: 'apparel', svg: () => sloganPrint('My Model Said No.', GOLD), use: 'dark garments' },
  { file: 'my-model-said-no-ink.svg', area: 'apparel', svg: () => sloganPrint('My Model Said No.', INK), use: 'light garments' },
  { file: 'fight-dna-over-takes-gold.svg', area: 'apparel', svg: () => sloganPrint('Fight DNA > Fight Takes.', GOLD), use: 'dark garments' },
  { file: 'fight-dna-over-takes-ink.svg', area: 'apparel', svg: () => sloganPrint('Fight DNA > Fight Takes.', INK), use: 'light garments' },
  { file: 'propbetedge-wordmark-gold-hoodie.svg', area: 'hoodie', svg: () => wordmarkSquarePrint(GOLD, AREA.hoodie), use: 'hoodie front, dark' },
  { file: 'propbetedge-wordmark-ink-hoodie.svg', area: 'hoodie', svg: () => wordmarkSquarePrint(INK, AREA.hoodie), use: 'hoodie front, light' },
  { file: 'cap-mark-gold.svg', area: 'cap', svg: () => capPrint(GOLD), use: 'embroidery, dark caps — AREA UNVERIFIED' },
  { file: 'mug-wordmark-ink.svg', area: 'mug', svg: () => mugPrint(null, INK), use: 'white mug' },
  { file: 'mug-spreadsheet-ink.svg', area: 'mug', svg: () => mugPrint('I Have A Spreadsheet For This.', INK), use: 'white mug' },
];

const main = () => {
  let bytes = 0;
  for (const a of ASSETS) {
    const content = a.svg();
    fs.writeFileSync(path.join(OUT, a.file), content, 'utf8');
    bytes += Buffer.byteLength(content);
    const { w, h } = AREA[a.area];
    console.log(`  ${a.file.padEnd(34)} ${String(w).padStart(4)}x${String(h).padStart(4)}  ${a.use}`);
  }
  console.log(`\n${ASSETS.length} print files -> public/store/print/ (${(bytes / 1024).toFixed(1)} KB total)`);
  console.log('Vector and transparent. Printful fetches print files by URL, so these must be deployed first.');
  console.log('');
  console.log('NEXT STEP, and it is required: Printful accepts PNG and JPG, not SVG.');
  console.log('Rasterise each file to PNG over its print area (apparel 1800x2400 @150,');
  console.log('hoodie 2100x2100 @150, mug 2700x1050 @300) on transparency. The cap area is');
  console.log('still unverified because the blank is unresolved, so its file is not production art.');
  console.log('SVG is the right source of truth and the wrong thing to hand a printer.');
};

if (process.argv[1] && process.argv[1].endsWith('build_assets.mjs')) main();
