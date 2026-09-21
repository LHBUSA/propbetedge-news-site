/**
 * tests/entity-linking.test.mjs
 *
 * Safety tests for the entity linker. These are the cases that turn a helpful
 * internal-linking system into a broken page if they regress: nested anchors,
 * partial-word matches, punctuation, namesakes, and text that must never be
 * rewritten at all (headings, alt attributes, script and code content).
 *
 * Run: node --test tests/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { resolvePlayer, resolveTeam, allPlayers, allTeams, teamQueryAbbreviations, SITE } from '../src/entity-graph/entities.js';
import { buildEntityManifest } from '../src/entity-graph/manifest.js';
import { linkifyArticleHtml } from '../src/entity-graph/linkify.js';
import { buildArticleSeo } from '../src/entity-graph/article-seo.js';
import { renderInThisStory } from '../src/entity-graph/in-this-story.js';
import { rankRelated } from '../src/entity-graph/related.js';
import { renderShareBar } from '../src/entity-graph/share-bar.js';
import { readFileSync } from 'node:fs';

// ─── helpers ─────────────────────────────────────────────────────────────────

function findPlayer(sport, name) {
  const { entity } = resolvePlayer(sport, name);
  return entity;
}

function manifestOf({ sport, players = [], teams = [], title = 'Test story', body = '', summary = '' }) {
  return buildEntityManifest({
    sport,
    title,
    summary,
    body,
    slug: 'test-story-2026-09-21',
    published_at: '2026-09-21T12:00:00.000Z',
    take: { players, teams },
  });
}

function anchors(html) {
  return [...html.matchAll(/<a\b[^>]*class="pbe-entity-link[^"]*"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => m[1]);
}

function hasNestedAnchor(html) {
  let depth = 0;
  for (const match of html.matchAll(/<(\/?)a\b[^>]*>/g)) {
    if (match[1]) depth = Math.max(0, depth - 1);
    else {
      depth += 1;
      if (depth > 1) return true;
    }
  }
  return false;
}

function linkOne(sport, bodyHtml, { players = [], teams = [] } = {}) {
  const manifest = manifestOf({ sport, players, teams, body: stripTags(bodyHtml) });
  return linkifyArticleHtml(bodyHtml, manifest);
}

function stripTags(html) {
  return String(html).replace(/<[^>]+>/g, ' ');
}

// ─── dictionary integrity ────────────────────────────────────────────────────

test('every dictionary player produces a route-shaped canonical URL', () => {
  for (const sport of ['mlb', 'nfl', 'nba', 'nhl']) {
    for (const player of allPlayers(sport)) {
      assert.match(player.id, /^\d+$/, `${sport} ${player.name} has a non-numeric id`);
      assert.equal(player.canonical_url, `${SITE}/player/${sport}/${player.id}`);
    }
  }
});

test('team slugs match the slug the team route resolves against', () => {
  const team = resolveTeam('nba', 'TOR');
  assert.equal(team.name, 'Toronto Raptors');
  assert.equal(team.canonical_url, `${SITE}/team/nba/toronto-raptors`);
});

// ─── resolution rules ────────────────────────────────────────────────────────

test('the same name in two sports resolves to two different real players', () => {
  const nba = findPlayer('nba', 'Jaden Bradley');
  const nfl = findPlayer('nfl', 'Jaden Bradley');
  assert.ok(nba && nfl);
  assert.notEqual(nba.id, nfl.id);
  assert.match(nba.canonical_url, /\/player\/nba\//);
  assert.match(nfl.canonical_url, /\/player\/nfl\//);
});

test('identical surnames inside one sport are reported ambiguous, never guessed', () => {
  const result = resolvePlayer('mlb', 'Max Muncy');
  assert.equal(result.entity, null);
  assert.equal(result.reason, 'ambiguous');
  assert.ok(result.candidates.length > 1);
});

test('an article that names the team breaks a namesake tie', () => {
  const ambiguous = resolvePlayer('nfl', 'Justin Jefferson');
  assert.equal(ambiguous.entity, null, 'precondition: this name is a real NFL namesake pair');

  const both = ambiguous.candidates.map((url) => url.split('/').pop());
  const first = allPlayers('nfl').find((p) => p.id === both[0]);
  const narrowed = resolvePlayer('nfl', 'Justin Jefferson', { teamHints: [first.team_id] });
  assert.equal(narrowed.entity?.id, first.id);
});

test('team abbreviations are scoped to the sport', () => {
  assert.equal(resolveTeam('mlb', 'TOR').name, 'Toronto Blue Jays');
  assert.equal(resolveTeam('nba', 'TOR').name, 'Toronto Raptors');
});

test('newsroom abbreviation spellings ESPN does not use still resolve', () => {
  assert.equal(resolveTeam('nfl', 'GNB')?.name, 'Green Bay Packers');
  assert.equal(resolveTeam('mlb', 'CWS')?.name, 'Chicago White Sox');
});

test('an unknown name resolves to nothing rather than a nearby player', () => {
  const result = resolvePlayer('nfl', 'Notareal Personname');
  assert.equal(result.entity, null);
  assert.equal(result.reason, 'unknown');
});

test('team coverage queries every abbreviation the newsroom might have tagged', () => {
  // The dictionary is keyed on ESPN spellings, the newsroom tags its own.
  // Querying /news/by-team with only the ESPN spelling returns zero stories
  // for these three clubs, which is how this regressed in the first place.
  assert.deepEqual(teamQueryAbbreviations('nba', 'NY'), ['NY', 'NYK']);
  assert.deepEqual(teamQueryAbbreviations('nba', 'GS'), ['GS', 'GSW']);
  assert.deepEqual(teamQueryAbbreviations('nba', 'UTAH'), ['UTAH', 'UTA']);
  assert.deepEqual(teamQueryAbbreviations('nfl', 'GB'), ['GB', 'GNB']);
});

test('every team resolves from each of its own query abbreviations', () => {
  for (const sport of ['mlb', 'nfl', 'nba', 'nhl']) {
    for (const team of allTeams(sport)) {
      const keys = teamQueryAbbreviations(sport, team.abbr);
      assert.ok(keys.includes(team.abbr), `${sport} ${team.name} lost its own abbreviation`);
      for (const key of keys) {
        assert.equal(
          resolveTeam(sport, key)?.id, team.id,
          `${sport} ${key} should resolve back to ${team.name}`,
        );
      }
    }
  }
});

test('a team query accepts an entity or a bare abbreviation', () => {
  const team = resolveTeam('nba', 'NYK');
  assert.equal(team.name, 'New York Knicks');
  assert.deepEqual(teamQueryAbbreviations('nba', team.abbr), ['NY', 'NYK']);
  assert.deepEqual(teamQueryAbbreviations('nba', { abbreviation: 'NY' }), ['NY', 'NYK']);
  assert.deepEqual(teamQueryAbbreviations('nba', ''), []);
});

// ─── linking: the punctuation cases ──────────────────────────────────────────

test('initial-and-period names link ("A.J. Brown")', () => {
  const result = linkOne('nfl', '<p>A.J. Brown was targeted nine times.</p>', { players: ['A.J. Brown'] });
  assert.deepEqual(anchors(result.html), ['A.J. Brown']);
});

test('the same name written without periods still links', () => {
  const result = linkOne('nfl', '<p>AJ Brown was targeted nine times.</p>', { players: ['A.J. Brown'] });
  assert.deepEqual(anchors(result.html), ['AJ Brown']);
});

test('a possessive keeps the apostrophe outside the anchor', () => {
  const player = allPlayers('nfl').find((p) => p.name === 'Patrick Mahomes');
  assert.ok(player, 'precondition: Mahomes is on an NFL roster');
  const result = linkOne('nfl', "<p>Mahomes' pass sailed wide.</p>", { players: ['Patrick Mahomes'] });
  assert.deepEqual(anchors(result.html), ['Mahomes']);
  assert.ok(result.html.includes("</a>' pass"), 'the apostrophe must stay in the prose');
});

test('a curly apostrophe is treated as the same character', () => {
  const result = linkOne('nfl', '<p>Mahomes’ pass sailed wide.</p>', { players: ['Patrick Mahomes'] });
  assert.deepEqual(anchors(result.html), ['Mahomes']);
});

test('an HTML-escaped apostrophe inside a name still matches', () => {
  const player = allPlayers('nba').find((p) => p.name.includes("'"));
  if (!player) return; // no apostrophe names on the current rosters
  const written = player.name.replace("'", '&#39;');
  const result = linkOne('nba', `<p>${written} scored 20.</p>`, { players: [player.name] });
  assert.equal(anchors(result.html).length, 1);
});

test('hyphenated names match across hyphen glyphs', () => {
  const player = allPlayers('nfl').find((p) => p.name.includes('-'));
  assert.ok(player, 'precondition: a hyphenated name exists');
  const enDash = player.name.replace('-', '–');
  const result = linkOne('nfl', `<p>${enDash} had a big day.</p>`, { players: [player.name] });
  assert.equal(anchors(result.html).length, 1);
});

test('a name is never matched inside a longer word', () => {
  const result = linkOne('nba', '<p>The Raptorsville tournament opened.</p>', { teams: ['TOR'] });
  assert.equal(anchors(result.html).length, 0);
  assert.ok(result.html.includes('Raptorsville'));
});

test('a team name inside a longer phrase still links only the team name', () => {
  const result = linkOne('nba', '<p>The Toronto Raptors front office acted early.</p>', { teams: ['TOR'] });
  assert.deepEqual(anchors(result.html), ['Toronto Raptors']);
});

// ─── linking: safety boundaries ──────────────────────────────────────────────

test('text already inside an anchor is never re-linked', () => {
  const html = '<p><a href="https://example.com/story">Toronto Raptors sign guard</a> per report.</p>';
  const result = linkOne('nba', html, { teams: ['TOR'] });
  assert.equal(result.count, 0);
  assert.equal(hasNestedAnchor(result.html), false);
  assert.equal(result.html, html);
});

test('headings are left clean', () => {
  const result = linkOne('nba', '<h2>Toronto Raptors outlook</h2><p>Nothing else.</p>', { teams: ['TOR'] });
  assert.equal(result.count, 0);
});

test('image alt text is structurally unreachable', () => {
  const html = '<p><img src="/x.jpg" alt="Toronto Raptors celebrate" /> The game ended.</p>';
  const result = linkOne('nba', html, { teams: ['TOR'] });
  assert.equal(result.count, 0);
  assert.ok(result.html.includes('alt="Toronto Raptors celebrate"'));
});

test('script and style content is never rewritten', () => {
  const html = '<script>var team = "Toronto Raptors";</script>'
    + '<style>.x::after{content:"Toronto Raptors"}</style>'
    + '<p>Nothing to link here.</p>';
  const result = linkOne('nba', html, { teams: ['TOR'] });
  assert.equal(result.count, 0);
  assert.equal(result.html, html);
});

test('code blocks are never rewritten', () => {
  const html = '<pre><code>Toronto Raptors</code></pre><p>After the block.</p>';
  const result = linkOne('nba', html, { teams: ['TOR'] });
  assert.equal(result.count, 0);
});

test('only the first occurrence of an entity is linked', () => {
  const html = '<p>Toronto Raptors opened. Later the Toronto Raptors closed. '
    + 'Toronto Raptors again.</p>';
  const result = linkOne('nba', html, { teams: ['TOR'] });
  assert.equal(result.count, 1);
});

test('overlapping entity names resolve longest-first', () => {
  // "Toronto Blue Jays" must win over any shorter overlapping surface.
  const result = linkOne('mlb', '<p>The Toronto Blue Jays made a move.</p>', { teams: ['TOR'] });
  assert.deepEqual(anchors(result.html), ['Toronto Blue Jays']);
});

test('a common-word nickname is never linked on its own', () => {
  // "Wild" resolves as a team, but "wild card" must stay prose.
  const manifest = manifestOf({ sport: 'nhl', teams: ['MIN'] });
  assert.ok(manifest.teams.length >= 1);
  const result = linkifyArticleHtml('<p>They are chasing a Wild Card berth.</p>', manifest);
  assert.equal(result.count, 0);
});

test('a distinctive nickname does link', () => {
  const result = linkOne('nba', '<p>The Raptors acted early.</p>', { teams: ['TOR'] });
  assert.deepEqual(anchors(result.html), ['Raptors']);
});

test('lowercase prose never matches a team nickname', () => {
  const result = linkOne('nba', '<p>the raptors of the jungle are unrelated.</p>', { teams: ['TOR'] });
  assert.equal(result.count, 0);
});

test('the link cap is respected', () => {
  const body = '<p>' + ['TOR', 'BOS', 'NYY', 'LAD', 'SF', 'CHC']
    .map((abbr) => resolveTeam('mlb', abbr).name).join(' played ') + '.</p>';
  const manifest = manifestOf({ sport: 'mlb', teams: ['TOR', 'BOS', 'NYY', 'LAD', 'SF', 'CHC'] });
  const result = linkifyArticleHtml(body, manifest, { maxLinks: 2 });
  assert.equal(result.count, 2);
});

test('an article never links to itself', () => {
  const player = findPlayer('nba', 'Jaden Bradley');
  const manifest = manifestOf({ sport: 'nba', players: ['Jaden Bradley'] });
  const result = linkifyArticleHtml('<p>Jaden Bradley signed.</p>', manifest, {
    excludeUrls: [player.canonical_url],
  });
  assert.equal(result.count, 0);
});

test('linkified output never nests anchors and preserves all other bytes', () => {
  const html = '<p>Jaden Bradley of the <em>Toronto Raptors</em> signed. '
    + '<a href="/x">See more</a> &amp; read on.</p>';
  const result = linkOne('nba', html, { players: ['Jaden Bradley'], teams: ['TOR'] });
  assert.equal(hasNestedAnchor(result.html), false);
  assert.ok(result.html.includes('&amp;'), 'HTML entities must survive untouched');
  assert.ok(result.html.includes('<em>'), 'inline markup must survive untouched');
  assert.equal(stripTags(result.html).replace(/\s+/g, ' '), stripTags(html).replace(/\s+/g, ' '));
});

test('an empty or entity-free body is returned unchanged', () => {
  const manifest = manifestOf({ sport: 'nba', teams: ['TOR'] });
  assert.equal(linkifyArticleHtml('', manifest).html, '');
  const plain = '<p>Nothing relevant here at all.</p>';
  assert.equal(linkifyArticleHtml(plain, manifest).html, plain);
});

// ─── manifest and schema ─────────────────────────────────────────────────────

test('a persisted manifest is preferred but still validated against real ids', () => {
  const real = findPlayer('nba', 'Jaden Bradley');
  const manifest = buildEntityManifest({
    sport: 'nba',
    slug: 'x',
    title: 'x',
    entities: {
      players: [{ id: real.id, name: real.name }, { id: '999999999', name: 'Invented Person' }],
      teams: [{ id: 'TOR' }],
    },
  });
  assert.equal(manifest.source, 'persisted');
  assert.equal(manifest.players.length, 1);
  assert.equal(manifest.players[0].canonical_url, real.canonical_url);
  assert.ok(manifest.unresolved.some((u) => u.reason === 'persisted_id_unknown'));
});

test('schema about/mentions use the same URLs the page links to', () => {
  const article = {
    sport: 'nba',
    slug: 'raptors-story-2026-09-21',
    title: 'Raptors make a move',
    summary: 'A summary long enough to serve as a real meta description for this story.',
    body: 'Jaden Bradley signed with the Toronto Raptors today.',
    author: 'PropBetEdge Editorial Team',
    published_at: '2026-09-21T12:00:00.000Z',
    take: { players: ['Jaden Bradley'], teams: ['TOR'] },
  };
  const manifest = buildEntityManifest(article);
  const seo = buildArticleSeo(article, manifest);
  const [newsArticle, breadcrumbs] = seo.jsonLd['@graph'];

  assert.equal(newsArticle['@type'], 'NewsArticle');
  assert.equal(breadcrumbs['@type'], 'BreadcrumbList');
  assert.equal(newsArticle.headline, article.title);
  assert.equal(newsArticle.url, seo.canonical);
  assert.equal(newsArticle.datePublished, '2026-09-21T12:00:00.000Z');
  assert.equal(newsArticle.dateModified, newsArticle.datePublished);

  const schemaUrls = new Set((newsArticle.about || []).concat(newsArticle.mentions || []).map((n) => n.url));
  for (const entity of [...manifest.players, ...manifest.teams]) {
    assert.ok(schemaUrls.has(entity.canonical_url), `${entity.name} missing from about/mentions`);
  }

  assert.doesNotThrow(() => JSON.parse(JSON.stringify(seo.jsonLd)));
  // Editorial copy may legitimately contain the word "undefined"; what must
  // never appear is a VALUE that is the string "undefined", or a null.
  const walk = (node, out = []) => {
    if (node === null) out.push('null');
    else if (Array.isArray(node)) node.forEach((n) => walk(n, out));
    else if (typeof node === 'object') Object.values(node).forEach((n) => walk(n, out));
    else if (typeof node === 'string' && ['undefined', 'null', 'NaN'].includes(node.trim())) out.push(node);
    return out;
  };
  assert.deepEqual(walk(seo.jsonLd), []);
});

test('the share image is a stable PropBetEdge URL at social dimensions', () => {
  const article = { sport: 'nba', slug: 'x-2026-09-21', title: 'T', published_at: '2026-09-21T00:00:00Z' };
  const seo = buildArticleSeo(article, buildEntityManifest(article));
  assert.match(seo.image.url, /^https:\/\/propbetedge\.ai\/api\/social-card\?/);
  assert.equal(seo.image.width, 1200);
  assert.equal(seo.image.height, 630);
  assert.equal(seo.image.variants.length, 3);
  assert.ok(!seo.image.url.includes('/logo/'), 'the house logo is never the article social image');
});

test('meta title carries the section without rewriting the headline', () => {
  const article = { sport: 'nfl', slug: 'x', title: 'Vikings name a starter', published_at: '2026-09-21T00:00:00Z' };
  const seo = buildArticleSeo(article, buildEntityManifest(article));
  assert.equal(seo.title, 'Vikings name a starter | PropBetEdge NFL');
  assert.ok(!/latest|AI prop bet|sports betting news/i.test(seo.description));
});

test('the entity bar renders a clickable chip for every entity', () => {
  const manifest = manifestOf({ sport: 'nba', players: ['Jaden Bradley'], teams: ['TOR'] });
  const html = renderInThisStory(manifest);
  assert.ok(html.includes('/player/nba/'));
  assert.ok(html.includes('/team/nba/toronto-raptors'));
  assert.equal((html.match(/<a /g) || []).length, manifest.players.length + manifest.teams.length);
  assert.ok(html.includes('alt=""'), 'chip portraits are decorative; the link text is the name');
});

test('the entity bar is omitted entirely when nothing resolved', () => {
  assert.equal(renderInThisStory({ players: [], teams: [], games: [] }), '');
});


// ─── share controls ──────────────────────────────────────────────────────────

const SHARE_URL = 'https://propbetedge.ai/news/nfl/a-real-story-2026-09-21';
const SHARE_TITLE = "Ravens' Week 2 Collapse Against Saints";
const shareBar = () => renderShareBar(SHARE_URL, SHARE_TITLE);

test('the share row is exactly Share, Copy link, X and LinkedIn', () => {
  const labels = [...shareBar().matchAll(/<span class="pbe-share-label"[^>]*>([^<]*)<\/span>/g)]
    .map((m) => m[1]);
  assert.deepEqual(labels, ['Share', 'Copy link', 'X', 'LinkedIn']);
});

test('platforms PropBetEdge does not maintain are absent from the markup and the CSS', () => {
  // Facebook and Reddit were removed on request; Bluesky followed. A share row
  // must not promote a surface we are not on.
  const markup = shareBar().toLowerCase();
  const css = readFileSync(new URL('../src/styles/pbe-entity-graph.css', import.meta.url), 'utf8').toLowerCase();
  for (const banned of ['facebook', 'sharer.php', 'reddit', 'bluesky', 'bsky']) {
    assert.ok(!markup.includes(banned), `${banned} is still in the share markup`);
    assert.ok(!css.includes(banned), `${banned} is still in the share styles`);
  }
});

test('no placeholder glyphs survive anywhere in the share UI', () => {
  const html = shareBar();
  for (const glyph of ['\u2197', '\u29c9', '\ud835\udd4f']) {
    assert.ok(!html.includes(glyph), `placeholder glyph ${JSON.stringify(glyph)} still rendered`);
  }
  // A lone letter standing in for a brand mark is the same failure.
  assert.ok(!/<span class="pbe-share-label"[^>]*>[a-z]<\/span>/.test(html));
});

test('every control carries a real inline SVG that is hidden from assistive tech', () => {
  const html = shareBar();
  const svgs = html.match(/<svg[^>]*>/g) || [];
  assert.equal(svgs.length, 4, 'one icon per control');
  for (const svg of svgs) {
    assert.match(svg, /aria-hidden="true"/, 'icons are decorative; the label names the action');
    assert.match(svg, /viewBox="0 0 24 24"/);
    assert.match(svg, /width="16"/);
  }
  assert.ok(!/<link[^>]+font|fontawesome|cdn/i.test(html), 'no external icon font');
});

test('the share bar ships no element ids, so two bars cannot collide', () => {
  // The server render and the client render can briefly coexist in one
  // document; a duplicated id would be invalid DOM.
  const html = shareBar();
  assert.equal((html.match(/\sid=/g) || []).length, 0);
  assert.ok(!html.includes('aria-labelledby'));
  assert.match(html, /role="group" aria-label="Share this article"/);
});

test('each network target has a distinct accessible name', () => {
  const names = [...shareBar().matchAll(/aria-label="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(names).size, names.length, 'accessible names must be unique');
  assert.ok(names.some((n) => /on X \(opens in a new tab\)/.test(n)));
  assert.ok(names.some((n) => /on LinkedIn \(opens in a new tab\)/.test(n)));
});

test('sharing uses the clean canonical URL with nothing appended', () => {
  const html = shareBar();
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));

  assert.equal(hrefs.length, 2);
  assert.ok(hrefs[0].startsWith('https://x.com/intent/tweet?'));
  assert.ok(hrefs[1].startsWith('https://www.linkedin.com/sharing/share-offsite/?url='));

  for (const href of hrefs) {
    const shared = new URL(href).searchParams.get('url');
    assert.equal(shared, SHARE_URL, 'the shared URL must be the canonical, untouched');
  }
  assert.ok(!/utm_|[?&]ref=/.test(html), 'no tracking parameters on our own URL');

  assert.equal(html.match(/data-share-url="([^"]+)"/)[1], SHARE_URL);
});

test('network targets work without JavaScript and the JS-only ones are buttons', () => {
  const html = shareBar();
  // Anchors for the networks: they must function with scripting off.
  assert.equal((html.match(/<a /g) || []).length, 2);
  for (const anchor of html.match(/<a [^>]*>/g) || []) {
    assert.match(anchor, /rel="noopener noreferrer nofollow"/);
    assert.match(anchor, /target="_blank"/);
  }
  // Native share and copy cannot work without JS, so they are buttons, and
  // native starts hidden until navigator.share is confirmed.
  assert.equal((html.match(/<button/g) || []).length, 2);
  assert.match(html, /data-pbe-share-native hidden/);
});

test('an empty canonical renders nothing rather than a broken row', () => {
  assert.equal(renderShareBar('', SHARE_TITLE), '');
});

// ─── related coverage ────────────────────────────────────────────────────────

test('a shared player outranks a merely recent story', () => {
  const current = {
    sport: 'nba', slug: 'a', title: 'A', published_at: '2026-09-01T00:00:00Z',
    take: { players: ['Jaden Bradley'], teams: ['TOR'] },
  };
  const manifest = buildEntityManifest(current);

  const samePlayerOld = {
    sport: 'nba', slug: 'b', title: 'B', published_at: '2026-07-01T00:00:00Z',
    take: { players: ['Jaden Bradley'], teams: [] },
  };
  const unrelatedRecent = {
    sport: 'nba', slug: 'c', title: 'C', published_at: '2026-09-01T00:00:00Z',
    take: { players: [], teams: ['BOS'] },
  };

  const ranked = rankRelated(current, manifest, [unrelatedRecent, samePlayerOld], { limit: 5 });
  assert.equal(ranked.items[0].article.slug, 'b');
  assert.equal(ranked.heading, 'More on Jaden Bradley');
});

test('an unrelated story from the same sport does not qualify as related', () => {
  const current = {
    sport: 'nba', slug: 'a', title: 'A', published_at: '2026-09-01T00:00:00Z',
    category: 'transaction', take: { players: ['Jaden Bradley'], teams: ['TOR'] },
  };
  const manifest = buildEntityManifest(current);
  const unrelated = {
    sport: 'nba', slug: 'z', title: 'Z', category: 'injury',
    published_at: '2026-06-01T00:00:00Z', take: { players: [], teams: ['BOS'] },
  };
  const ranked = rankRelated(current, manifest, [unrelated], { limit: 5 });
  assert.equal(ranked.items.length, 0);
});

test('the current article is never related to itself', () => {
  const current = {
    sport: 'nba', slug: 'a', title: 'A', published_at: '2026-09-01T00:00:00Z',
    take: { players: ['Jaden Bradley'], teams: ['TOR'] },
  };
  const manifest = buildEntityManifest(current);
  const ranked = rankRelated(current, manifest, [current], { limit: 5 });
  assert.equal(ranked.items.length, 0);
});
