/**
 * tests/seo-canaries.test.mjs
 *
 * Crawler canaries. These assert against the bytes Edge Middleware actually
 * returns for a live article in every active league — not against a module's
 * return value. "JavaScript adds it later" is not an acceptable answer for any
 * of the checks below.
 *
 * Network-backed by design: it renders real stories through the real
 * middleware against the real news API.
 *
 * Run: node --test tests/seo-canaries.test.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { renderPage, fetchNews, SITE } from './ssr-harness.mjs';
import { applyArticlePublicationPolicy, assessArticleIntegrity } from '../news-integrity.js';

const SPORTS = ['mlb', 'nfl', 'nba', 'nhl'];
const SAMPLES_PER_SPORT = 5;

/**
 * Live article slugs per sport, restricted to stories the site actually
 * serves. The newsroom integrity gate withholds a meaningful share of the
 * archive as 404 + noindex; sampling those would test the gate, not the SEO
 * contract, and the gate has its own tests.
 */
async function sampleArticles(sport, count) {
  const data = await fetchNews(`/news/by-sport/${sport}?limit=${count * 8}&page=1`);
  return (data.articles || [])
    .filter((a) => a?.slug && a?.sport)
    .map(applyArticlePublicationPolicy)
    .filter((a) => a && assessArticleIntegrity(a).ok)
    .slice(0, count);
}

function meta(html, name) {
  const attribute = name.startsWith('twitter:') ? 'name' : 'property';
  const match = html.match(new RegExp(`<meta ${attribute}="${name}" content="([^"]*)"`, 'i'));
  return match ? match[1] : null;
}

function jsonLdGraph(html) {
  const match = html.match(/<script type="application\/ld\+json" id="pbe-server-primary-schema">([\s\S]*?)<\/script>/);
  if (!match) return null;
  return JSON.parse(match[1]);
}

function countOccurrences(html, needle) {
  return (html.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
}

for (const sport of SPORTS) {
  test(`${sport}: first-response HTML carries the full SEO contract`, async (t) => {
    const articles = await sampleArticles(sport, SAMPLES_PER_SPORT);
    assert.ok(articles.length > 0, `no ${sport} articles available to sample`);

    for (const article of articles) {
      const path = `/news/${article.sport}/${article.slug}`;
      const { status, html } = await renderPage(path);

      await t.test(path, () => {
        assert.equal(status, 200);

        // ── head ──────────────────────────────────────────────────────────
        const title = html.match(/<title>([\s\S]*?)<\/title>/)?.[1];
        assert.ok(title && title.length > 10, 'missing <title>');
        assert.ok(!title.includes('PropBetEdge — Sports News & Prop-Bet Intelligence'),
          'the default site title leaked onto an article');

        const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
        assert.equal(canonical, `${SITE}${path}`);
        assert.equal(countOccurrences(html, '<link rel="canonical"'), 1, 'duplicate canonical');

        const description = html.match(/<meta name="description" content="([^"]*)"/)?.[1];
        assert.ok(description && description.length > 30, 'missing meta description');

        assert.match(html.match(/<meta name="robots" content="([^"]*)"/)?.[1] || '', /index/);

        // ── social ────────────────────────────────────────────────────────
        assert.equal(meta(html, 'og:type'), 'article');
        assert.equal(meta(html, 'og:site_name'), 'PropBetEdge');
        assert.equal(meta(html, 'og:url'), `${SITE}${path}`);
        assert.ok(meta(html, 'og:title'));
        assert.ok(meta(html, 'og:description'));
        assert.equal(meta(html, 'og:image:width'), '1200');
        assert.equal(meta(html, 'og:image:height'), '630');
        assert.ok(meta(html, 'og:image:alt'));
        assert.ok(meta(html, 'article:published_time'));
        assert.ok(meta(html, 'article:section'));

        const ogImage = meta(html, 'og:image');
        assert.ok(ogImage && ogImage.startsWith(`${SITE}/api/social-card`),
          `article social image must be article-specific, got ${ogImage}`);
        assert.ok(!ogImage.includes('/logo/'), 'the house logo must not be the article social image');

        assert.equal(meta(html, 'twitter:card'), 'summary_large_image');
        assert.ok(meta(html, 'twitter:title'));
        assert.ok(meta(html, 'twitter:description'));
        assert.ok(meta(html, 'twitter:image'));
        assert.ok(meta(html, 'twitter:image:alt'));

        // No duplicated managed tags anywhere in the document.
        for (const tag of ['og:title', 'og:image', 'og:url', 'og:type', 'twitter:image']) {
          const attribute = tag.startsWith('twitter:') ? 'name' : 'property';
          assert.equal(
            countOccurrences(html, `<meta ${attribute}="${tag}"`), 1,
            `duplicate ${tag}`,
          );
        }

        // ── structured data ───────────────────────────────────────────────
        const graph = jsonLdGraph(html);
        assert.ok(graph, 'missing server JSON-LD');
        const types = graph['@graph'].map((node) => node['@type']);
        assert.ok(types.includes('NewsArticle'), 'missing NewsArticle');
        assert.ok(types.includes('BreadcrumbList'), 'missing BreadcrumbList');

        // Exactly one NewsArticle in the initial response.
        assert.equal(countOccurrences(html, '"@type":"NewsArticle"'), 1);

        const newsArticle = graph['@graph'].find((n) => n['@type'] === 'NewsArticle');
        assert.equal(newsArticle.url, `${SITE}${path}`);
        assert.ok(newsArticle.datePublished, 'missing datePublished');
        assert.ok(newsArticle.author?.name, 'missing author');
        assert.equal(newsArticle.publisher['@id'], `${SITE}/#organization`);
        assert.ok(Array.isArray(newsArticle.image) && newsArticle.image.length >= 1);

        assert.deepEqual(schemaJunk(graph), [], 'structural junk in schema');

        // Headline must match the visible H1.
        const h1 = html.match(/<h1>([\s\S]*?)<\/h1>/)?.[1];
        assert.ok(h1, 'missing server-rendered H1');
        assert.equal(decode(h1).trim(), newsArticle.headline.trim());

        // ── the entity graph itself ───────────────────────────────────────
        const entityLinks = [...html.matchAll(/<a href="(\/(?:player|team|games)\/[a-z]+\/[^"]+)"/g)]
          .map((m) => m[1]);

        const hasKnownEntities = (article.take?.players?.length || 0) > 0
          || (article.take?.teams?.length || 0) > 0;
        if (hasKnownEntities) {
          assert.ok(entityLinks.length > 0,
            'an article with tagged entities produced no server-visible entity link');
        }

        for (const href of entityLinks) {
          assert.match(href, /^\/(player|team|games)\/(mlb|nfl|nba|nhl)\/[A-Za-z0-9-]+$/,
            `malformed entity URL: ${href}`);
        }

        // Anchors must never nest.
        assert.equal(nestedAnchorDepth(html), false, 'nested anchor in server HTML');

        // Breadcrumb, entity bar and share controls are all server-visible.
        assert.ok(html.includes('class="pbe-breadcrumb"'), 'missing visible breadcrumb');
        assert.ok(html.includes('data-pbe-share-bar'), 'missing share controls');
        if (hasKnownEntities) {
          assert.ok(html.includes('pbe-in-this-story'), 'missing In this story bar');
        }
      });
    }
  });
}

test('a missing article is a real 404, not a soft one', async () => {
  const { status, html } = await renderPage('/news/nfl/this-article-does-not-exist-2026-01-01');
  assert.equal(status, 404);
  assert.match(html, /<meta name="robots" content="noindex/);
});

/**
 * Structural junk detector for JSON-LD.
 *
 * Deliberately not `JSON.stringify(x).includes('undefined')`: four archive
 * stories legitimately contain the word in their copy ("an undefined return
 * window for their ace"), and flagging those would be a false alarm that
 * trains everyone to ignore this check. What actually matters is a *value*
 * that is the string "undefined"/"null", or a URL with one interpolated into
 * it — both of which mean a template produced garbage.
 */
function schemaJunk(node, path = '$', found = []) {
  if (node === null) {
    found.push(`${path} = null`);
    return found;
  }
  if (Array.isArray(node)) {
    node.forEach((item, i) => schemaJunk(item, `${path}[${i}]`, found));
    return found;
  }
  if (typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) schemaJunk(value, `${path}.${key}`, found);
    return found;
  }
  if (typeof node === 'string') {
    const trimmed = node.trim();
    if (trimmed === 'undefined' || trimmed === 'null' || trimmed === 'NaN') {
      found.push(`${path} = "${trimmed}"`);
    }
    if (/^https?:\/\//i.test(trimmed) && /\b(undefined|null|NaN)\b/.test(trimmed)) {
      found.push(`${path} = ${trimmed}`);
    }
  }
  if (typeof node === 'number' && !Number.isFinite(node)) found.push(`${path} = ${node}`);
  return found;
}

function decode(value) {
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function nestedAnchorDepth(html) {
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
