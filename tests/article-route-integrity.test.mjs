// Owner P0 2026-10-04: an article must never show (or resurrect, after in-app navigation) the retired generic
// "Go deeper than the article." footer CTA or a generic end-of-article network billboard. The sport-specific
// MORE THAN NEWS closer (.pbe-intel-closer) and the real footer stay.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseEntryScript, isDeploymentStale, freshRouteRoot, isLiveRoot } from '../src/route-integrity.js';
import { renderFooter } from '../src/components/footer.js';

const article = fs.readFileSync('src/pages/article.js', 'utf8');
const router = fs.readFileSync('src/router.js', 'utf8');

test('article markup: no footer CTA, no generic end-of-article billboard, real footer, closer anchor kept', () => {
  assert.doesNotMatch(article, /footer-cta|Go deeper than the article|ad_footer_banner|renderFooter\(\)/);
  assert.doesNotMatch(article, /ad_brand_family\(\s*'end_of_article'/, 'no end-of-article network billboard');
  assert.doesNotMatch(article, /\bad_brand_family\b/, 'article.js only uses the in-article placements');
  assert.match(article, /\$\{ad_in_article_after_take\(articleContext\)\}/, 'legitimate in-article ad kept');
  assert.match(article, /ad_in_article_mid/, 'legitimate mid-article ad kept');
  assert.match(article, /\$\{renderPreferredSource\(\{ surface: 'article'/, 'Preferred Source kept');
  assert.match(article, /<div id="related-slot"><\/div>/, 'related stories slot (the closer anchors after it) kept');
  assert.match(article, /articleMarketSlot\(article, market\)/, 'Article Market kept');
  assert.match(article, /\$\{renderFooter\(\{ cta: false \}\)\}/);
  const footer = renderFooter();
  assert.match(footer, /<footer class="footer nf">/, 'normal footer renders');
  assert.doesNotMatch(footer, /footer-cta|Go deeper than the article\./);
  const funnel = fs.readFileSync('src/article-funnel.js', 'utf8');
  assert.match(funnel, /#related-slot/);
  assert.match(funnel, /renderMoreThanNewsCta\(sport, \{ placement: 'article_footer', pageType: 'article', slug \}\)/, '.pbe-intel-closer still injected');
});

test('article renderer and its late writers never paint into a later route', () => {
  const fn = (name) => { const i = article.indexOf(`function ${name}(`); assert.ok(i > 0, name); return article.slice(i, article.indexOf('\n}\n', i)); };
  // renderArticle: every await is followed by a live-root check before the next DOM write.
  const render = fn('renderArticle');
  for (const m of render.matchAll(/await [^\n]+\n/g)) {
    const after = render.slice(m.index + m[0].length);
    const guard = after.search(/isLiveRoot\(root\)/);
    const write = after.search(/innerHTML|renderNotFound\(|mount[A-Z]\w*\(/);
    assert.ok(guard >= 0 && (write < 0 || guard < write), `guard before next write after: ${m[0].trim()}`);
  }
  // Late writers resolve after paint: they must check the root and write only inside it.
  for (const name of ['attachGameEntity', 'loadRelated']) {
    const body = fn(name);
    assert.match(body, /if \(!isLiveRoot\(root\)\) return;/, name);
    assert.doesNotMatch(body, /document\.getElementById\('(in-this-story-slot|related-slot)'\)/, name);
  }
  assert.match(render, /loadRelated\(article, manifest, graph, root\);/);
  assert.match(render, /attachGameEntity\(article, manifest, graph, root\);/);
  for (const page of ['sport.js', 'news-index.js', 'home.js']) {
    assert.match(fs.readFileSync(`src/pages/${page}`, 'utf8'), /if \(!isLiveRoot\(root\)\) return;/, page);
  }
});

test('router: a fresh #app per route; stale bundles hard-navigate instead of SPA-rendering', () => {
  assert.match(router, /const root = freshRouteRoot\(\);/);
  assert.doesNotMatch(router, /getElementById\('app'\)/);
  assert.match(router, /if \(deploymentIsStale\(\)\) \{ window\.location\.assign\(href\); return; \}/);
  assert.match(router, /if \(deploymentIsStale\(\)\) \{ window\.location\.reload\(\); return; \}/);
  assert.match(router, /initDeploymentWatch\(\);/);
});

// Minimal DOM double: enough for freshRouteRoot/isLiveRoot semantics.
function fakeDocument() {
  const body = { children: [], appendChild(n) { n.parent = body; this.children.push(n); } };
  const make = () => ({
    id: '', className: '', innerHTML: '', parent: null,
    get isConnected() { return Boolean(this.parent) && body.children.includes(this); },
    removeAttribute(a) { if (a === 'id') this.id = ''; },
    replaceWith(n) { const i = body.children.indexOf(this); body.children[i] = n; n.parent = body; this.parent = null; },
  });
  return { body, createElement: make, getElementById: (id) => body.children.find((c) => c.id === id) || null, make };
}

test('navigation simulation: A -> B -> back; a late render of an earlier route never reaches the screen', () => {
  const doc = fakeDocument();
  const first = doc.make(); first.id = 'app'; doc.body.appendChild(first);
  const visible = () => doc.getElementById('app').innerHTML;

  // A late render only writes if its root is still live (what every renderer now does).
  const lateRender = (root, html) => { if (isLiveRoot(root)) root.innerHTML = html; };

  const sportRoot = freshRouteRoot(doc);            // /news/mlb
  sportRoot.innerHTML = '<section>MLB sport page</section><footer class="footer nf"></footer>';
  const rootA = freshRouteRoot(doc);                 // -> article A (skeleton)
  rootA.innerHTML = '<article>A skeleton</article>';
  lateRender(sportRoot, '<section>late sport paint</section><footer class="footer nf"></footer>');
  assert.doesNotMatch(visible(), /late sport paint/);

  const rootB = freshRouteRoot(doc);                 // A -> B before A resolved
  rootB.innerHTML = '<article>B</article><div class="pbe-intel-closer"></div><footer class="footer nf"></footer>';
  lateRender(rootA, '<article>A resolved</article>');
  assert.match(visible(), /<article>B<\/article>/);
  assert.match(visible(), /pbe-intel-closer/);
  assert.match(visible(), /<footer class="footer nf">/);

  const rootBack = freshRouteRoot(doc);              // back/forward re-renders into its own root
  rootBack.innerHTML = '<article>A</article><div class="pbe-intel-closer"></div><footer class="footer nf"></footer>';
  lateRender(rootB, '<section>stale B paint</section>');
  assert.doesNotMatch(visible(), /stale B paint|ad-brand-family/);
  assert.equal(doc.body.children.filter((c) => c.id === 'app').length, 1, 'exactly one #app');
});

test('deployment skew detection', () => {
  const html = '<script type="module" crossorigin src="/assets/index-BfMgfVFC.js"></script>';
  assert.equal(parseEntryScript(html), '/assets/index-BfMgfVFC.js');
  assert.equal(parseEntryScript('<html></html>'), null);
  assert.equal(isDeploymentStale('/assets/index-old.js', '/assets/index-new.js'), true);
  assert.equal(isDeploymentStale('/assets/index-same.js', '/assets/index-same.js'), false);
  assert.equal(isDeploymentStale('/assets/index-old.js', null), false, 'unknown never forces a reload');
  assert.equal(isDeploymentStale(null, '/assets/index-new.js'), false);
});
