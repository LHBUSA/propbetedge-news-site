/* Global #67: Japanese and Korean All Access pages and the regional disclosures.
 *
 * Pins:
 *   - routing and the document language;
 *   - the checkout link (price untouched; locale + a non-personal attribution tag only);
 *   - self-canonical heads with reciprocal hreflang (disclosures: none);
 *   - the acquisition rules for Japan and Korea (no sportsbook, odds-operator or
 *     referral links, no betting CTA, no US-only helplines);
 *   - complete translation (no stray English UI);
 *   - the required disclosure items, and that the vendored pbe-locale copy matches its manifest.
 *
 *   node --test tests/global-intl.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import * as G from '../src/global/intl-pages.js';
import { ALL_ACCESS, SPORTS } from '../src/pro-content.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const text = (html) => html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ');
const hrefs = (html) => [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));

test('routes: four localized pages; everything else stays English', () => {
  assert.deepEqual(G.intlRoute('/ja/pro'), { kind: 'pro', lang: 'ja', path: '/ja/pro' });
  assert.deepEqual(G.intlRoute('/ko/pro/'), { kind: 'pro', lang: 'ko', path: '/ko/pro' });
  assert.equal(G.intlRoute('/ja/legal/tokushoho').kind, 'disclosure');
  assert.equal(G.intlRoute('/ko/legal/business').lang, 'ko');
  for (const p of ['/pro', '/', '/ja', '/es/pro', '/fr/pro', '/ja/news', '/ko/legal/tokushoho', '/japan/pro']) assert.equal(G.intlRoute(p), null, p);
  assert.equal(G.documentLang('/ja/pro'), 'ja');
  assert.equal(G.documentLang('/ko/legal/business'), 'ko');
  assert.equal(G.documentLang('/pro'), 'en');
});

test('checkout: the same Payment Link and price; only locale and a non-personal attribution tag are added', () => {
  for (const lang of G.INTL_PRO_LANGS) {
    const url = new URL(G.checkoutUrlFor(lang, 'golf'));
    assert.equal(`${url.origin}${url.pathname}`, ALL_ACCESS.checkoutUrl);
    assert.deepEqual([...url.searchParams.keys()].sort(), ['client_reference_id', 'locale']);
    assert.equal(url.searchParams.get('locale'), lang);
    assert.equal(url.searchParams.get('client_reference_id'), `pbe-${lang}-pro-golf`);
    assert.match(url.searchParams.get('client_reference_id'), /^[A-Za-z0-9_-]{1,200}$/, 'Stripe client_reference_id charset');
  }
  assert.equal(G.checkoutUrlFor('ja'), `${ALL_ACCESS.checkoutUrl}?locale=ja&client_reference_id=pbe-ja-pro`);
  assert.equal(G.viaFrom('?via=mlb'), 'mlb');
  assert.equal(G.viaFrom('?via=evil<script>'), null, 'unknown sources are ignored');
  assert.equal(G.viaFrom('?via=a@b.com'), null, 'never personal data');
  assert.equal(ALL_ACCESS.priceUsd, 29, 'price unchanged');
});

test('head: self-canonical, correct language, reciprocal hreflang on /pro, /ja/pro and /ko/pro; disclosures announce none', () => {
  const alts = G.proAlternates();
  assert.deepEqual(alts.map((a) => [a.hreflang, a.url]), [
    ['en', 'https://propbetedge.ai/pro'], ['ja', 'https://propbetedge.ai/ja/pro'], ['ko', 'https://propbetedge.ai/ko/pro'], ['x-default', 'https://propbetedge.ai/pro'],
  ]);
  for (const path of ['/ja/pro', '/ko/pro']) {
    const h = G.intlHead(G.intlRoute(path));
    assert.equal(h.canonical, `https://propbetedge.ai${path}`);
    assert.equal(h.robots, 'index, follow, max-image-preview:large');
    assert.equal(h.lang, path.slice(1, 3));
    assert.deepEqual(h.alternates, alts);
    assert.ok(h.description.includes('US$29'));
    assert.ok([...h.title].length <= 60, `${path} title length`);
    const og = Object.fromEntries(h.socialTags);
    assert.equal(og['og:locale'], path.startsWith('/ja') ? 'ja_JP' : 'ko_KR');
    assert.equal(og['og:url'], h.canonical);
    assert.equal(h.jsonLd['@graph'][0].inLanguage, path.startsWith('/ja') ? 'ja-JP' : 'ko-KR');
  }
  for (const path of ['/ja/legal/tokushoho', '/ko/legal/business']) {
    const h = G.intlHead(G.intlRoute(path));
    assert.equal(h.canonical, `https://propbetedge.ai${path}`);
    assert.deepEqual(h.alternates, [], 'no English twin exists, so no hreflang');
  }
});

const PAGES = ['/ja/pro', '/ko/pro', '/ja/legal/tokushoho', '/ko/legal/business'].map((p) => [p, G.intlHtml(G.intlRoute(p), { via: 'mlb' })]);

test('acquisition rules: no sportsbook, odds-operator or referral links, no betting CTA, no US-only helplines', () => {
  for (const [path, html] of PAGES) {
    const lower = html.toLowerCase();
    for (const word of ['kalshi', 'polymarket', 'sportsbook', 'draftkings', 'fanduel', '/go/', '1-800', 'gambler', 'odds', 'wager', ' bet ', 'bet now', 'sign up to bet']) {
      assert.equal(lower.includes(word), false, `${path}: ${word}`);
    }
    for (const href of hrefs(html)) {
      const ok = href.startsWith('/') || href.startsWith('#') || href.startsWith('mailto:support@proptechusa.ai')
        || /^https:\/\/([a-z0-9-]+\.)?propbetedge\.ai(\/|$)/.test(href) || href.startsWith('https://buy.stripe.com/') || href.startsWith('https://billing.stripe.com/');
      assert.ok(ok, `${path}: unexpected link ${href}`);
    }
  }
});

/* Brand, product and sport names stay as published; everything else on the page is Japanese or Korean. */
const ALLOWED_LATIN = new Set(['PropBetEdge', 'All', 'Access', 'Command', 'Center', 'Compare', 'Markets', 'Predictions', 'PBEcast', 'DNA', 'Platinum', 'Direct', 'Live', 'Market', 'Wire',
  'MLB', 'NFL', 'NBA', 'NHL', 'WNBA', 'UFC', 'Tennis', 'Soccer', 'Golf', 'F1', 'ATP', 'WTA', 'PBE', 'Picks', 'WinBA', 'Fighter', 'Match', 'BTC', 'AI', 'US', 'THEEDGE25', 'Stripe',
  'Chrome', 'Safari', 'Edge', 'Firefox', 'Local', 'Home', 'Buyers', 'LLC', 'PropTechUSA', 'ai', 'd', 'b', 'a', 'support', 'proptechusa', 'Intelligence', 'EN']);
test('complete translation: no English UI words outside brand, product and sport names', () => {
  for (const [path, html] of PAGES) {
    const words = text(html).match(/[A-Za-z][A-Za-z0-9']*/g) || [];
    const stray = [...new Set(words.filter((w) => !ALLOWED_LATIN.has(w)))];
    // Sport product names come from the registry (e.g. "PropBetEdge MLB", "F1 Intelligence").
    assert.deepEqual(stray, [], `${path}: ${stray.join(', ')}`);
  }
});

test('/ja/pro and /ko/pro: price, renewal, cancellation and refund terms are shown before checkout; every sport is listed', () => {
  for (const [path, html] of PAGES.slice(0, 2)) {
    assert.ok(html.includes('US$29'), path);
    assert.ok(html.includes(`data-pbe-locale="${path.slice(1, 3)}"`), path);
    assert.ok(html.includes('client_reference_id=pbe-' + path.slice(1, 3) + '-pro-mlb'), `${path}: attribution carries ?via`);
    const termsAt = html.indexOf('pbe-intl-terms'), lastCta = html.lastIndexOf('all_access_checkout');
    assert.ok(termsAt > 0 && termsAt < lastCta, `${path}: subscription terms precede the final checkout button`);
    for (const s of SPORTS) assert.ok(html.includes(`data-sport="${s.key}"`), `${path}: ${s.key}`);
    assert.ok(html.includes(G.DISCLOSURE_PATH[path.slice(1, 3)]), `${path}: links its disclosure`);
  }
});

test('Japan disclosure: every item of the Act on Specified Commercial Transactions is present; nothing invented', () => {
  const html = PAGES[2][1];
  for (const item of ['販売事業者', '運営統括責任者', '所在地', '電話番号', 'メールアドレス', '販売価格', '商品代金以外の必要料金', 'お支払い方法', 'お支払い時期', '提供時期', '契約期間と自動更新', '解約方法', '返品・返金', '動作環境']) {
    assert.ok(html.includes(`<dt>${item}</dt>`), item);
  }
  assert.ok(html.includes('Local Home Buyers LLC'));
  assert.ok(html.includes('請求があった場合には、遅滞なく開示いたします'), 'on-request disclosure, not invented details');
  assert.equal(/\+?\d{1,3}[-\s]?\(?\d{3}\)?[-\s]?\d{3}[-\s]?\d{4}/.test(text(html)), false, 'no phone number invented');
});

test('Korea disclosure: seller, location, contact and terms; registration status stated, not invented', () => {
  const html = PAGES[3][1];
  for (const item of ['상호', '소재지', '이메일', '요금', '결제 방법', '제공 시기', '해지 방법', '청약철회 · 환불']) assert.ok(html.includes(`<dt>${item}</dt>`), item);
  assert.ok(html.includes('해당 없음'));
});

test('wiring: middleware, router, sitemap and styles serve the pages', () => {
  const mw = read('middleware.js');
  assert.match(mw, /intlRoute\(pathname\)/);
  assert.match(mw, /alternates: checkoutSuccess \? \[\] : proAlternates\(\)/, '/pro announces its translations, never on the success state');
  assert.match(mw, /meta\.lang && meta\.lang !== 'en'/);
  assert.match(read('src/router.js'), /renderIntlPage\(root, intl, setMeta\)/);
  assert.match(read('src/router.js'), /data-pbe-reload/);
  const sm = read('api/sitemap.js');
  for (const p of ['/ja/pro', '/ko/pro', '/ja/legal/tokushoho', '/ko/legal/business']) assert.ok(sm.includes(`'${p}'`), p);
  assert.match(read('src/main.js'), /vendor\/pbe-locale\/pbe-locale\.css/);
});

test('vendored pbe-locale is byte-identical to the shared contract (LF-normalized manifest)', () => {
  const manifest = read('src/vendor/pbe-locale/MANIFEST.sha256').trim().split(/\r?\n/).map((l) => l.split(/\s+/));
  assert.equal(manifest.length, 2);
  for (const [sha, file] of manifest) {
    const got = createHash('sha256').update(read(`src/vendor/pbe-locale/${file}`).replace(/\r\n/g, '\n')).digest('hex');
    assert.equal(got, sha, `${file} drifted from propbetedge-workers shared/pbe-locale`);
  }
});
