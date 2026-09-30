import test from 'node:test';
import assert from 'node:assert/strict';
import {
  preferredSourceTarget,
  preferredSourceDeeplink,
  renderPreferredSource,
} from '../src/components/preferred-source.js';

test('eligible hosts use the SDK against their own source', () => {
  for (const host of ['propbetedge.ai', 'www.propbetedge.ai', 'mlb.propbetedge.ai', 'ufc.propbetedge.ai']) {
    const t = preferredSourceTarget(host);
    assert.equal(t.sdk, true, host);
    assert.equal(t.source, host.replace(/^www\./, ''));
  }
});

test('hosts Google does not list fall back to the parent via deeplink', () => {
  for (const host of ['nfl.propbetedge.ai', 'nba.propbetedge.ai', 'wnba.propbetedge.ai', 'nhl.propbetedge.ai',
    'tennis.propbetedge.ai', 'soccer.propbetedge.ai', 'propbetedge-news-site-git-x.vercel.app', 'localhost']) {
    assert.deepEqual(preferredSourceTarget(host), { source: 'propbetedge.ai', sdk: false }, host);
  }
});

test('deeplink is the documented preferences URL', () => {
  assert.equal(preferredSourceDeeplink('mlb.propbetedge.ai'), 'https://www.google.com/preferences/source?q=mlb.propbetedge.ai');
});

test('markup is our own control with a working href and no Google auto-render hook', () => {
  const footer = renderPreferredSource({ surface: 'footer' });
  assert.match(footer, /data-pbe-preferred-source/);
  assert.match(footer, /href="https:\/\/www\.google\.com\/preferences\/source\?q=propbetedge\.ai"/);
  assert.match(footer, /data-surface="footer"/);
  assert.match(footer, /data-sport="network"/);
  assert.doesNotMatch(footer, /google-add-preferred-source-btn/);

  const article = renderPreferredSource({ surface: 'article', sport: 'mlb' });
  assert.match(article, /Add PropBetEdge/);
  assert.match(article, /data-surface="article"/);
  assert.match(article, /data-sport="mlb"/);
});
