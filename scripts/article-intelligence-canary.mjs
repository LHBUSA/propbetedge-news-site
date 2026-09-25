#!/usr/bin/env node
/**
 * Article Data Intelligence canary.
 *
 * Pulls recent published stories per sport from the production news API,
 * resolves each through the same entity graph the site uses, renders the
 * module, hydrates it against the live adapters (default base
 * https://propbetedge.ai, i.e. the deployed /api routes), and audits BOTH the
 * static and the hydrated HTML with src/article-intelligence/guard.js.
 *
 * Fails (exit 1) on any of:
 *   "Here's the data." without a quantitative block
 *   NaN / undefined / null / Infinity rendered as a value
 *   empty evidence cards, duplicate evidence from one sentence
 *   market tags rendered as statistics
 *   unsupported metric/position pairings (OL charts, goalie skater stats)
 *   unresolved loading skeletons after hydration
 *
 * Usage:
 *   node scripts/article-intelligence-canary.mjs [--limit 25] [--sports nfl,mlb,nba,wnba,nhl,ufc]
 *        [--base https://propbetedge.ai] [--no-live] [--json out.json] [--slug <slug>]
 */

import fs from 'node:fs';
import { buildEntityManifest } from '../src/entity-graph/index.js';
import { buildArticleIntelligence, loadLiveContext, renderArticleVisuals } from '../src/article-visuals.js';
import { auditIntelligenceHtml, hasQuantitativeBlock } from '../src/article-intelligence/guard.js';
import { assessArticleIntegrity, applyArticlePublicationPolicy } from '../news-integrity.js';

const NEWS_API = 'https://propbet-news-api.sales-fd3.workers.dev';
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};
const flag = (name) => args.includes(`--${name}`);

const LIMIT = Math.max(1, Math.min(100, Number(opt('limit', 25))));
const SPORTS = opt('sports', 'nfl,mlb,nba,wnba,nhl,ufc').split(',').map((s) => s.trim()).filter(Boolean);
const BASE = opt('base', 'https://propbetedge.ai').replace(/\/+$/, '');
const LIVE = !flag('no-live');
const JSON_OUT = opt('json', null);
const ONLY_SLUG = opt('slug', null);

async function newsGet(path) {
  const res = await fetch(`${NEWS_API}${path}`, { headers: { origin: 'https://propbetedge.ai', accept: 'application/json' } });
  if (!res.ok) throw new Error(`news api ${res.status} ${path}`);
  return res.json();
}

async function articlesFor(sport) {
  const out = [];
  for (let page = 1; out.length < LIMIT && page <= 5; page++) {
    const data = await newsGet(`/news/by-sport/${sport}?limit=${Math.min(50, LIMIT)}&page=${page}`);
    for (const row of data.articles || []) {
      const article = applyArticlePublicationPolicy(row);
      if (!article || !assessArticleIntegrity(article).ok) continue;
      out.push(article);
      if (out.length >= LIMIT) break;
    }
    if (!data.hasMore) break;
  }
  return out;
}

async function pool(items, size, fn) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }));
  return results;
}

async function audit(article) {
  const manifest = buildEntityManifest(article);
  const intel = buildArticleIntelligence(article, manifest);
  const staticHtml = renderArticleVisuals(article, manifest);
  const violations = auditIntelligenceHtml(staticHtml, { manifest }).map((v) => `static:${v}`);
  let finalHtml = staticHtml;
  let live = null;
  if (LIVE && staticHtml) {
    live = await loadLiveContext(article, manifest, { base: BASE });
    finalHtml = renderArticleVisuals(article, manifest, { live });
    violations.push(...auditIntelligenceHtml(finalHtml, { manifest, hydrated: true }).map((v) => `hydrated:${v}`));
  }
  const finalIntel = buildArticleIntelligence(article, manifest, live);
  return {
    sport: article.sport,
    slug: article.slug,
    archetype: intel.archetype,
    static_mode: intel.mode,
    final_mode: finalIntel.mode,
    final_level: finalIntel.level,
    evidence_cards: intel.publishedEvidence.length,
    evidence: intel.publishedEvidence.map((r) => `${r.metrics.map((m) => `${m.label}=${m.value}`).join(' ')} :: ${r.context.slice(0, 150)}`),
    team_expected: intel.expect.team,
    team_hydrated: Boolean(live?.team),
    player_expected: intel.expect.player ? `${intel.expect.player.name} (${intel.expect.player.position || '?'})` : null,
    player_hydrated: Boolean(live?.player),
    data_headline: /Here’s the data\./.test(finalHtml),
    has_quant: hasQuantitativeBlock(finalHtml),
    violations,
  };
}

const started = Date.now();
const rows = [];
for (const sport of SPORTS) {
  let articles = await articlesFor(sport).catch((error) => {
    console.error(`[canary] ${sport}: ${error.message}`);
    return [];
  });
  if (ONLY_SLUG) articles = articles.filter((a) => a.slug === ONLY_SLUG);
  rows.push(...await pool(articles, 4, (article) => audit(article).catch((error) => ({
    sport, slug: article.slug, violations: [`canary_error:${error.message}`],
  }))));
}

const failing = rows.filter((r) => r.violations.length);
const summary = {
  checked: rows.length,
  base: LIVE ? BASE : null,
  by_sport: Object.fromEntries(SPORTS.map((s) => {
    const r = rows.filter((x) => x.sport === s);
    return [s, {
      checked: r.length,
      data: r.filter((x) => x.final_mode === 'data').length,
      story: r.filter((x) => x.final_mode === 'story').length,
      impact: r.filter((x) => x.final_mode === 'impact').length,
      hidden: r.filter((x) => !x.final_mode).length,
      team_hydrated: r.filter((x) => x.team_hydrated).length,
      player_hydrated: r.filter((x) => x.player_hydrated).length,
    }];
  })),
  bad_data_headline: rows.filter((r) => r.data_headline && !r.has_quant).length,
  failing: failing.length,
  seconds: Math.round((Date.now() - started) / 1000),
};

if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ summary, rows }, null, 2));
console.log(JSON.stringify(summary, null, 2));
for (const row of failing) console.log(`FAIL ${row.sport} ${row.slug}: ${row.violations.join(', ')}`);
process.exit(failing.length ? 1 : 0);
