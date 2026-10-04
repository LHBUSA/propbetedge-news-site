// Founder / technical-operator profile (/authors/justin-erickson): registry-driven, no invented metrics, Person schema.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { AUTHOR_PROFILES, listAuthors } from '../src/editorial/authors-registry.js';
import { profilePageSchema } from '../src/schema.js';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const justin = AUTHOR_PROFILES['justin-erickson'];
const founderSrc = read('src/pages/author-founder.js');
const authorSrc = read('src/pages/author.js');

test('variant is selected by the explicit registry field, never by slug', () => {
  assert.equal(justin.profileVariant, 'founder');
  assert.match(authorSrc, /author\.profileVariant === 'founder' && author\.founder\) return renderFounderProfile\(root, slug, author\)/);
  assert.doesNotMatch(founderSrc + authorSrc, /slug === ['"]justin-erickson['"]/);
  for (const a of listAuthors().filter((x) => x.slug !== 'justin-erickson')) assert.equal(a.profileVariant, undefined, `${a.slug} keeps the standard profile`);
});

test('content comes from the canonical registry: positioning, facts, pillars, principles; no counts or metrics', () => {
  const f = justin.founder;
  assert.ok(typeof f.positioning === 'string' && f.positioning.length > 40, 'positioning comes from the registry');
  assert.deepEqual(f.pillars.map((p) => p.title), ['Sports Intelligence', 'Data Infrastructure', 'Model Governance']);
  assert.deepEqual(f.principles.map((p) => p.title), ['Evidence over fluency', 'Never rewrite the record', 'Models are probabilities', 'Build the tooling']);
  const text = JSON.stringify(f) + justin.bio + justin.summary;
  assert.doesNotMatch(text, /\d+\+|Workers|books|records? (in|on) file|TB|GB|million/i, 'no ageing metrics');
  // Owner-approved real portrait (same photo as justinerickson.co), self-hosted at the declared sizes.
  assert.equal(justin.image, '/authors/justin-erickson-960.jpg');
  for (const u of [...justin.imageSet.jpg, ...justin.imageSet.webp]) assert.ok(fs.existsSync(new URL(`../public${u}`, import.meta.url)), u);
});

test('page structure: hero, what I build, principles, accountability, expertise grid, latest work, network; footer without generic CTA', async () => {
  for (const s of ['class="fdr-hero"', 'What I build', 'Operating principles', 'Named human byline', 'Read Editorial Standards →', 'class="fdr-cap"', 'id="latest-work"', 'Across the network']) assert.ok(founderSrc.includes(s), s);
  assert.match(founderSrc, /\$\{renderFooter\(\{ cta: false \}\)\}/);
  assert.doesNotMatch(founderSrc, /renderHomeCloser|import '[^']*\.css'/);
  assert.match(read('src/main.js'), /import '\.\/styles\/founder-profile\.css';/);
  assert.match(founderSrc, /escapeHtml\(author\.accountability\)/, 'accountability text is the registry copy');
});

test('latest work: newest article is the lead, impact badge only when present, filters only for sports the feed contains', async () => {
  const mod = await import('../src/pages/author-founder.js');
  const arts = [
    { title: 'A', slug: 'a', sport: 'nfl', published_at: '2026-10-04T16:00:00Z', summary: 'dek a', take: { impact_score: 4 } },
    { title: 'B', slug: 'b', sport: 'mlb', published_at: '2026-10-04T15:00:00Z', summary: 'dek b', take: { impact_score: 2 } },
    { title: 'C', slug: 'c', sport: 'wnba', published_at: '2026-10-04T14:00:00Z' },
  ];
  const html = mod.workHtml(arts);
  assert.ok(html.indexOf('class="fdr-lead"') < html.indexOf('class="fdr-grid"'));
  assert.match(html, /fdr-impact fdr-impact--high">Impact 4\/5/);
  assert.doesNotMatch(html, /Impact 2\/5/);
  assert.equal((html.match(/dek a/g) || []).length, 1, 'no repeated analysis text');
  assert.deepEqual(mod.filterBuckets(arts), ['all', 'mlb', 'nfl', 'other']);
  assert.deepEqual(mod.filterBuckets([arts[0]]), ['all', 'nfl']);
});

test('schema: ProfilePage -> Person with registry description + knowsAbout; operational byline still an Organization', () => {
  const s = profilePageSchema('justin-erickson', justin);
  assert.equal(s['@type'], 'ProfilePage');
  assert.equal(s.mainEntity['@type'], 'Person');
  assert.equal(s.mainEntity.description, justin.summary, 'same sentence as the page meta, not a truncated bio');
  assert.deepEqual(s.mainEntity.knowsAbout, [...justin.expertise]);
  assert.equal(s.mainEntity.image.url, 'https://propbetedge.ai/authors/justin-erickson-960.jpg');
  assert.equal(s.mainEntity.image.copyrightNotice, '© 2026 PropBetEdge', 'self-hosted author image follows the owned-image contract');
  assert.equal(profilePageSchema('propbetedge-editorial-team', AUTHOR_PROFILES['propbetedge-editorial-team']).mainEntity['@type'], 'Organization');
  const mw = read('middleware.js');
  assert.match(mw, /description: author\.summary \|\| undefined,/);
  assert.match(mw, /knowsAbout: isTeam \|\| !author\.expertise\?\.length \? undefined : \[\.\.\.author\.expertise\]/);
});
