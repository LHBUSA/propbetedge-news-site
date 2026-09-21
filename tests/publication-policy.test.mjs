/**
 * tests/publication-policy.test.mjs
 *
 * The invariant this file exists to defend:
 *
 *   A byline is not a publication gate.
 *
 * Hard-excluding a former contributor made ~2,900 otherwise healthy archive
 * URLs serve 404 + noindex, and it did so from TWO places that had drifted
 * apart — news-integrity.js withheld the article while src/api.js separately
 * filtered it out. Both paths are asserted here so they cannot diverge again.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  applyArticlePublicationPolicy,
  assessArticleIntegrity,
  filterPublicArticles,
  isReattributedAuthor,
  EDITORIAL_TEAM_BYLINE,
} from '../news-integrity.js';

const FORMER_CONTRIBUTORS = ['Donneal Green', 'Eric Esters'];

function historicalArticle(author) {
  return {
    id: 'a1',
    sport: 'mlb',
    slug: 'historic-story-2024-05-02',
    title: 'Bregman Powers Astros Past Mariners In Extra Innings',
    summary: 'A long, specific summary about the Astros beating the Mariners in extra '
      + 'innings, written well enough to serve as a real meta description.',
    body: 'Alex Bregman powered the Astros past the Mariners in extra innings on Thursday. '
      + 'The Astros bullpen held, and Seattle stranded the tying run at third. '
      + 'Houston now leads the season series.',
    author,
    published_at: '2024-05-02T23:14:00.000Z',
    category: 'recap',
    image_url: 'https://cdn.example.com/photo.jpg',
    source_url: 'https://example.com/story',
  };
}

// ─── the invariant ───────────────────────────────────────────────────────────

test('a former contributor byline never withholds an otherwise valid article', () => {
  for (const author of FORMER_CONTRIBUTORS) {
    const article = applyArticlePublicationPolicy(historicalArticle(author));
    assert.ok(article, `${author} article was withheld purely on its byline`);
    assert.equal(assessArticleIntegrity(article).ok, true);
  }
});

test('a former contributor is reattributed to the editorial team', () => {
  for (const author of FORMER_CONTRIBUTORS) {
    const article = applyArticlePublicationPolicy(historicalArticle(author));
    assert.equal(article.author, EDITORIAL_TEAM_BYLINE);
    assert.equal(article._author_reattributed, true);
  }
});

test('reattribution changes the byline and nothing else', () => {
  for (const author of FORMER_CONTRIBUTORS) {
    const before = historicalArticle(author);
    const after = applyArticlePublicationPolicy(before);

    for (const field of [
      'id', 'sport', 'slug', 'title', 'summary', 'body',
      'published_at', 'category', 'image_url', 'source_url',
    ]) {
      assert.deepEqual(after[field], before[field], `${field} was altered during reattribution`);
    }
    // The original object is never mutated in place.
    assert.equal(before.author, author);
  }
});

test('a current byline passes through untouched', () => {
  const before = historicalArticle('Justin Erickson');
  const after = applyArticlePublicationPolicy(before);
  assert.equal(after.author, 'Justin Erickson');
  assert.equal(after._author_reattributed, undefined);
});

// ─── the gates that DO still apply ───────────────────────────────────────────

test('reattribution does not bypass the title/body mismatch gate', () => {
  const article = historicalArticle('Donneal Green');
  article.title = 'Kelvin Banks Expected To Undergo Ankle Surgery';
  article.body = 'The Vikings entered Week 1 as fourth-choice favorites in NFC North odds, '
    + 'a positioning that reflected caution about roster construction and nothing else. '
    + 'Minnesota spent the offseason reshaping its offensive line and secondary depth chart. '
    + 'None of that has any bearing on the headline above this paragraph.';
  const policed = applyArticlePublicationPolicy(article);
  assert.ok(policed, 'the byline must not be the reason it is withheld');
  assert.equal(assessArticleIntegrity(policed).ok, false, 'a genuinely mismatched story stays withheld');
  assert.equal(assessArticleIntegrity(policed).reason, 'title_body_mismatch');
});

test('reattribution does not bypass the missing-title gate', () => {
  const article = historicalArticle('Donneal Green');
  article.title = '';
  const policed = applyArticlePublicationPolicy(article);
  assert.equal(assessArticleIntegrity(policed).reason, 'missing_title');
});

test('reattribution does not bypass the duplicate-summary gate', () => {
  const shared = 'The exact same long summary text repeated across two different stories, '
    + 'which is the signature of the upstream duplication bug this gate exists to catch.';
  const a = { ...historicalArticle('Donneal Green'), slug: 'a', summary: shared };
  const b = { ...historicalArticle('Justin Erickson'), slug: 'b', summary: shared };
  const c = { ...historicalArticle('Justin Erickson'), slug: 'c', summary: shared };
  const served = filterPublicArticles([a, b, c]);
  assert.ok(served.length < 3, 'duplicate summaries must still be caught after reattribution');
});

// ─── the two policy paths must agree ─────────────────────────────────────────

test('src/api.js holds no second, hidden exclusion path', () => {
  const api = readFileSync(new URL('../src/api.js', import.meta.url), 'utf8');

  const fingerprints = api.match(/const RETIRED_AUTHOR_FINGERPRINTS = new Set\(([^)]*)\)/)?.[1] ?? '';
  assert.equal(
    fingerprints.replace(/[\s[\]]/g, ''), '',
    'RETIRED_AUTHOR_FINGERPRINTS must be empty: an author is reattributed, never dropped',
  );

  // Every author news-integrity.js reattributes must also be reattributed here.
  for (const author of FORMER_CONTRIBUTORS) {
    assert.ok(isReattributedAuthor(author));
    assert.ok(
      api.includes(String(fnv1a(author))),
      `${author} is reattributed by news-integrity.js but missing from src/api.js`,
    );
  }
});

/** Mirrors authorFingerprint() in src/api.js. */
function fnv1a(value) {
  const normalized = String(value || '').trim().toLowerCase();
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
}
