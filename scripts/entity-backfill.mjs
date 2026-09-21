/**
 * scripts/entity-backfill.mjs
 *
 * Idempotent entity backfill / audit across the whole PropBetEdge archive.
 *
 * Because the manifest is derived at render time from the committed entity
 * dictionary, "backfilling" the archive means recomputing every article's graph
 * and proving it is correct — not mutating rows. This script therefore:
 *
 *   - READS ONLY. It never writes to Supabase, never touches published_at,
 *     never rewrites editorial copy. Re-running it changes nothing.
 *   - Produces the counters the graph is held to: links created, malformed
 *     links, nested anchors, invalid canonicals, schema failures, unresolved
 *     mentions, share images assigned, publication-date drift.
 *   - Emits the unresolved-mention ledger that drives dictionary coverage work.
 *
 * Usage:
 *   node scripts/entity-backfill.mjs                  # whole archive
 *   node scripts/entity-backfill.mjs --limit 100      # first 100 articles
 *   node scripts/entity-backfill.mjs --sport nfl
 *   node scripts/entity-backfill.mjs --verify-entities 150
 *   node scripts/entity-backfill.mjs --games 100      # resolve games for a sample
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { applyArticlePublicationPolicy, assessArticleIntegrity } from '../news-integrity.js';
import { buildEntityManifest } from '../src/entity-graph/manifest.js';
import { buildArticleSeo, articleCanonicalUrl } from '../src/entity-graph/article-seo.js';
import { articleBodyHtml } from '../src/entity-graph/article-body.js';
import { linkifyArticleHtml } from '../src/entity-graph/linkify.js';
import { renderInThisStory } from '../src/entity-graph/in-this-story.js';
import { enrichManifestWithGame } from '../src/entity-graph/games.js';
import { SITE, SUPPORTED_SPORTS } from '../src/entity-graph/entities.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const NEWS_API = 'https://propbet-news-api.sales-fd3.workers.dev';
const PAGE_SIZE = 50;

const args = parseArgs(process.argv.slice(2));

const report = {
  started_at: new Date().toISOString(),
  scope: { sport: args.sport || 'all', limit: args.limit || null },
  totals: {
    articles_scanned: 0,
    articles_withheld_by_integrity_gate: 0,
    articles_with_player_entities: 0,
    articles_with_team_entities: 0,
    articles_with_game_entities: 0,
    articles_with_no_entities: 0,
    player_entities_resolved: 0,
    team_entities_resolved: 0,
    game_entities_resolved: 0,
    player_links_created: 0,
    team_links_created: 0,
    game_links_created: 0,
    body_links_created: 0,
    share_images_assigned: 0,
    share_image_tier_1_editorial_photo: 0,
    share_image_tier_2_player_headshot: 0,
    share_image_tier_3_team_mark: 0,
    share_image_tier_4_league_card: 0,
    unresolved_mentions: 0,
  },
  failures: {
    malformed_internal_links: 0,
    nested_anchors: 0,
    invalid_canonical_urls: 0,
    canonical_mismatches: 0,
    schema_serialization_errors: 0,
    publication_date_changes: 0,
    self_referencing_entity_links: 0,
    entity_links_404: 0,
    body_text_mutated: 0,
  },
  unresolved: { players: {}, teams: {} },
  samples: { failures: [], resolved: [] },
  entity_verification: null,
  finished_at: null,
};

const ENTITY_HREF = /^\/(player|team|games)\/(mlb|nfl|nba|nhl)\/[A-Za-z0-9-]+$/;

async function main() {
  let page = 1;
  let done = false;

  while (!done) {
    const path = args.sport
      ? `/news/by-sport/${args.sport}?limit=${PAGE_SIZE}&page=${page}`
      : `/news?limit=${PAGE_SIZE}&page=${page}`;

    const data = await getJson(path);
    const rows = data?.articles || [];
    if (!rows.length) break;

    for (const row of rows) {
      if (args.limit && report.totals.articles_scanned >= args.limit) { done = true; break; }
      await auditArticle(row);
    }

    if (!done) {
      const totalPages = Number(data.totalPages || 0);
      done = totalPages > 0 ? page >= totalPages : rows.length < PAGE_SIZE;
      page += 1;
      if (page % 10 === 0) process.stdout.write(`  …${report.totals.articles_scanned} articles\n`);
    }
  }

  if (args.verifyEntities) await verifyEntityUrls(args.verifyEntities);

  report.finished_at = new Date().toISOString();
  emit();
}

async function auditArticle(row) {
  report.totals.articles_scanned += 1;

  // Mirror the live publication gate exactly, so the audit measures what the
  // site actually serves rather than what the database happens to contain.
  const article = applyArticlePublicationPolicy(row);
  if (!article) {
    report.totals.articles_withheld_by_integrity_gate += 1;
    return;
  }
  if (!assessArticleIntegrity(article).ok) {
    report.totals.articles_withheld_by_integrity_gate += 1;
    return;
  }

  const sport = String(article.sport || '').toLowerCase();
  if (!SUPPORTED_SPORTS.includes(sport)) return;

  const publishedBefore = article.published_at;

  let manifest = buildEntityManifest(article);
  if (args.games && report.totals.articles_scanned <= args.games) {
    manifest = await enrichManifestWithGame(article, manifest, { origin: SITE, timeoutMs: 4000 })
      .catch(() => manifest);
  }

  // ── entity counters ───────────────────────────────────────────────────────
  if (manifest.players.length) report.totals.articles_with_player_entities += 1;
  if (manifest.teams.length) report.totals.articles_with_team_entities += 1;
  if (manifest.games.length) report.totals.articles_with_game_entities += 1;
  if (!manifest.players.length && !manifest.teams.length && !manifest.games.length) {
    report.totals.articles_with_no_entities += 1;
  }
  report.totals.player_entities_resolved += manifest.players.length;
  report.totals.team_entities_resolved += manifest.teams.length;
  report.totals.game_entities_resolved += manifest.games.length;

  for (const miss of manifest.unresolved) {
    report.totals.unresolved_mentions += 1;
    const bucket = miss.kind === 'team' ? report.unresolved.teams : report.unresolved.players;
    const key = `${sport}:${miss.mention}`;
    bucket[key] = (bucket[key] || 0) + 1;
  }

  // ── SEO contract ──────────────────────────────────────────────────────────
  let seo;
  try {
    seo = buildArticleSeo(article, manifest);
    JSON.parse(JSON.stringify(seo.jsonLd));
    const junk = schemaJunk(seo.jsonLd);
    if (junk.length) throw new Error(junk.slice(0, 3).join('; '));
  } catch (error) {
    report.failures.schema_serialization_errors += 1;
    pushFailure(article, 'schema_serialization_error', error.message);
    return;
  }

  const expectedCanonical = articleCanonicalUrl(article);
  if (seo.canonical !== expectedCanonical) {
    report.failures.canonical_mismatches += 1;
    pushFailure(article, 'canonical_mismatch', `${seo.canonical} != ${expectedCanonical}`);
  }
  if (!isValidAbsoluteUrl(seo.canonical) || seo.canonical.includes('?')) {
    report.failures.invalid_canonical_urls += 1;
    pushFailure(article, 'invalid_canonical', seo.canonical);
  }

  if (seo.image?.url) {
    report.totals.share_images_assigned += 1;
    const tierKey = `share_image_tier_${seo.image.tier}_${
      { 1: 'editorial_photo', 2: 'player_headshot', 3: 'team_mark', 4: 'league_card' }[seo.image.tier]
    }`;
    if (tierKey in report.totals) report.totals[tierKey] += 1;
  }

  // ── linking ───────────────────────────────────────────────────────────────
  const source = articleBodyHtml(article);
  const linked = linkifyArticleHtml(source, manifest, { excludeUrls: [seo.canonical] });

  report.totals.body_links_created += linked.count;
  for (const link of linked.links) {
    if (link.kind === 'player') report.totals.player_links_created += 1;
    if (link.kind === 'team') report.totals.team_links_created += 1;
    if (link.kind === 'game') report.totals.game_links_created += 1;

    if (!ENTITY_HREF.test(link.path)) {
      report.failures.malformed_internal_links += 1;
      pushFailure(article, 'malformed_link', link.path);
    }
    if (link.url === seo.canonical) {
      report.failures.self_referencing_entity_links += 1;
      pushFailure(article, 'self_link', link.url);
    }
  }

  const bar = renderInThisStory(manifest);
  for (const match of bar.matchAll(/href="([^"]+)"/g)) {
    if (!ENTITY_HREF.test(match[1])) {
      report.failures.malformed_internal_links += 1;
      pushFailure(article, 'malformed_chip_link', match[1]);
    }
  }

  if (hasNestedAnchor(linked.html)) {
    report.failures.nested_anchors += 1;
    pushFailure(article, 'nested_anchor', article.slug);
  }

  // Linking must be additive only: strip the markup back out and the prose must
  // be byte-identical to what the editor wrote.
  if (textOf(linked.html) !== textOf(source)) {
    report.failures.body_text_mutated += 1;
    pushFailure(article, 'body_text_mutated', article.slug);
  }

  // Nothing in this pipeline may touch a publication timestamp.
  if (article.published_at !== publishedBefore || seo.publishedTime !== isoOf(publishedBefore)) {
    report.failures.publication_date_changes += 1;
    pushFailure(article, 'publication_date_change', `${publishedBefore} -> ${seo.publishedTime}`);
  }

  if (report.samples.resolved.length < 25 && linked.count > 0) {
    report.samples.resolved.push({
      url: seo.canonical,
      sport,
      players: manifest.players.map((p) => p.canonical_url),
      teams: manifest.teams.map((t) => t.canonical_url),
      games: manifest.games.map((g) => g.canonical_url),
      body_links: linked.links.map((l) => `${l.anchor_text} -> ${l.path}`),
      share_image_tier: seo.image.tier,
    });
  }
}

/**
 * Confirm a sample of emitted entity URLs resolve at their real source, so
 * "0 known entity links leading to 404" is a measurement rather than a claim.
 */
async function verifyEntityUrls(sampleSize) {
  const urls = new Set();
  for (const sample of report.samples.resolved) {
    for (const url of [...sample.players, ...sample.teams]) urls.add(url);
  }
  const list = [...urls].slice(0, sampleSize);

  const results = { checked: 0, ok: 0, not_found: [], unverifiable: 0 };
  for (const url of list) {
    const verdict = await verifyEntityUrl(url);
    results.checked += 1;
    if (verdict === 'ok') results.ok += 1;
    else if (verdict === 'not_found') {
      results.not_found.push(url);
      report.failures.entity_links_404 += 1;
    } else results.unverifiable += 1;
  }
  report.entity_verification = results;
}

async function verifyEntityUrl(url) {
  const player = url.match(/\/player\/(mlb|nfl|nba|nhl)\/(\d+)$/);
  if (player) {
    const [, sport, id] = player;
    if (sport === 'mlb') return probe(`https://statsapi.mlb.com/api/v1/people/${id}`, (d) => d?.people?.length > 0);
    if (sport === 'nhl') return probe(`https://api-web.nhle.com/v1/player/${id}/landing`, (d) => Boolean(d?.playerId));
    const league = sport === 'nfl' ? 'football/nfl' : 'basketball/nba';
    return probe(
      `https://site.web.api.espn.com/apis/common/v3/sports/${league}/athletes/${id}`,
      (d) => Boolean(d?.athlete),
    );
  }

  const team = url.match(/\/team\/(mlb|nfl|nba|nhl)\/([a-z0-9-]+)$/);
  if (team) {
    const [, sport, slug] = team;
    const league = { mlb: 'baseball/mlb', nfl: 'football/nfl', nba: 'basketball/nba', nhl: 'hockey/nhl' }[sport];
    return probe(
      `https://site.api.espn.com/apis/site/v2/sports/${league}/teams?limit=100`,
      (d) => (d?.sports?.[0]?.leagues?.[0]?.teams || [])
        .map((e) => e?.team || e)
        .some((t) => slugify(t?.displayName) === slug),
    );
  }
  return 'unverifiable';
}

async function probe(url, predicate) {
  try {
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (res.status === 404) return 'not_found';
    if (!res.ok) return 'unverifiable';
    return predicate(await res.json()) ? 'ok' : 'not_found';
  } catch {
    return 'unverifiable';
  }
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function emit() {
  const outDir = resolve(ROOT, 'reports');
  mkdirSync(outDir, { recursive: true });

  report.unresolved.players = topEntries(report.unresolved.players, 400);
  report.unresolved.teams = topEntries(report.unresolved.teams, 120);

  const file = resolve(outDir, 'entity-backfill.json');
  writeFileSync(file, JSON.stringify(report, null, 2), 'utf8');

  const t = report.totals;
  const f = report.failures;
  const scanned = t.articles_scanned;
  const eligible = scanned - t.articles_withheld_by_integrity_gate;
  const pct = (n) => (eligible ? `${((n / eligible) * 100).toFixed(1)}%` : 'n/a');

  console.log('\n═══ PropBetEdge entity backfill ═══');
  console.log(`articles scanned                 ${scanned}`);
  console.log(`  withheld by integrity gate     ${t.articles_withheld_by_integrity_gate}`);
  console.log(`  eligible (what the site serves)${String(eligible).padStart(7)}`);
  console.log('');
  console.log(`articles with player entities    ${t.articles_with_player_entities} (${pct(t.articles_with_player_entities)})`);
  console.log(`articles with team entities      ${t.articles_with_team_entities} (${pct(t.articles_with_team_entities)})`);
  console.log(`articles with game entities      ${t.articles_with_game_entities}`);
  console.log(`articles with no entities        ${t.articles_with_no_entities} (${pct(t.articles_with_no_entities)})`);
  console.log('');
  console.log(`player entities resolved         ${t.player_entities_resolved}`);
  console.log(`team entities resolved           ${t.team_entities_resolved}`);
  console.log(`game entities resolved           ${t.game_entities_resolved}`);
  console.log(`unresolved mentions              ${t.unresolved_mentions}`);
  console.log('');
  console.log(`body entity links created        ${t.body_links_created}`);
  console.log(`  player links                   ${t.player_links_created}`);
  console.log(`  team links                     ${t.team_links_created}`);
  console.log(`share images assigned            ${t.share_images_assigned}`);
  console.log(`  tier 1 editorial photo         ${t.share_image_tier_1_editorial_photo}`);
  console.log(`  tier 2 player headshot         ${t.share_image_tier_2_player_headshot}`);
  console.log(`  tier 3 team mark               ${t.share_image_tier_3_team_mark}`);
  console.log(`  tier 4 league card             ${t.share_image_tier_4_league_card}`);
  console.log('\n─── failure budget (target: all zero) ───');
  for (const [key, value] of Object.entries(f)) {
    console.log(`${value === 0 ? 'PASS' : 'FAIL'}  ${key.padEnd(34)} ${value}`);
  }
  if (report.entity_verification) {
    const v = report.entity_verification;
    console.log(`\nentity URL verification: ${v.ok}/${v.checked} resolved, ${v.not_found.length} 404, ${v.unverifiable} unverifiable`);
    for (const url of v.not_found.slice(0, 10)) console.log(`  404: ${url}`);
  }
  console.log(`\nreport → ${file}\n`);

  const failed = Object.values(f).some((v) => v > 0);
  process.exitCode = failed ? 1 : 0;
}

function topEntries(map, limit) {
  return Object.fromEntries(
    Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, limit),
  );
}

function pushFailure(article, kind, detail) {
  if (report.samples.failures.length >= 60) return;
  report.samples.failures.push({ slug: article.slug, sport: article.sport, kind, detail });
}

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

function hasNestedAnchor(html) {
  let depth = 0;
  for (const match of String(html).matchAll(/<(\/?)a\b[^>]*>/g)) {
    if (match[1]) depth = Math.max(0, depth - 1);
    else {
      depth += 1;
      if (depth > 1) return true;
    }
  }
  return false;
}

function textOf(html) {
  return String(html).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function isValidAbsoluteUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'propbetedge.ai';
  } catch {
    return false;
  }
}

function isoOf(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function slugify(value) {
  return String(value || '').trim().toLowerCase()
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function getJson(path, attempts = 3) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`${NEWS_API}${path}`, {
        headers: { Accept: 'application/json', Origin: SITE, Referer: `${SITE}/news` },
      });
      if (!res.ok) throw new Error(`news api ${res.status}`);
      return await res.json();
    } catch (error) {
      lastError = error;
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw lastError;
}

function parseArgs(argv) {
  const out = { limit: null, sport: null, verifyEntities: 0, games: 0 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--limit') out.limit = parseInt(argv[++i], 10) || null;
    else if (argv[i] === '--sport') out.sport = String(argv[++i] || '').toLowerCase() || null;
    else if (argv[i] === '--verify-entities') out.verifyEntities = parseInt(argv[++i], 10) || 150;
    else if (argv[i] === '--games') out.games = parseInt(argv[++i], 10) || 100;
  }
  return out;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
