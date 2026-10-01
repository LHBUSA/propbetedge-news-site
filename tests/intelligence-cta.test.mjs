// News -> Intelligence CTAs: one registry, canonical destinations, one analytics event per click.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  INTELLIGENCE_SPORTS, INTELLIGENCE_ORDER, intelligenceFor,
  renderSectionHeroCta, renderSectionNavCta, renderMoreThanNewsCta,
  renderNetworkIntelligenceRow, renderServerIntelligenceLink, intelligenceClickPayload,
} from '../src/intelligence-cta.js';

const EXPECTED = {
  mlb: ['https://mlb.propbetedge.ai/sharp-tools', 'Baseball intelligence beyond the box score.'],
  nfl: ['https://nfl.propbetedge.ai/', 'Football intelligence beyond the final score.'],
  nhl: ['https://nhl.propbetedge.ai/', 'Hockey intelligence beyond the scoreboard.'],
  nba: ['https://nba.propbetedge.ai/', 'Basketball intelligence beyond the box score.'],
  wnba: ['https://wnba.propbetedge.ai/', 'Women’s basketball intelligence beyond the box score.'],
  ufc: ['https://ufc.propbetedge.ai/', 'Fight intelligence beyond the result.'],
  tennis: ['https://tennis.propbetedge.ai/', 'Tennis intelligence beyond the scoreline.'],
  soccer: ['https://soccer.propbetedge.ai/', 'Soccer intelligence beyond the scoreline.'],
  golf: ['https://golf.propbetedge.ai/', 'Golf intelligence beyond the leaderboard.'],
};

const read = (rel) => fs.readFileSync(new URL(rel, import.meta.url), 'utf8');

// Minimal anchor stand-in: parses data-* attributes the way the DOM would.
function anchorFrom(html, selector = 'data-pbe-intel-cta') {
  const tag = html.match(new RegExp(`<a[^>]*${selector}[^>]*>`))?.[0];
  assert.ok(tag, 'CTA anchor rendered');
  const dataset = {};
  for (const [, name, value] of tag.matchAll(/data-([a-z-]+)="([^"]*)"/g)) {
    dataset[name.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
  }
  const href = tag.match(/href="([^"]*)"/)[1];
  return { dataset, href, tag };
}

test('nine sports, each on its canonical intelligence URL with its own copy', () => {
  assert.deepEqual([...INTELLIGENCE_ORDER].sort(), Object.keys(EXPECTED).sort());
  for (const [key, [href, line]] of Object.entries(EXPECTED)) {
    assert.equal(INTELLIGENCE_SPORTS[key].href, href, key);
    assert.equal(INTELLIGENCE_SPORTS[key].line, line, key);
    assert.ok(!/[?#]/.test(href), `${key}: no params/fragments on a canonical destination`);
  }
  assert.equal(intelligenceFor('NHL').key, 'nhl');
  assert.equal(intelligenceFor('cricket'), null);
});

test('every CTA opens in the same tab and carries analytics attributes', () => {
  const html = [
    renderSectionHeroCta('nhl'),
    renderSectionNavCta('nhl'),
    renderMoreThanNewsCta('nhl', { placement: 'section_footer', pageType: 'sport_index' }),
    renderNetworkIntelligenceRow(),
  ].join('');
  const anchors = html.match(/<a [^>]*>/g);
  assert.equal(anchors.length, 3 + INTELLIGENCE_ORDER.length);
  for (const a of anchors) {
    assert.ok(!/target=/.test(a), `same tab: ${a}`);
    assert.match(a, /data-pbe-intel-cta="[a-z_]+"/);
    assert.match(a, /data-pbe-intel-sport="[a-z]+"/);
  }
  assert.match(renderSectionHeroCta('nhl'), /Hockey intelligence beyond the scoreboard\./);
  assert.match(renderSectionHeroCta('nhl'), /Open NHL Intelligence/);
});

test('click payload has sport, page type, slug, placement and destination', () => {
  const html = renderMoreThanNewsCta('mlb', { placement: 'article_footer', pageType: 'article', slug: 'some-story-2026-09-26' });
  assert.deepEqual(intelligenceClickPayload(anchorFrom(html)), {
    sport: 'mlb',
    source_page_type: 'article',
    article_slug: 'some-story-2026-09-26',
    cta_placement: 'article_footer',
    destination: 'https://mlb.propbetedge.ai/sharp-tools',
  });
  assert.equal(intelligenceClickPayload({ dataset: {} }), null);
});

test('server render exposes the crawlable link', () => {
  assert.match(renderServerIntelligenceLink('nba'), /<a href="https:\/\/nba\.propbetedge\.ai\/">Open NBA Intelligence/);
  assert.equal(renderServerIntelligenceLink('xfl'), '');
  const mw = read('../middleware.js');
  assert.equal(mw.split('renderServerIntelligenceLink(').length - 1, 2, 'listing + article SSR');
});

test('analytics emits intelligence_cta_click exactly once per anchor', () => {
  const src = read('../src/analytics.js');
  assert.equal(src.split("'intelligence_cta_click'").length - 1, 1);
  assert.match(src, /anchor\.hasAttribute\('data-pbe-intel-cta'\)/, 'keyed on the anchor, not an ancestor');
});

test('surfaces use the registry, not raw product URLs', () => {
  for (const rel of ['../src/pages/sport.js', '../src/article-funnel.js', '../src/pages/news-index.js']) {
    assert.ok(!/https:\/\/(mlb|nfl|nba|nhl|wnba|ufc|tennis|soccer|golf)\.propbetedge\.ai\/?['"`]/.test(read(rel)), rel);
  }
  const header = read('../src/components/header.js');
  assert.match(header, /INTELLIGENCE_ORDER\.map/);
  assert.match(header, /placement: 'header_switcher'/);
  assert.match(header, /placement: 'header_sports'/);
  assert.match(header, /placement: 'mobile_more'/);
});

test('article funnel throttles instead of debouncing (score strip mutations never starve it)', () => {
  const src = read('../src/article-funnel.js');
  assert.match(src, /if \(timer\) return;/);
  assert.ok(!/clearTimeout\(timer\)/.test(src), 'a reset-on-mutation debounce never fires under the live score strip');
});
