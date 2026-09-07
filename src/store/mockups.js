/**
 * src/store/mockups.js
 *
 * Design previews, drawn as inline SVG from the brand tokens.
 *
 * These are explicitly NOT product photographs and are never labelled as
 * such. Printful generates real garment mockups from the uploaded artwork,
 * and those replace these the moment credentials exist. Shipping a
 * photo-realistic fake would imply a physical product we have never seen, on
 * a store that does not hold inventory, which is exactly the impression this
 * store must not create.
 *
 * Everything here is vector, so the collection page costs no image bandwidth
 * and stays sharp at any size.
 */
import { formatPrice } from './catalog.js';

const GOLD = '#d4af37';
const INK = '#14110d';
const INK2 = '#17130e';
const PAPER = '#f5f1eb';

/* The house mark: an octagon ring with a centre node, matching the network's
 * data-node motif without reusing a file this repo does not have. */
const mark = (fill, size = 26) => `
  <g transform="translate(0,0)">
    <polygon points="${octagon(size)}" fill="none" stroke="${fill}" stroke-width="2" opacity=".95"/>
    <circle cx="0" cy="0" r="${size * 0.16}" fill="${fill}"/>
  </g>`;

function octagon(r) {
  const pts = [];
  for (let i = 0; i < 8; i += 1) {
    const a = (Math.PI / 4) * i + Math.PI / 8;
    pts.push(`${(Math.cos(a) * r).toFixed(2)},${(Math.sin(a) * r).toFixed(2)}`);
  }
  return pts.join(' ');
}

const wrap = (inner, label) => `
  <svg class="st-art" viewBox="0 0 400 400" role="img" aria-label="${label}" preserveAspectRatio="xMidYMid meet">
    <rect width="400" height="400" fill="${INK2}"/>
    ${inner}
  </svg>`;

/* Garment silhouettes. Simple, flat, unmistakably illustrations. */
const TEE_PATH = 'M120 110 L160 88 Q200 108 240 88 L280 110 L300 150 L268 166 L268 312 Q200 322 132 312 L132 166 L100 150 Z';
const HOODIE_PATH = 'M118 120 L158 96 Q200 130 242 96 L282 120 L304 168 L270 184 L270 320 Q200 330 130 320 L130 184 L96 168 Z';

function garment(path, sloganLines, colorName) {
  const light = /white|vintage|natural/i.test(colorName || '');
  /* The garment must read against the card it sits on. An almost-black shirt
   * on an almost-black card is technically accurate and commercially useless,
   * so the dark colourway is lifted just enough to show its shape. */
  const cloth = light ? '#e8e1d4' : '#2b2419';
  const artFill = light ? INK : GOLD;
  const text = sloganLines.length
    ? `<g transform="translate(200,214)" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" fill="${artFill}">
         ${sloganLines.map((l, i) => `<text y="${i * 21}" font-size="${sloganLines.length > 2 ? 15 : 17}" letter-spacing=".4">${l}</text>`).join('')}
       </g>`
    : `<g transform="translate(200,208)">${mark(artFill, 30)}</g>`;
  return wrap(`
    <path d="${path}" fill="${cloth}" stroke="rgba(255,245,220,.26)" stroke-width="1.75"/>
    ${text}
  `, 'Design preview');
}

function mug(sloganLines) {
  const text = sloganLines.length
    ? `<g transform="translate(190,205)" text-anchor="middle" font-family="Georgia, serif" fill="${INK}">
         ${sloganLines.map((l, i) => `<text y="${i * 19}" font-size="14">${l}</text>`).join('')}
       </g>`
    : `<g transform="translate(190,200)">${mark(INK, 26)}</g>`;
  return wrap(`
    <rect x="110" y="140" width="160" height="130" rx="12" fill="${PAPER}"/>
    <path d="M270 175 q46 0 46 32 t-46 32" fill="none" stroke="${PAPER}" stroke-width="14"/>
    ${text}
  `, 'Design preview');
}

function hat() {
  return wrap(`
    <path d="M120 214 q80 -86 160 0 z" fill="#2b2419" stroke="rgba(255,245,220,.26)" stroke-width="1.75"/>
    <path d="M104 214 q96 26 192 0 q4 22 -14 26 q-82 16 -164 0 q-18 -4 -14 -26 z" fill="#1c170f"/>
    <g transform="translate(200,182)">${mark(GOLD, 20)}</g>
  `, 'Design preview');
}

/* Slogans are wrapped to at most three short lines so the preview reads the
 * way a real chest print would, rather than as one long unreadable string. */
function wrapSlogan(s) {
  if (!s) return [];
  const words = String(s).split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((`${cur} ${w}`).trim().length > 20 && cur) { lines.push(cur.trim()); cur = w; }
    else cur = `${cur} ${w}`;
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines.slice(0, 3);
}

export function designPreview(product, colorName) {
  const slogan = wrapSlogan(product.slogan);
  switch (product.type) {
    case 'hoodie': return garment(HOODIE_PATH, slogan, colorName || product.colors[0]);
    case 'mug': return mug(slogan);
    case 'hat': return hat();
    default: return garment(TEE_PATH, slogan, colorName || product.colors[0]);
  }
}

/**
 * Real provider mockups when they exist, design previews otherwise. The
 * caller never has to decide, and the label always tells the truth.
 */
export function productArt(product, colorName) {
  if (product.mockups?.length) {
    return {
      html: `<img class="st-art" src="${product.mockups[0]}" alt="${product.name}" loading="lazy" decoding="async">`,
      label: 'Printful product mockup',
      isProvider: true,
    };
  }
  return { html: designPreview(product, colorName), label: 'Design preview', isProvider: false };
}

export const priceLabel = (p) => formatPrice(p.retail_price, p.currency);
