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

/* ---------------------------------------------------------------- Spanish (es) */
import * as A from '../src/global/attribution.js';
import { buildProHtml } from '../src/pro-content.js';
import { proServerHtml } from '../src/pro-seo.js';

test('es attribution on English /pro: ?lang=es[&via] tags the SAME Payment Link; everyone else gets the plain link', () => {
  assert.deepEqual(A.enProAttributionFrom('?lang=es&via=golf'), { lang: 'es', via: 'golf' });
  assert.deepEqual(A.enProAttributionFrom('?lang=es'), { lang: 'es', via: null });
  for (const q of ['', '?via=golf', '?lang=fr&via=golf', '?lang=ja', '?lang=es%3Cscript%3E', '?lang=ES']) assert.equal(A.enProAttributionFrom(q), null, q);
  assert.deepEqual(A.enProAttributionFrom('?lang=es&via=a@b.com'), { lang: 'es', via: null }, 'never personal data');

  const tagged = buildProHtml({ attribution: A.enProAttributionFrom('?lang=es&via=soccer') });
  const ctas = hrefs(tagged).filter((h) => h.startsWith('https://buy.stripe.com/'));
  assert.equal(ctas.length, 2, 'hero + final checkout buttons');
  for (const h of ctas) {
    const u = new URL(h);
    assert.equal(`${u.origin}${u.pathname}`, ALL_ACCESS.checkoutUrl, 'same Payment Link');
    assert.deepEqual([...u.searchParams.entries()], [['locale', 'es'], ['client_reference_id', 'pbe-es-pro-soccer']]);
  }
  assert.ok(tagged.includes('data-pbe-locale="es" data-pbe-via="soccer"'), 'GA4 network_cta_click carries checkout_locale + via');

  const plain = buildProHtml({});
  assert.deepEqual(hrefs(plain).filter((h) => h.startsWith('https://buy.stripe.com/')), [ALL_ACCESS.checkoutUrl, ALL_ACCESS.checkoutUrl], 'untagged /pro unchanged');
  assert.ok(!plain.includes('data-pbe-via'));

  assert.ok(proServerHtml({ attribution: { lang: 'es', via: 'golf' } }).includes(`${ALL_ACCESS.checkoutUrl}?locale=es&amp;client_reference_id=pbe-es-pro-golf`));
  assert.ok(proServerHtml({}).includes(`href="${ALL_ACCESS.checkoutUrl}"`));
  assert.throws(() => A.clientReferenceId('es', 'bad tag'), /invalid client_reference_id/);
  for (const via of A.VIA) assert.match(A.clientReferenceId('es', via), /^[A-Za-z0-9_-]{1,200}$/);
});

test('/es/pro is PREPARED, not public: not routed, not in hreflang/sitemap/language links, middleware 404 + noindex', () => {
  assert.equal(G.intlRoute('/es/pro'), null);
  assert.equal(G.documentLang('/es/pro'), 'en');
  assert.deepEqual(G.preparedIntlRoute('/es/pro/'), { kind: 'pro', lang: 'es', path: '/es/pro', ready: false });
  assert.equal(G.preparedIntlRoute('/ja/pro'), null);
  assert.equal(G.INTL_PRO_LANGS.includes('es'), false);
  assert.equal(G.proAlternates().some((a) => a.hreflang === 'es'), false);
  for (const [path, html] of PAGES) assert.equal(/href="\/es\//.test(html), false, `${path} must not link /es/`);
  assert.equal(read('api/sitemap.js').includes('/es/'), false, 'not in the sitemap');
  const mw = read('middleware.js');
  assert.match(mw, /if \(preparedIntlRoute\(pathname\)\) return notFoundMeta\(pathname, 'Page not found'\);/);
  assert.ok(mw.indexOf('preparedIntlRoute(pathname)') < mw.indexOf("if (pathname === '/pro')"));
  // Even if rendered, its head is noindex and announces no translations.
  const h = G.intlHead(G.preparedIntlRoute('/es/pro'));
  assert.equal(h.robots, 'noindex, nofollow');
  assert.deepEqual(h.alternates, []);
});

test('/es/pro never goes public with an unreviewed legal placeholder (B1/B2)', () => {
  assert.equal(G.hasLegalPlaceholder('es'), true, 'reviewed legal text is still owed');
  for (const lang of G.INTL_PRO_LANGS) assert.equal(G.hasLegalPlaceholder(lang), false, `${lang} is public, so it must carry no placeholder`);
  const html = G.intlProHtml('es', { via: 'golf' });
  assert.match(html, /data-pbe-legal-placeholder="B1,B2"/);
  assert.match(html, /PENDIENTE DE REVISIÓN LEGAL/);
  // No invented consumer terms: no refund / withdrawal / governing-law promises in the copy.
  const t = text(html).toLowerCase();
  for (const w of ['no reembolsable', 'no se reembolsa', 'sin reembolso', '14 días', 'minnesota', 'jurisdicción']) assert.equal(t.includes(w), false, w);
  const termsAt = html.indexOf('pbe-intl-terms'), lastCta = html.lastIndexOf('all_access_checkout');
  assert.ok(termsAt > 0 && termsAt < lastCta, 'terms (with placeholder) precede the final checkout button');
});

test('/es/pro content: same price and Payment Link, es attribution, every sport, no sportsbook/referral links, no English UI', () => {
  const html = G.intlProHtml('es', { via: 'golf' });
  assert.ok(html.includes('US$29'));
  assert.ok(html.includes('lang="es"') && html.includes('data-pbe-locale="es"'));
  const stripe = hrefs(html).filter((h) => h.startsWith('https://buy.stripe.com/'));
  assert.deepEqual(stripe, [G.checkoutUrlFor('es', 'golf'), G.checkoutUrlFor('es', 'golf')]);
  assert.equal(G.checkoutUrlFor('es', 'golf'), `${ALL_ACCESS.checkoutUrl}?locale=es&client_reference_id=pbe-es-pro-golf`);
  for (const s of SPORTS) assert.ok(html.includes(`data-sport="${s.key}"`), s.key);
  assert.ok(html.includes('https://soccer.propbetedge.ai/es/') && html.includes('https://golf.propbetedge.ai/es/'), 'Spanish editions linked');
  const lower = html.toLowerCase();
  for (const word of ['kalshi', 'polymarket', 'sportsbook', 'draftkings', 'fanduel', '/go/', '1-800', 'gambler', 'odds', 'wager', 'cuotas', 'apuesta ya']) assert.equal(lower.includes(word), false, word);
  for (const href of hrefs(html)) {
    const ok = href.startsWith('/') || href.startsWith('#') || href.startsWith('mailto:support@proptechusa.ai')
      || /^https:\/\/([a-z0-9-]+\.)?propbetedge\.ai(\/|$)/.test(href) || href.startsWith('https://buy.stripe.com/') || href.startsWith('https://billing.stripe.com/');
    assert.ok(ok, `unexpected link ${href}`);
  }
  const ES_ALLOWED = new Set([...ALLOWED_LATIN, 'IA', 'ATP', 'WTA', 'DNA', 'Español', 'nowcast', 'majors', 'rankings', 'multivista', 'Multivista', 'Cripto', 'cripto', 'Macro', 'macro', 'Player', 'Course']);
  // Spanish is Latin script, so check for common English UI words instead of any Latin word.
  const ENGLISH_UI = ['the', 'and', 'with', 'your', 'get', 'sign', 'open', 'view', 'month', 'membership', 'copy', 'copied', 'code', 'language', 'terms', 'privacy', 'support', 'members', 'live'];
  const words = text(html).match(/[A-Za-zÁÉÍÓÚÑáéíóúñü][A-Za-zÁÉÍÓÚÑáéíóúñü0-9']*/g) || [];
  const stray = [...new Set(words.filter((w) => ENGLISH_UI.includes(w.toLowerCase()) && !ES_ALLOWED.has(w)))];
  assert.deepEqual(stray, [], stray.join(', '));
});

test('Sigma pack: 08 parses every tag this code emits (es included); schema gaps fixed', () => {
  const s08 = read('docs/global/sigma/08_locale_attribution.sql');
  assert.match(s08, /split_part\(cs\.client_reference_id, '-', 2\)/);
  assert.match(s08, /split_part\(cs\.client_reference_id, '-', 4\)/);
  for (const tag of ['pbe-es-pro-golf', 'pbe-es-pro-soccer']) assert.ok(s08.includes(tag), `08 documents ${tag}`);
  // split_part semantics: page_lang = part 2, via = part 4. No via or lang may contain '-'.
  for (const lang of ['ja', 'ko', 'es']) {
    for (const via of [null, ...A.VIA]) {
      const parts = A.clientReferenceId(lang, via).split('-');
      assert.equal(parts[1], lang);
      assert.equal(parts[2], 'pro');
      assert.equal(parts[3], via ?? undefined);
      assert.equal(parts.length, via ? 4 : 3);
    }
  }
  assert.match(read('docs/global/sigma/00_schema_check.sql'), /select \* from checkout_sessions limit 0;/);
  for (const f of ['01_product_catalog', '03_active_subscriptions', '04_new_subscribers', '06_retention_cohorts']) {
    assert.equal(/\bi\.created\b/.test(read(`docs/global/sigma/${f}.sql`)), false, `${f}: Sigma invoices has date, not created`);
  }
});
