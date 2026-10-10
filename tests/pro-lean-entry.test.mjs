/* /pro, /ja/pro, /ko/pro — lean page entries instead of the full newsroom SPA.
 *
 * Pins: Edge Middleware serves these three pages from the lean shells built by
 * vite.pro.config.js (and falls back to the app shell if a shell is missing);
 * every other route, including the prepared-but-404 /es/pro, keeps the app
 * shell; the shells are noindex files; the lean entries render through the same
 * page modules as the SPA router and run main.js's site-wide layers in main.js's
 * order; the stylesheet list is main.js's list in main.js's order minus a pinned
 * set of sheets scoped to other pages; search still opens; and the two site
 * background photographs are self-hosted.
 *
 *   node --test tests/pro-lean-entry.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const SITE = 'https://propbetedge.ai';

const SHELL_MARK = '<!-- lean-shell -->';
const APP_HTML = read('index.html');
const SHELL_HTML = APP_HTML.replace('<head>', `<head>${SHELL_MARK}`);

/* Run the real middleware with Vercel's plumbing stubbed: shells and the app shell come from memory. */
async function render(path, { shells = true } = {}) {
  const realFetch = globalThis.fetch;
  const fetched = [];
  globalThis.fetch = async (input, init) => {
    const req = input instanceof Request ? input : new Request(input, init);
    const url = new URL(req.url);
    if (url.origin !== SITE) return realFetch(input, init);
    fetched.push(url.pathname);
    if (url.pathname.startsWith('/_shell/')) {
      if (!shells) return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain' } });
      return new Response(SHELL_HTML, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex, nofollow' } });
    }
    return new Response(APP_HTML, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
  };
  try {
    const { default: middleware } = await import('../middleware.js');
    const res = await middleware(new Request(`${SITE}${path}`, { headers: { 'user-agent': 'Mozilla/5.0 (test)' } }));
    return { status: res.status, headers: res.headers, html: await res.text(), fetched };
  } finally {
    globalThis.fetch = realFetch;
  }
}

test('middleware: /pro, ?checkout=success and ?lang=es use the /pro lean shell', async () => {
  for (const path of ['/pro', '/pro/', '/pro?checkout=success', '/pro?lang=es&via=golf']) {
    const r = await render(path);
    assert.equal(r.status, 200, path);
    assert.deepEqual(r.fetched, ['/_shell/pro.html'], path);
    assert.ok(r.html.includes(SHELL_MARK), path);
    assert.ok(r.html.includes('data-server-rendered="1"'), `${path}: crawler bytes still injected`);
  }
  const success = await render('/pro?checkout=success');
  assert.equal(success.headers.get('x-robots-tag'), 'noindex, follow', 'success return keeps its own robots');
  const pro = await render('/pro');
  assert.equal(pro.headers.get('x-robots-tag'), null, 'the shell file noindex never leaks onto /pro');
  assert.match(pro.html, /<meta name="robots" content="index, follow, max-image-preview:large" \/>/);
  assert.match(pro.html, /buy\.stripe\.com\/8x2eVdgmOaqy4pv8Ez7wA0N/);
  const es = await render('/pro?lang=es&via=golf');
  assert.match(es.html, /buy\.stripe\.com\/8x2eVdgmOaqy4pv8Ez7wA0N\?locale=es&amp;client_reference_id=pbe-es-pro-golf/);
});

test('middleware: /ja/pro and /ko/pro use the localized lean shell', async () => {
  for (const [path, lang] of [['/ja/pro', 'ja'], ['/ko/pro', 'ko'], ['/ja/pro?via=golf', 'ja']]) {
    const r = await render(path);
    assert.equal(r.status, 200, path);
    assert.deepEqual(r.fetched, ['/_shell/intl-pro.html'], path);
    assert.ok(r.html.includes(SHELL_MARK), path);
    assert.match(r.html, new RegExp(`<html lang="${lang}"`), path);
    assert.equal(r.headers.get('x-robots-tag'), null, path);
    assert.match(r.html, /rel="preload" as="image" fetchpriority="high"/, `${path}: hero preload kept`);
  }
});

test('middleware: a missing shell falls back to the app shell (same page, full app)', async () => {
  for (const path of ['/pro', '/ja/pro']) {
    const r = await render(path, { shells: false });
    assert.equal(r.status, 200, path);
    assert.equal(r.fetched.at(-1), path.replace(/\/$/, ''), path);
    assert.ok(!r.html.includes(SHELL_MARK), path);
    assert.match(r.html, /src="\/src\/main\.js"/, path);
  }
});

test('middleware: every other route keeps the app shell; /es/pro stays 404 + noindex', async () => {
  const es = await render('/es/pro');
  assert.equal(es.status, 404);
  assert.match(es.headers.get('x-robots-tag') || '', /noindex/);
  assert.ok(!es.fetched.some((p) => p.startsWith('/_shell/')), '/es/pro never gets a lean shell');
  for (const path of ['/about', '/ja/legal/tokushoho', '/ko/legal/business', '/privacy']) {
    const r = await render(path);
    assert.ok(!r.fetched.some((p) => p.startsWith('/_shell/')), path);
    assert.ok(!r.html.includes(SHELL_MARK), path);
  }
});

test('shells are built after the main bundle and are noindex files', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.match(pkg.scripts.build, /vite build && vite build -c vite\.pro\.config\.js && node scripts\/verify-bundle-hosts\.mjs/);
  assert.deepEqual(Object.keys(JSON.parse(read('package.json')).dependencies), ['@vercel/edge', '@vercel/og'], 'no new dependencies');
  const cfg = read('vite.pro.config.js');
  assert.match(cfg, /pro: 'src\/pro-entry\.js'/);
  assert.match(cfg, /'intl-pro': 'src\/intl-pro-entry\.js'/);
  assert.match(cfg, /emptyOutDir: false/);
  const vercel = JSON.parse(read('vercel.json'));
  const rule = vercel.headers.find((h) => h.source === '/_shell/(.*)');
  assert.ok(rule, 'vercel.json: /_shell/ header rule');
  assert.deepEqual(rule.headers, [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }]);
  // The middleware matcher skips dotted paths, so the shell fetch never re-enters middleware.
  assert.match(read('middleware.js'), /\.\*\\\\\.\.\*/);
});

const cssImports = (src) => [...src.matchAll(/^import '\.\/([^']+\.css)';/gm)].map((m) => m[1]);
const initCalls = (src) => [...src.matchAll(/^\s*(init\w+|mount\w+)\(\);/gm)].map((m) => m[1]);

/* Sheets whose every rule targets another page (verified against the rendered
   /pro, ?checkout=success, /ja/pro and /ko/pro DOM on 2026-10-10). */
const EXCLUDED_CSS = [
  'styles/about.css', 'styles/story-image-integrity.css', 'styles/pbe-article-media.css', 'styles/pbe-article-visuals.css',
  'vendor/markets/article-market-ui.css', 'styles/pbe-article-market-theme.css', 'styles/pbe-intelligence-graph.css',
  'styles/pbe-impact-personalization.css', 'styles/pbe-board-author.css', 'styles/founder-profile.css',
  'styles/editorial-standards.css', 'styles/research.css',
];

test('lean boot: main.css then main.js stylesheets in main.js order, minus the pinned page-scoped sheets', () => {
  const boot = read('src/pro-boot.js');
  const expected = ['styles/main.css', ...cssImports(read('src/main.js')).filter((f) => !EXCLUDED_CSS.includes(f))];
  assert.deepEqual(cssImports(boot), expected);
  for (const f of ['styles/pbe-pro.css', 'styles/pbe-intl.css', 'vendor/pbe-locale/pbe-locale.css', 'styles/network-footer.css', 'styles/pbe-nav-v2.css', 'styles/pbe-search-reading.css', 'styles/pbe-search-network-upgrade.css', 'styles/pbe-entity-graph.css']) {
    assert.ok(cssImports(boot).includes(f), f);
  }
  for (const f of ['home-closer.css', 'games-hub-worldclass.css', 'player-history.css']) assert.ok(!boot.includes(f), f);
});

test('lean boot: main.js site-wide layers in main.js order; router replaced by the route render', () => {
  const main = initCalls(read('src/main.js'));
  const boot = read('src/pro-boot.js');
  const lean = initCalls(boot);
  const SKIPPED = ['initArticleFunnel', 'initMyEdge', 'initMyWriters', 'initPbeBoard', 'initAuthorDesks', 'initReadingExperience', 'initRouter'];
  const expected = main.filter((n) => !SKIPPED.includes(n)).map((n) => (n === 'initSearchPalette' ? 'initLazySearch' : n));
  assert.deepEqual(lean, expected);
  assert.match(boot, /initEngagementAnalytics\(\);\s*render\(routeRoot\(\)\);\s*initLivePlatformLaunch\(\);/);
  assert.match(boot, /const root = freshRouteRoot\(\);/);
  // The skipped layers only act on the homepage, articles or author pages.
  assert.match(read('src/my-edge.js'), /if \(window\.location\.pathname !== '\/'\)/);
  assert.match(read('src/my-writers.js'), /if \(window\.location\.pathname !== '\/'\)/);
  assert.match(read('src/pbe-board.js'), /if \(window\.location\.pathname !== '\/'\)/);
  assert.match(read('src/author-desk.js'), /\^\\\/authors\\\//);
  assert.match(read('src/reading-experience.js'), /\^\\\/news\\\//);
  assert.match(read('src/article-funnel.js'), /window\.location\.pathname\.match\(ARTICLE_RE\)/);
});

test('lean entries render through the same page modules as the SPA router', () => {
  const pro = read('src/pro-entry.js');
  assert.match(pro, /import \{ renderPro \} from '\.\/pages\/pro\.js';/);
  assert.match(pro, /renderPro\(root, setMeta\);/);
  const intl = read('src/intl-pro-entry.js');
  assert.match(intl, /import \{ renderIntlPage \} from '\.\/pages\/intl\.js';/);
  assert.match(intl, /renderIntlPage\(root, intl, setMeta\);/);
  assert.match(intl, /intl\.kind !== 'pro'/);
  const router = read('src/router.js');
  assert.match(router, /import \{ setMeta \} from '\.\/route-meta\.js';/);
  assert.match(router, /export \{ setMeta \};/);
  for (const f of ['src/pro-entry.js', 'src/intl-pro-entry.js', 'src/pro-boot.js']) {
    assert.doesNotMatch(read(f), /from '\.\/router\.js'|from '\.\/main\.js'|search-palette\.js'/, `${f} must not pull in the SPA or eager search`);
  }
});

test('lazy search: the same three triggers as the palette, palette loaded on first use', () => {
  const lazy = read('src/search-lazy.js');
  const palette = read('src/search-palette.js');
  for (const token of ["'[data-pbe-search-open]'", "'pbe:open-search'", "=== 'k'", "event.key === '/'"]) {
    assert.ok(palette.includes(token), `palette: ${token}`);
    assert.ok(lazy.includes(token), `lazy: ${token}`);
  }
  assert.match(lazy, /import\('\.\/search-palette\.js'\)/);
  assert.match(lazy, /m\.initSearchPalette\(\);/);
});

test('site background photographs are self-hosted with recorded provenance', () => {
  const ids = ['photo-1781650104690-a5309d91a26b', 'photo-1666366330282-b11566b272cf'];
  const files = ['src/styles/main.css', 'src/styles/background-selector.css', 'src/styles/pbe-personalization-polish.css', 'src/styles/pbe-scene-preview-fix.css', 'src/styles/pbe-background-assets.css', 'src/background-selector.js'];
  for (const f of files) for (const id of ids) assert.ok(!read(f).includes(id), `${f} still hot-links ${id}`);
  for (const name of ['network-night', 'wrigley-field']) {
    for (const w of [640, 1280, 2200]) for (const ext of ['avif', 'webp']) {
      assert.ok(existsSync(new URL(`../public/backgrounds/photo/${name}-${w}.${ext}`, import.meta.url)), `${name}-${w}.${ext}`);
    }
  }
  const prov = read('assets-src/backgrounds/PROVENANCE.md');
  for (const id of ids) assert.ok(prov.includes(id), id);
  assert.match(prov, /Unsplash License/);
  const assets = read('src/styles/pbe-background-assets.css');
  assert.match(assets, /body\[data-pbe-scene='network'\] \{\s*--pbe-scene-image: image-set\(url\('\/backgrounds\/photo\/network-night-2200\.avif'\) type\('image\/avif'\)/);
  assert.match(assets, /@media \(max-width: 720px\)/);
});
