/* /pro — PropBetEdge All Access membership page (visual sales page, 2026-10-06).
 *
 * Pins the ONE live Stripe checkout, the $29/month price, the THEEDGE25 offer,
 * the registry truth (10 sports + Predictions + Compare + Markets), the four
 * network products and ten sports as live links, the server-verdict member
 * states, the ?checkout=success state, the optimized artwork (sizes, preload
 * parity, lazy below-fold), every established destination, and the crawler
 * bytes Edge Middleware serves for /pro.
 *
 *   node --test tests/pro-page.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';

import {
  ALL_ACCESS, SPORTS, NETWORK_PRODUCTS, ART, ALL_ACCESS_LINE, COMMAND_CENTER_URL, CRYPTO_URL, SIGN_IN_URL,
  buildProHtml, checkoutSucceeded, memberStateFrom, promoLine, artSrcset,
} from '../src/pro-content.js';
import { proHeadMeta, proJsonLd, proHeroPreloads, PRO_TITLE } from '../src/pro-seo.js';
import FAMILY from '../src/network/family.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const LIVE = {
  checkoutUrl: 'https://buy.stripe.com/8x2eVdgmOaqy4pv8Ez7wA0N',
  paymentLinkId: 'plink_1UJCFAF3CaVzg4ORKspa47rI',
  priceId: 'price_1UJCF1F3CaVzg4ORSIohWTca',
};
const hrefs = (html) => [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);

test('the live Stripe identities are pinned and nothing else is offered', () => {
  assert.equal(ALL_ACCESS.checkoutUrl, LIVE.checkoutUrl);
  assert.equal(ALL_ACCESS.paymentLinkId, LIVE.paymentLinkId);
  assert.equal(ALL_ACCESS.priceId, LIVE.priceId);
  assert.equal(ALL_ACCESS.productKey, 'pbe_all_access');
  assert.equal(ALL_ACCESS.priceUsd, 29); assert.equal(ALL_ACCESS.interval, 'month');
  assert.equal(ALL_ACCESS.promoCode, 'THEEDGE25'); assert.equal(ALL_ACCESS.promoPercent, 25);
  assert.equal(promoLine(), '25% off for as long as you stay active with code THEEDGE25.');
  const html = buildProHtml();
  const stripeLinks = html.match(/https:\/\/buy\.stripe\.com\/[A-Za-z0-9]+/g) || [];
  assert.equal(stripeLinks.length, 2, 'hero and closing CTA — not the same price eight times');
  assert.ok(stripeLinks.every((l) => l === LIVE.checkoutUrl));
  assert.equal((html.match(/data-pbe-placement="all_access_checkout"/g) || []).length, stripeLinks.length);
});

test('network truth comes from the vendored canonical registry', () => {
  assert.equal(ALL_ACCESS_LINE, '10 sports + Predictions + Compare + Markets · $29/month');
  assert.equal(ALL_ACCESS_LINE, FAMILY.all_access_line);
  const layer = FAMILY.all_access.filter((p) => p.key !== 'all_access');
  assert.deepEqual(NETWORK_PRODUCTS.map((p) => p.key).sort(), layer.map((p) => p.key).sort());
  for (const p of NETWORK_PRODUCTS) assert.equal(p.url, layer.find((x) => x.key === p.key).url, p.key);
  assert.deepEqual(NETWORK_PRODUCTS.map((p) => p.label), ['Command Center', 'Compare', 'Markets', 'Predictions']);
  assert.deepEqual(SPORTS.map((s) => s.key).sort(), FAMILY.sports.map((s) => s.key).sort(), 'the ten sports match the registry');
  assert.equal(SPORTS.length, 10);
  assert.equal(SPORTS.some((s) => ['predictions', 'compare', 'markets', 'members'].includes(s.key)), false, 'products are never sports');
  assert.equal(COMMAND_CENTER_URL, 'https://members.propbetedge.ai/');
});

test('hierarchy: hero, unlock, network, four products, sport proof, ten sports, why, final CTA', () => {
  const html = buildProHtml();
  const order = ['class="pbe-pro-hero"', 'pbe-pro-unlock"', 'pbe-pro-network"', 'id="products"', 'pbe-pro-proof"', 'id="sports"', 'id="why"', 'pbe-pro-final"'];
  const at = order.map((m) => html.indexOf(m));
  assert.ok(at.every((i) => i > -1), JSON.stringify(at));
  assert.deepEqual([...at].sort((a, b) => a - b), at, 'sections in sales order');
  assert.match(html, /<span>One membership\.<\/span>\s*<span class="pbe-pro-title-gold">The entire intelligence network\.<\/span>/);
  assert.match(html, /10 sports \+ Predictions \+ Compare \+ Markets\. Live intelligence, proprietary models, prediction markets and sport-native research under one membership\./);
  assert.match(html, /pbe-pro-price-amount">\$29<\/span><span class="pbe-pro-price-per">\/ month/);
  assert.match(html, />Get All Access</);
  assert.match(html, new RegExp(`href="${SIGN_IN_URL.replace(/[?.]/g, '\\$&')}"[^>]*>Member sign in<`));
  assert.match(html, /This isn't one product with ten logos\./);
  assert.match(html, /The network keeps growing\. Your membership already covers it\./);
  assert.match(html, /\$29\/month · one All Access membership/);
  assert.match(html, /<code data-pbe-promo-code>THEEDGE25<\/code>/);
  assert.equal((html.match(/<h1/g) || []).length, 1);
});

test('all four network products and all ten sports link to their live destinations', () => {
  const html = buildProHtml();
  const links = hrefs(html);
  for (const p of NETWORK_PRODUCTS) {
    assert.match(html, new RegExp(`data-pbe-story="${p.key}"`), `${p.label} has a showcase`);
    assert.ok(links.includes(p.url), `${p.label} → ${p.url}`);
  }
  for (const label of ['Explore Compare', 'Explore Predictions', 'Explore Markets', 'Open Command Center']) assert.ok(html.includes(`${label} →`), label);
  assert.equal((html.match(/pbe-pro-sport" data-sport=/g) || []).length, 10);
  for (const s of SPORTS) {
    assert.match(html, new RegExp(`data-sport="${s.key}"`), s.key);
    assert.ok(links.includes(s.url), `${s.label} links to its property`);
  }
  for (const s of FAMILY.sports) assert.ok(links.includes(s.url), `network strip links ${s.label}`);
  assert.equal(/markets\.propbetedge\.ai/.test(html), false, 'never the undelegated markets host');
});

test('established destinations survive the redesign (never delete links)', () => {
  const links = new Set(hrefs(buildProHtml()));
  for (const href of [
    LIVE.checkoutUrl, SIGN_IN_URL, COMMAND_CENTER_URL, 'https://compare.propbetedge.ai/', 'https://predictions.propbetedge.ai/',
    'https://predictions.propbetedge.ai/markets/', CRYPTO_URL, '/terms', '/support', ...SPORTS.map((s) => s.url),
  ]) assert.ok(links.has(href), href);
  const success = new Set(hrefs(buildProHtml({ checkoutSuccess: true })));
  assert.ok(success.has(ALL_ACCESS.manageUrl), 'success keeps Manage subscription');
});

test('copy never claims certainty, guaranteed profit or perfect predictions', () => {
  const text = buildProHtml().replace(/<[^>]+>/g, ' ');
  assert.equal(/guarantee|risk-free|sure thing|can't lose|beat the (books|sportsbooks)|perfect predictions|\d+% accura/i.test(text), false);
  assert.match(text, /not promises/);
});

test('member states come only from the server verdict', () => {
  assert.equal(memberStateFrom(null), null);
  assert.equal(memberStateFrom({ authenticated: false, membership: { state: 'all_access' } }), null, 'unauthenticated never unlocks');
  assert.equal(memberStateFrom({ authenticated: true, membership: { state: 'free' } }), null);
  assert.equal(memberStateFrom({ authenticated: true, membership: { state: 'sport_pro' } }), null, 'sport-only still sees the upgrade');
  assert.equal(memberStateFrom({ authenticated: true, membership: { state: 'all_access' } }), 'all_access');
  assert.equal(memberStateFrom({ authenticated: true, membership: { state: 'owner' } }), 'owner');
  const page = read('src/pages/pro.js');
  assert.match(page, /https:\/\/auth\.propbetedge\.ai\/membership\?product=predictions/);
  assert.match(page, /credentials: 'include'/);
  assert.equal(/localStorage|sessionStorage|URLSearchParams\([^)]*\)\.get\('(member|plan|state)'/.test(page), false, 'no client-side entitlement');
});

test('All Access and owner see Command Center, never a purchase-first CTA', () => {
  for (const member of ['all_access', 'owner']) {
    const html = buildProHtml({ member });
    assert.equal(html.includes(LIVE.checkoutUrl), false, `${member}: no checkout`);
    assert.equal(/THEEDGE25/.test(html), false, `${member}: no promo`);
    assert.match(html, new RegExp(`class="pbe-pro-cta pbe-pro-cta-hero" href="${COMMAND_CENTER_URL}"[^>]*>Open Command Center`));
    assert.match(html, />Open your Command Center</);
    assert.ok(html.includes(ALL_ACCESS.manageUrl), `${member}: manage membership`);
    for (const s of SPORTS) assert.ok(html.includes(`href="${s.url}"`), `${member}: ${s.label}`);
  }
  assert.match(buildProHtml({ member: 'all_access' }), /◆ PLATINUM MEMBER<\/b><span>PropBetEdge All Access · active/);
  assert.match(buildProHtml({ member: 'owner' }), /VERIFIED OWNER/);
});

test('?checkout=success renders the welcome state and no second checkout', () => {
  assert.equal(checkoutSucceeded('?checkout=success'), true);
  assert.equal(checkoutSucceeded('?checkout=canceled'), false);
  assert.equal(checkoutSucceeded(''), false);
  const html = buildProHtml({ checkoutSuccess: true });
  assert.match(html, /pbe-pro-is-success/);
  assert.match(html, /Checkout complete/);
  assert.match(html, /Welcome to All Access\./);
  assert.match(html, /Sign in with the email you used at checkout/);
  assert.match(html, /Manage subscription/);
  assert.equal(html.includes(LIVE.checkoutUrl), false, 'a buyer who just paid is not sold again');
  for (const s of SPORTS) assert.ok(html.includes(`href="${s.url}"`), `${s.label} reachable from the success state`);
  assert.equal(proHeadMeta({ checkoutSuccess: true }).title, 'All Access is active | PropBetEdge');
});

test('artwork: every derivative exists in AVIF + WebP within budget; originals are not served', () => {
  const budgetKb = { hero: 160, 'hero-m': 120, network: 260, compare: 200, predictions: 200, ufc: 200, tennis: 220 };
  for (const [key, a] of Object.entries(ART)) {
    const name = a.name || key;
    for (const w of a.widths) for (const ext of ['avif', 'webp']) {
      const f = new URL(`../public/pro/${name}-${w}.${ext}`, import.meta.url);
      assert.ok(existsSync(f), `${name}-${w}.${ext}`);
      assert.ok(statSync(f).size <= budgetKb[name] * 1024, `${name}-${w}.${ext} ${Math.round(statSync(f).size / 1024)} KB`);
    }
  }
  assert.equal(existsSync(new URL('../public/pro/all-access-hero.png', import.meta.url)), false, 'no 2 MB PNG in public/');
  assert.ok(existsSync(new URL('../assets-src/pro/PROVENANCE.md', import.meta.url)));
  const html = buildProHtml();
  assert.equal(/\.png"/.test(html), false, 'the page never references a PNG');
  const imgs = html.match(/<img [^>]+>/g);
  assert.equal(imgs.filter((i) => /fetchpriority="high"/.test(i)).length, 1, 'only the hero is high priority');
  assert.ok(imgs.slice(1).every((i) => /loading="lazy"/.test(i)), 'every below-fold image is lazy');
  assert.ok(imgs.every((i) => /width="\d+" height="\d+"/.test(i)), 'explicit dimensions on every image');
});

test('hero preloads match the art-directed <picture> sources exactly', () => {
  const html = buildProHtml();
  const [m, d] = proHeroPreloads();
  assert.equal(m.type, 'image/avif'); assert.equal(d.type, 'image/avif');
  assert.ok(html.includes(`<source media="${m.media}" type="image/avif" srcset="${m.imagesrcset}" sizes="${m.imagesizes}"`));
  assert.ok(html.includes(`<source type="image/avif" srcset="${d.imagesrcset}" sizes="${d.imagesizes}">`));
  assert.equal(d.imagesrcset, artSrcset('hero', 'avif'));
  assert.equal(m.media, '(max-width: 720px)'); assert.equal(d.media, '(min-width: 721px)');
});

test('meta + schema: canonical /pro, $29 USD monthly offer at the live checkout URL', () => {
  const head = proHeadMeta();
  assert.equal(head.canonical, 'https://propbetedge.ai/pro');
  assert.equal(head.title, PRO_TITLE); assert.match(head.description, /\$29\/month/); assert.match(head.description, /Markets/);
  const offer = proJsonLd()['@graph'].find((n) => n['@type'] === 'Offer');
  assert.equal(offer.url, LIVE.checkoutUrl);
  assert.equal(offer.price, '29'); assert.equal(offer.priceCurrency, 'USD');
  assert.equal(offer.priceSpecification.unitCode, 'MON');
});

test('wiring: router, styles, header pill, footer link, sitemap and Edge Middleware all know /pro', () => {
  assert.match(read('src/router.js'), /if \(path === '\/pro'\) return renderPro\(root, setMeta\);/);
  assert.match(read('src/main.js'), /pbe-pro\.css/);
  assert.match(read('src/components/header.js'), /href="\/pro" class="nav-link pbe-all-access-link/);
  const header = read('src/components/header.js');
  const mobileNav = header.slice(header.indexOf('<nav class="pbe-mobile-nav"'), header.indexOf('</nav>', header.indexOf('<nav class="pbe-mobile-nav"')));
  assert.match(mobileNav, /<a href="\/pro" class="pbe-mobile-nav-link pbe-mobile-all-access \$\{path === '\/pro' \? 'active' : ''\}"/);
  assert.match(read('src/components/footer.js'), /href="\/pro" class="nf-hero-link"><span class="nf-hero-name">All Access<\/span>/);
  assert.match(read('api/sitemap.js'), /'\/pro',/);
  const mw = read('middleware.js');
  assert.match(mw, /if \(pathname === '\/pro'\) \{/);
  assert.match(mw, /preloadImages: proHeroPreloads\(\)/);
  assert.match(read('src/styles/pbe-pro.css'), /main\.pbe-pro-main, main\.pbe-pro-main > \.pbe-pro \{ padding-left: 0 !important; padding-right: 0 !important; \}/, 'full-bleed hero survives the global mobile main padding');
  assert.equal(read('vercel.json').includes('"/pro"'), false, 'the SPA catch-all already serves /pro; no bespoke rewrite');
});

test('crawler bytes: Edge Middleware serves /pro with title, canonical, product schema, hero preloads and the live checkout link', async () => {
  const { renderPage } = await import('./ssr-harness.mjs');
  const { html, status } = await renderPage('/pro');
  assert.equal(status, 200);
  assert.match(html, /<title>PropBetEdge All Access \| Premium Sports &amp; Market Intelligence<\/title>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/propbetedge\.ai\/pro"/);
  assert.match(html, /data-server-rendered="1"/);
  assert.ok(html.includes(LIVE.checkoutUrl));
  assert.match(html, /"@type":"Product"/);
  assert.match(html, /THEEDGE25/);
  assert.match(html, /10 sports \+ Predictions \+ Compare \+ Markets/);
  assert.equal((html.match(/<link rel="preload" as="image"/g) || []).length, 2);
});
