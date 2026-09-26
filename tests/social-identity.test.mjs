// PropBetEdge's own X identity + the network share card. Guards against the
// MLB-only alerts account (or the never-owned @propbetedgeai) returning as the
// network identity, and against the logo creeping back in as the share image.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROPBETEDGE_X_URL, PROPBETEDGE_X_HANDLE, NETWORK_SOCIAL_IMAGE, xShareUrl } from '../src/social.js';
import { organizationSchema } from '../src/schema.js';
import { renderShareBar } from '../src/entity-graph/share-bar.js';
import { installHarnessFetch, restoreFetch, renderPage } from './ssr-harness.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STALE = [/x\.com\/MLBHRALERTSPBE/i, /@MLBHRALERTSPBE/i, /x\.com\/propbetedgeai/i, /@propbetedgeai/i, /twitter\.com\/intent\/tweet/i, /x\.com\/intent\/tweet/i];

function sourceFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, out);
    else if (/\.(m?js|html|json)$/.test(entry.name) && !entry.name.endsWith('.bak')) out.push(full);
  }
  return out;
}

const meta = (html, name) => {
  const attr = name.startsWith('twitter:') ? 'name' : 'property';
  const open = `<meta ${attr}="${name}" content="`;
  const i = html.indexOf(open);
  return i < 0 ? undefined : html.slice(i + open.length, html.indexOf('"', i + open.length));
};
const count = (html, needle) => html.split(needle).length - 1;

test('canonical X identity constants', () => {
  assert.equal(PROPBETEDGE_X_URL, 'https://x.com/PROPBETEDGE');
  assert.equal(PROPBETEDGE_X_HANDLE, '@PROPBETEDGE');
});

test('no stale PropBetEdge X identity or legacy share intent in production source', () => {
  const files = [...sourceFiles(path.join(ROOT, 'src')), ...sourceFiles(path.join(ROOT, 'api')), path.join(ROOT, 'middleware.js'), path.join(ROOT, 'index.html')];
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    for (const re of STALE) assert.doesNotMatch(text, re, `${path.relative(ROOT, file)} contains ${re}`);
  }
});

test('X share intents are encoded x.com/intent/post URLs, never the profile', () => {
  const u = new URL(xShareUrl({ text: 'Judge & Ohtani: 50/50?', url: 'https://propbetedge.ai/news/mlb/a b?x=1' }));
  assert.equal(u.origin + u.pathname, 'https://x.com/intent/post');
  assert.equal(u.searchParams.get('text'), 'Judge & Ohtani: 50/50?');
  assert.equal(u.searchParams.get('url'), 'https://propbetedge.ai/news/mlb/a b?x=1');
  assert.doesNotMatch(u.toString(), / |&O/);
  const bar = renderShareBar('https://propbetedge.ai/news/mlb/story', 'A "quoted" & title');
  const xHref = [...bar.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&')).find((h) => h.includes('x.com'));
  assert.ok(xHref.startsWith('https://x.com/intent/post?'));
  assert.equal(new URL(xHref).searchParams.get('url'), 'https://propbetedge.ai/news/mlb/story');
  assert.match(bar, /rel="noopener noreferrer/);
});

test('Organization sameAs carries the canonical X profile exactly once', () => {
  const org = organizationSchema();
  assert.equal(org.sameAs.filter((u) => u === PROPBETEDGE_X_URL).length, 1);
  assert.equal(org.sameAs.length, new Set(org.sameAs).size);
  const shell = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.equal(count(shell, `"${PROPBETEDGE_X_URL}"`), 1);
});

test('network share card asset is a 1200x630 RGB PNG', () => {
  const buf = fs.readFileSync(path.join(ROOT, 'public/og/propbetedge-network-1200x630.png'));
  assert.equal(buf.subarray(1, 4).toString('latin1'), 'PNG');
  assert.equal(buf.readUInt32BE(16), 1200);
  assert.equal(buf.readUInt32BE(20), 630);
  assert.equal(buf[25], 2, 'colour type 2 = RGB, no alpha');
  assert.equal(new URL(NETWORK_SOCIAL_IMAGE.url).pathname, '/og/propbetedge-network-1200x630.png');
});

test('homepage and generic pages ship the network card with coherent meta', async (t) => {
  installHarnessFetch();
  try {
    for (const p of ['/', '/about', '/editorial-standards', '/news', '/news/mlb']) {
      const { status, html } = await renderPage(p);
      await t.test(p, () => {
        assert.equal(status, 200);
        assert.equal(meta(html, 'og:image'), NETWORK_SOCIAL_IMAGE.url);
        assert.equal(meta(html, 'og:image:secure_url'), NETWORK_SOCIAL_IMAGE.url);
        assert.equal(meta(html, 'og:image:type'), 'image/png');
        assert.equal(meta(html, 'og:image:width'), '1200');
        assert.equal(meta(html, 'og:image:height'), '630');
        assert.equal(meta(html, 'og:image:alt'), NETWORK_SOCIAL_IMAGE.alt);
        assert.equal(meta(html, 'twitter:card'), 'summary_large_image');
        assert.equal(meta(html, 'twitter:site'), PROPBETEDGE_X_HANDLE);
        assert.equal(meta(html, 'twitter:image'), meta(html, 'og:image'));
        assert.equal(meta(html, 'twitter:image:alt'), NETWORK_SOCIAL_IMAGE.alt);
        for (const tag of ['property="og:image"', 'name="twitter:site"', 'name="twitter:image"', 'rel="canonical"']) {
          assert.equal(count(html, tag), 1, `duplicate ${tag}`);
        }
        assert.equal(html.match(/<link rel="canonical" href="([^"]+)"/)?.[1], `https://propbetedge.ai${p === '/' ? '/' : p}`);
        assert.match(html.match(/<meta name="robots" content="([^"]*)"/)?.[1] || '', /^index, follow/);
        assert.doesNotMatch(html, /\/logo\/pbe-full-600\.png/);
      });
    }
  } finally {
    restoreFetch();
  }
});

test('footer X links: canonical account, new tab, safe rel, accessible name, no "Twitter" label', () => {
  const footer = fs.readFileSync(path.join(ROOT, 'src/components/footer.js'), 'utf8');
  const anchors = [...footer.matchAll(/<a href="\$\{PROPBET_LINKS\.twitter\}"[^>]*>[\s\S]*?<\/a>/g)].map((m) => m[0]);
  assert.equal(anchors.length, 1, 'one PropBetEdge X control: the icon in the Follow PropBetEdge bar');
  for (const a of anchors) {
    assert.match(a, /target="_blank" rel="noopener noreferrer"/);
    assert.match(a, /aria-label="Follow PropBetEdge on X \(@PROPBETEDGE\)"/);
    assert.match(a, /title="Follow PropBetEdge on X"/);
  }
  assert.doesNotMatch(footer, /X \/ Twitter|>\s*Twitter\s*</);
});
