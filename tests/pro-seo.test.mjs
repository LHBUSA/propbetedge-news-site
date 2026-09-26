/* /pro — SEO + sharing contract (2026-09-24).
 *
 * Pins the ONE authoritative head for PropBetEdge All Access: canonical,
 * robots, title/description, the complete Open Graph and Twitter sets, the
 * dedicated 1200x630 social card, the connected JSON-LD graph, the sitemap,
 * share URLs, query-parameter hygiene, the transactional (noindex) success
 * state, and server/client parity.
 *
 *   node --test tests/pro-seo.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

import * as seo from '../src/pro-seo.js';
import { ALL_ACCESS, SPORTS } from '../src/pro-content.js';
import { renderShareBar } from '../src/entity-graph/share-bar.js';

const read = f => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const CANON = 'https://propbetedge.ai/pro';
const IMAGE = 'https://propbetedge.ai/social/all-access-1200x630.png?v=20260926t';
const GENERIC_LOGO = /pbe-full-\d+\.png/;

/* ---------------------------------------------------------------- module */
test('title and description: premium, descriptive, SERP-length, product first (not the coupon)', () => {
  assert.equal(seo.PRO_TITLE, 'PropBetEdge All Access | 7 Sports, One Membership');
  assert.ok(seo.PRO_TITLE.length <= 60, `title ${seo.PRO_TITLE.length} chars`);
  assert.equal(/THEEDGE25|25%/.test(seo.PRO_TITLE), false, 'the discount never leads the title');
  assert.ok(seo.PRO_DESCRIPTION.length >= 140 && seo.PRO_DESCRIPTION.length <= 300, `description ${seo.PRO_DESCRIPTION.length} chars`);
  for (const word of ['MLB', 'NFL', 'NBA', 'NHL', 'WNBA', 'UFC', 'Tennis', 'future sport', '$29/month', 'prediction models', 'tracked and graded picks', 'live intelligence']) {
    assert.ok(seo.PRO_DESCRIPTION.includes(word), word);
  }
  assert.equal(/best|#1|most accurate/i.test(seo.PRO_TITLE + seo.PRO_DESCRIPTION), false, 'no fabricated superlatives');
});

test('canonical is exactly /pro for every variant; success state is noindex,follow but keeps the canonical', () => {
  assert.equal(seo.canonicalFor(), CANON);
  const normal = seo.proHeadMeta();
  assert.equal(normal.canonical, CANON); assert.equal(normal.robots, 'index, follow, max-image-preview:large');
  const success = seo.proHeadMeta({ checkoutSuccess: true });
  assert.equal(success.canonical, CANON); assert.equal(success.robots, 'noindex, follow');
  assert.equal(seo.isCheckoutSuccess('?checkout=success'), true);
  assert.equal(seo.isCheckoutSuccess('?utm_source=x&checkout=success'), true);
  assert.equal(seo.isCheckoutSuccess('?checkout=canceled'), false);
  assert.equal(seo.isCheckoutSuccess('?utm_source=x'), false);
  assert.equal(seo.isCheckoutSuccess(''), false);
});

test('Open Graph: complete dedicated set, website type, exact dimensions, alt, locale, dedicated card (not the logo)', () => {
  const og = Object.fromEntries(seo.proOpenGraphTags());
  assert.deepEqual(Object.keys(og), ['og:type', 'og:site_name', 'og:locale', 'og:title', 'og:description', 'og:url', 'og:image', 'og:image:secure_url', 'og:image:type', 'og:image:width', 'og:image:height', 'og:image:alt']);
  assert.equal(og['og:type'], 'website'); assert.equal(og['og:site_name'], 'PropBetEdge'); assert.equal(og['og:locale'], 'en_US');
  assert.equal(og['og:title'], seo.PRO_TITLE); assert.equal(og['og:description'], seo.PRO_DESCRIPTION); assert.equal(og['og:url'], CANON);
  assert.equal(og['og:image'], IMAGE); assert.equal(og['og:image:secure_url'], IMAGE); assert.equal(og['og:image:type'], 'image/png');
  assert.equal(og['og:image:width'], '1200'); assert.equal(og['og:image:height'], '630');
  assert.match(og['og:image:alt'], /All Access/); assert.equal(GENERIC_LOGO.test(og['og:image']), false);
});

test('Twitter/X: summary_large_image with the same product story and image', () => {
  const tw = Object.fromEntries(seo.proTwitterTags());
  assert.equal(tw['twitter:card'], 'summary_large_image');
  assert.equal(tw['twitter:title'], seo.PRO_TITLE); assert.equal(tw['twitter:description'], seo.PRO_DESCRIPTION);
  assert.equal(tw['twitter:image'], IMAGE); assert.match(tw['twitter:image:alt'], /All Access/);
});

test('the dedicated social card exists, is a PNG and is exactly 1200x630', () => {
  const file = new URL('../public/social/all-access-1200x630.png', import.meta.url);
  assert.ok(existsSync(file), 'public/social/all-access-1200x630.png');
  const bytes = readFileSync(file);
  assert.equal(bytes.subarray(1, 4).toString('ascii'), 'PNG');
  assert.equal(bytes.readUInt32BE(16), 1200); assert.equal(bytes.readUInt32BE(20), 630);
  assert.ok(bytes.length < 900 * 1024, 'card stays under 900 KB');
});

test('JSON-LD graph: connected WebPage -> Product -> Offer with stable @ids, brand/org reused, breadcrumb, no fake ratings', () => {
  const ld = seo.proJsonLd();
  assert.equal(ld['@context'], 'https://schema.org');
  const by = Object.fromEntries(ld['@graph'].map((n) => [n['@type'], n]));
  assert.deepEqual(Object.keys(by).sort(), ['BreadcrumbList', 'Offer', 'Product', 'WebPage']);
  assert.equal(by.WebPage['@id'], `${CANON}#webpage`); assert.equal(by.Product['@id'], `${CANON}#product`); assert.equal(by.Offer['@id'], `${CANON}#offer`); assert.equal(by.BreadcrumbList['@id'], `${CANON}#breadcrumb`);
  assert.deepEqual(by.WebPage.mainEntity, { '@id': `${CANON}#product` });
  assert.deepEqual(by.WebPage.isPartOf, { '@id': 'https://propbetedge.ai/#website' });
  assert.deepEqual(by.WebPage.publisher, { '@id': 'https://propbetedge.ai/#organization' });
  assert.deepEqual(by.WebPage.breadcrumb, { '@id': `${CANON}#breadcrumb` });
  assert.deepEqual(by.Product.offers, { '@id': `${CANON}#offer` });
  assert.deepEqual(by.Product.brand, { '@id': 'https://propbetedge.ai/#organization' });
  assert.deepEqual(by.Product.mainEntityOfPage, { '@id': `${CANON}#webpage` });
  assert.deepEqual(by.Offer.itemOffered, { '@id': `${CANON}#product` });
  assert.equal(by.Offer.price, '29'); assert.equal(by.Offer.priceCurrency, 'USD'); assert.equal(by.Offer.url, ALL_ACCESS.checkoutUrl);
  assert.equal(by.Offer.priceSpecification.unitCode, 'MON'); assert.equal(by.Offer.priceSpecification.price, '29');
  assert.equal(by.Offer.availability, 'https://schema.org/InStock');
  assert.equal(by.BreadcrumbList.itemListElement.length, 2); assert.equal(by.BreadcrumbList.itemListElement[1].item, CANON);
  const text = JSON.stringify(ld);
  assert.equal(/aggregateRating|"review"|ratingValue|reviewCount|award/i.test(text), false, 'no invented ratings, reviews or awards');
  assert.equal(/21\.75/.test(text), false, 'the coupon price is never the listed price');
  for (const url of text.match(/"https?:\/\/[^"]+"/g)) assert.match(url, /^"https:\/\//, 'absolute https URLs only');
  /* site-wide identities are referenced, never redefined here */
  assert.equal(ld['@graph'].some((n) => n['@id'] === 'https://propbetedge.ai/#organization' || n['@id'] === 'https://propbetedge.ai/#website'), false);
  const ids = ld['@graph'].map((n) => n['@id']); assert.equal(new Set(ids).size, ids.length, 'unique @ids');
  /* the global shipped schema defines the identities this graph points at */
  const globalSchema = read('index.html');
  assert.ok(globalSchema.includes('"@id": "https://propbetedge.ai/#organization"') && globalSchema.includes('"@id": "https://propbetedge.ai/#website"'));
});

test('crawler HTML: one H1, descriptive sport anchors to canonical properties, real product categories, no hidden SEO dump', () => {
  const html = seo.proServerHtml();
  assert.equal((html.match(/<h1/g) || []).length, 1);
  for (const s of SPORTS) assert.ok(html.includes(`<a href="${s.url}/">${s.name}</a>`), s.name);
  assert.equal(/click here|read more/i.test(html), false);
  for (const cat of ['Proprietary algorithms', 'Tracked, graded picks', 'Live intelligence', 'PBEcast', 'Player and matchup intelligence', 'future Pro tools']) assert.ok(html.includes(cat), cat);
  assert.equal(/display:\s*none|visibility:\s*hidden|aria-hidden="true">[^<]{200,}/.test(html), false, 'nothing hidden');
  assert.ok(html.length < 6000, 'concise, mirrors the visible product');
  const success = seo.proServerHtml({ checkoutSuccess: true });
  assert.match(success, /Welcome to All Access/); assert.equal(success.includes(ALL_ACCESS.checkoutUrl), false);
});

/* ---------------------------------------------------------------- share */
test('share UI: canonical URL only, clean product text, X / LinkedIn / Bluesky / copy / native, no query strings or Stripe URLs', () => {
  const bar = renderShareBar(seo.PRO_CANONICAL, seo.PRO_SHARE_TITLE, { compact: true, subject: 'PropBetEdge All Access' });
  assert.match(bar, /data-share-url="https:\/\/propbetedge\.ai\/pro"/);
  assert.equal(seo.PRO_SHARE_TITLE, 'PropBetEdge All Access — MLB, NFL, NBA, NHL, WNBA, UFC and Tennis under one membership.');
  assert.equal(/THEEDGE25|25%/.test(seo.PRO_SHARE_TITLE), false, 'no promo spam in share intents');
  for (const key of ['x', 'linkedin', 'bluesky', 'copy', 'native']) assert.match(bar, new RegExp(`pbe-share-btn--${key}`));
  const urls = [...bar.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));
  for (const href of urls) {
    const shared = new URL(href).searchParams.get('url') || decodeURIComponent(new URL(href).searchParams.get('text') || '');
    assert.equal(shared.includes('checkout='), false, href); assert.equal(shared.includes('utm_'), false, href); assert.equal(shared.includes('buy.stripe.com'), false, href);
    assert.ok(shared.includes('https://propbetedge.ai/pro'), href);
  }
  assert.match(bar, /aria-label="Share PropBetEdge All Access"/);
  const page = read('src/pages/pro.js');
  assert.match(page, /renderShareBar\(PRO_CANONICAL, PRO_SHARE_TITLE/);
  assert.match(page, /mountShareBars\(root\)/);
});

/* ---------------------------------------------------------------- sitemap + robots */
test('sitemap: /pro exactly once, no success variant, no Stripe URL; robots never blocks /pro', () => {
  const sitemap = read('api/sitemap.js');
  assert.equal((sitemap.match(/'\/pro',/g) || []).length, 1);
  assert.equal(/checkout=success/.test(sitemap), false); assert.equal(/buy\.stripe\.com/.test(sitemap), false);
  const robots = read('api/robots.js');
  assert.equal(/Disallow:\s*\/pro\b/.test(robots), false);
  assert.equal(/Disallow:\s*\/\s*$/m.test(robots), false);
});

/* ---------------------------------------------------------------- parity */
test('server/client parity: hydration re-applies the same contract and never the generic defaults', () => {
  const page = read('src/pages/pro.js');
  assert.match(page, /from '\.\.\/pro-seo\.js'/);
  assert.match(page, /ogImage: head\.image\.url/, 'client passes the dedicated image so setMeta never falls back to the logo');
  assert.match(page, /upsertMeta\('name', 'robots', head\.robots\)/);
  assert.match(page, /for \(const \[name, content\] of proSocialTags\(\)\)/);
  assert.match(page, /getElementById\('pbe-server-primary-schema'\)/, 'server schema updated in place, never duplicated');
  assert.match(page, /JSON\.stringify\(proJsonLd\(\)\)/);
  assert.equal(/injectSchemas|organizationSchema\(\)|websiteSchema\(\)/.test(page), false, 'no competing client-only schema copies');
  const mw = read('middleware.js');
  assert.match(mw, /resolveMeta\(pathname, url\.search\)/);
  assert.match(mw, /const checkoutSuccess = isCheckoutSuccess\(search\);/);
  assert.match(mw, /socialTags: proSocialTags\(\)/); assert.match(mw, /jsonLd: proJsonLd\(\)/);
  assert.match(read('index.html'), /<meta name="color-scheme" content="dark" \/>/);
});

/* ---------------------------------------------------------------- crawler bytes (real middleware, real index.html) */
const pick = (head, re) => [...head.matchAll(re)].map((m) => m[1]);
async function crawl(path) {
  const { renderPage } = await import('./ssr-harness.mjs');
  const out = await renderPage(path);
  out.head = out.html.split('</head>')[0];
  return out;
}

test('crawler bytes /pro: exactly one authoritative value for every head field, dedicated image, connected graph, SSR body', async () => {
  const { status, headers, html, head } = await crawl('/pro');
  assert.equal(status, 200);
  const once = (re) => assert.equal((head.match(re) || []).length, 1, String(re));
  for (const re of [/<title>/g, /rel="canonical"/g, /name="description"/g, /name="robots"/g, /property="og:title"/g, /property="og:description"/g, /property="og:url"/g, /property="og:image"/g, /property="og:type"/g, /property="og:site_name"/g, /property="og:locale"/g, /property="og:image:width"/g, /property="og:image:height"/g, /property="og:image:alt"/g, /name="twitter:card"/g, /name="twitter:title"/g, /name="twitter:description"/g, /name="twitter:image"/g, /name="twitter:image:alt"/g]) once(re);
  assert.deepEqual(pick(head, /<title>([^<]*)<\/title>/g), ['PropBetEdge All Access | 7 Sports, One Membership']);
  assert.deepEqual(pick(head, /rel="canonical" href="([^"]+)"/g), [CANON]);
  assert.deepEqual(pick(head, /name="robots" content="([^"]+)"/g), ['index, follow, max-image-preview:large']);
  assert.equal(headers.get('x-robots-tag'), null);
  assert.deepEqual(pick(head, /property="og:url" content="([^"]+)"/g), [CANON]);
  assert.deepEqual(pick(head, /property="og:image" content="([^"]+)"/g), [IMAGE]);
  assert.deepEqual(pick(head, /name="twitter:image" content="([^"]+)"/g), [IMAGE]);
  assert.deepEqual(pick(head, /property="og:image:width" content="([^"]+)"/g), ['1200']);
  assert.deepEqual(pick(head, /property="og:image:height" content="([^"]+)"/g), ['630']);
  assert.deepEqual(pick(head, /name="twitter:card" content="([^"]+)"/g), ['summary_large_image']);
  assert.equal(GENERIC_LOGO.test(pick(head, /property="og:image" content="([^"]+)"/g)[0]), false);
  const scripts = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
  const primary = scripts.find((s) => Array.isArray(s['@graph']) && s['@graph'].some((n) => n['@type'] === 'Product'));
  assert.ok(primary, 'server primary schema carries the product graph');
  const product = primary['@graph'].find((n) => n['@type'] === 'Product');
  assert.equal(product['@id'], `${CANON}#product`);
  const allIds = scripts.flatMap((s) => (s['@graph'] || [s]).map((n) => n['@id']).filter(Boolean));
  assert.equal(new Set(allIds).size, allIds.length, 'no @id defined twice across the page');
  assert.match(html, /data-server-rendered="1"/);
  for (const s of SPORTS) assert.ok(html.includes(`<a href="${s.url}/">${s.name}</a>`), s.name);
  assert.equal((html.match(/<h1/g) || []).length, 1, 'one H1 in the crawler document');
});

test('crawler bytes /pro?checkout=success: same canonical, noindex,follow + X-Robots-Tag, product OG preserved, functional page', async () => {
  const { status, headers, head, html } = await crawl('/pro?checkout=success');
  assert.equal(status, 200);
  assert.deepEqual(pick(head, /rel="canonical" href="([^"]+)"/g), [CANON]);
  assert.deepEqual(pick(head, /name="robots" content="([^"]+)"/g), ['noindex, follow']);
  assert.equal(headers.get('x-robots-tag'), 'noindex, follow');
  assert.deepEqual(pick(head, /property="og:url" content="([^"]+)"/g), [CANON]);
  assert.deepEqual(pick(head, /property="og:image" content="([^"]+)"/g), [IMAGE]);
  assert.match(head, /<title>All Access is active \| PropBetEdge<\/title>/);
  assert.match(html, /Welcome to All Access/);
});

test('crawler bytes: UTM, ref and trailing-slash variants never leak into canonical, og:url or robots', async () => {
  for (const path of ['/pro?utm_source=x&utm_campaign=launch', '/pro?ref=foo', '/pro/', '/pro/?utm_medium=social']) {
    const { head, headers } = await crawl(path);
    assert.deepEqual(pick(head, /rel="canonical" href="([^"]+)"/g), [CANON], path);
    assert.deepEqual(pick(head, /property="og:url" content="([^"]+)"/g), [CANON], path);
    assert.deepEqual(pick(head, /name="robots" content="([^"]+)"/g), ['index, follow, max-image-preview:large'], path);
    assert.equal(headers.get('x-robots-tag'), null, path);
  }
});
