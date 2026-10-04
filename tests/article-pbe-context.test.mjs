// NFL PBE context on the propbetedge.ai news Article Market module (P0 2026-10-04: JAX @ CIN rendered
// "No official call" although the game carried frozen PBE validation decisions and TD targets).
//
// Fixtures: the REAL production market payload for JAX @ CIN 401872969 (public /v1/article-market response) and the
// REAL production LOGGED-OUT answers of the NFL per-game contracts (counts only — nothing paid in them). The
// ENTITLED answers below are SYNTHETIC but shaped exactly like the NFL server's proCard / TD game target output: this
// repository is public and the real selections are NFL Pro data (they are pinned in the private propbetedge-workers
// fixture instead).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildNflPbeContext, loadNflPbeContext, NFL_PBE_ORIGIN, NFL_PBE_CTA } from '../src/article-pbe-context.js';
import { articleMarketHtml, articleMarketWithin, articleMarketSlot } from '../src/article-market.js';

const fx = (f) => JSON.parse(fs.readFileSync(new URL(`./fixtures/${f}`, import.meta.url), 'utf8'));
const market = fx('article-market-nfl-401872969.json');
const lockedPicks = fx('nfl-pbe-game-401872969-locked.json');
const lockedTd = fx('nfl-td-game-401872969-locked.json');

const card = (over) => ({
  publication_scope: 'tracking', label: 'PBE VALIDATION SIGNAL', lifecycle: 'LOCKED', game_id: '2026_04_JAX_CIN',
  kickoff_ts: '2026-10-04T17:00:00.000Z', lock: { boundary: '2026-10-04T17:00:00.000Z', locked: true },
  issue: { at: '2026-09-30T09:00:47.000Z', line: null, price: -120 }, model: { prob: 0.6 }, ...over,
});
const proPicks = {
  view: 'game', access: 'pro', count: 2, evaluated: true,
  picks: [
    card({ market: 'spread', selection: { kind: 'spread', team: 'CIN', display: 'CIN -1.5' }, issue: { at: '2026-09-30T09:00:46.000Z', line: -1.5, price: -110 }, model: { prob: 0.55 } }),
    card({ market: 'moneyline', selection: { kind: 'moneyline', team: 'CIN', display: 'CIN ML' } }),
  ],
};
const proTd = {
  view: 'game', access: 'pro', evaluated: true, counts: { targets: 2 },
  targets: [
    { target_rank: 'primary', publication_scope: 'tracking', scope_label: 'TRACKING TARGET', player: { name: 'Player One' }, model: { probability: 0.41 } },
    { target_rank: 'secondary', publication_scope: 'tracking', scope_label: 'TRACKING TARGET', player: { name: 'Player Two' }, model: { probability: 0.33 } },
  ],
};
const block = (html) => html.slice(html.indexOf('<div class="am__pbe'), html.indexOf('<ul class="am__notes">'));

test('entitled: moneyline leads as a validation signal, spread is related only, TD targets follow — never OFFICIAL', () => {
  const ctx = buildNflPbeContext(proPicks, proTd);
  assert.equal(ctx.scope, 'VALIDATION');
  assert.equal(ctx.access, 'full');
  assert.deepEqual(ctx.game_signals.map((s) => s.market), ['moneyline', 'spread']);
  assert.equal(ctx.game_signals[0].before_kickoff, true);
  const html = block(articleMarketHtml(market, ctx));
  assert.match(html, /<h4>PBE live validation<\/h4>/);
  assert.match(html, /<b>CIN ML -120<\/b> · <b>PBE 60%<\/b>/);
  assert.match(html, /Locked before kickoff · validation signal/);
  assert.match(html, /<li><span>Other game signal<\/span><span>CIN -1\.5 -110 · PBE 55%<\/span><\/li>/);
  assert.match(html, /<li><span>PRIMARY · Player One<\/span><span>41%<\/span><\/li>/);
  assert.match(html, /<li><span>SECONDARY · Player Two<\/span><span>33%<\/span><\/li>/);
  assert.match(html, /not the Official Track Record/);
  assert.doesNotMatch(html, /OFFICIAL PBE|official pick|No official call|pts|¢/);
});

test('logged out (REAL production answers): existence + NFL Pro / All Access CTA, no team, player, line, price or probability', () => {
  assert.equal(lockedPicks.access, 'locked');
  const ctx = buildNflPbeContext(lockedPicks, lockedTd);
  assert.deepEqual(ctx, { scope: 'VALIDATION', access: 'locked', cta: NFL_PBE_CTA });
  const html = articleMarketHtml(market, ctx);
  assert.match(block(html), /PBE live validation intelligence exists for this game/);
  assert.match(block(html), /href="https:\/\/propbetedge\.ai\/pro">NFL Pro \/ All Access</);
  assert.doesNotMatch(html, /No official call/);
  for (const leak of ['CIN ML', 'CIN -', 'PBE 6', 'PBE 5', 'PRIMARY', 'Chase', 'Rodriguez']) assert.equal(block(html).includes(leak), false, leak);
});

test('only TD targets exist (locked) -> PBE tracking, still nothing named', () => {
  const ctx = buildNflPbeContext({ ...lockedPicks, count: 0, previews: [] }, lockedTd);
  assert.deepEqual(ctx, { scope: 'TRACKING', access: 'locked', cta: NFL_PBE_CTA });
});

test('genuinely nothing at any scope -> "No PBE decision"; a failed read -> original strip (never a guessed NONE)', () => {
  const none = buildNflPbeContext({ view: 'game', access: 'locked', evaluated: false, count: 0, previews: [] }, { view: 'game', access: 'locked', evaluated: false, counts: { targets: 0 } });
  assert.deepEqual(none, { scope: 'NONE' });
  assert.match(articleMarketHtml(market, none), /<b>No PBE decision<\/b> on this event/);
  assert.equal(buildNflPbeContext(null, null), null);
  assert.equal(buildNflPbeContext({ view: 'game', access: 'locked', evaluated: false, count: 0 }, null), null, 'TD read failed: not provably none');
  assert.match(articleMarketHtml(market, null), /No official call/);
});

test('official NFL rows are never pulled into the validation block', () => {
  const official = { ...proPicks, picks: [card({ market: 'moneyline', publication_scope: 'official', label: 'OFFICIAL PBE PICK', selection: { display: 'CIN ML' } })] };
  assert.equal(buildNflPbeContext(official, { view: 'game', access: 'pro', counts: { targets: 0 }, targets: [] }), null);
});

test('reads: exactly the two NFL per-game contracts, credentials included, never the public market proxy; failures -> null', async () => {
  const seen = [];
  const ok = async (url, init) => {
    seen.push({ url, init });
    return new Response(JSON.stringify(url.includes('touchdown') ? lockedTd : lockedPicks), { status: 200 });
  };
  const ctx = await loadNflPbeContext('401872969', ok);
  assert.equal(ctx.access, 'locked');
  assert.deepEqual(seen.map((s) => s.url).sort(), [
    `${NFL_PBE_ORIGIN}/api/pbe-picks?view=game&game_id=401872969`,
    `${NFL_PBE_ORIGIN}/api/pbe-touchdown-targets?view=game&game_id=401872969`,
  ]);
  assert.ok(seen.every((s) => s.init.credentials === 'include'));
  assert.equal(await loadNflPbeContext('401872969', async () => new Response('x', { status: 503 })), null);
  assert.equal(await loadNflPbeContext('401872969', async () => { throw new Error('offline'); }), null);
  assert.equal(await loadNflPbeContext('JAX-CIN', ok), null);
});

test('articleMarketWithin: NFL reads the context in parallel under the same budget; other sports never do', async () => {
  const art = (sport, id) => ({ sport, published_at: '2026-10-04T19:15:30.694085+00:00', first_published_at: '2026-10-04T19:20:55.851Z', event: { sport, canonical_event_id: id } });
  const mk = await articleMarketWithin(art('nfl', '401872969'), 200, async () => new Response(JSON.stringify(market)), { pbeFetchImpl: async (u) => new Response(JSON.stringify(u.includes('touchdown') ? proTd : proPicks)) });
  assert.equal(mk.pbe.access, 'full');
  assert.equal(mk.pbePending, null);
  assert.match(articleMarketSlot(art('nfl', '401872969'), mk), /CIN ML -120/);
  let pbeCalls = 0;
  const nhl = await articleMarketWithin(art('nhl', '2026020030'), 50, async () => new Response('{}', { status: 404 }), { pbeFetchImpl: async () => { pbeCalls += 1; return new Response('{}'); } });
  assert.equal(pbeCalls, 0);
  assert.equal('pbe' in nhl, false);
  const slow = await articleMarketWithin(art('nfl', '401872969'), 10, async () => new Response(JSON.stringify(market)), { pbeFetchImpl: () => new Promise((r) => setTimeout(() => r(new Response(JSON.stringify(lockedPicks))), 60)) });
  assert.equal(slow.pbe, null);
  assert.ok(slow.pbePending, 'a late context is handed to mount, which repaints only the PBE strip');
  await slow.pbePending;
});

test('the article page and the public market read are unchanged: context only through mountArticleMarketSlot', () => {
  const src = fs.readFileSync(new URL('../src/article-market.js', import.meta.url), 'utf8');
  assert.match(src, /pbeContext: \(\) => ctx/);
  assert.match(src, /stop\.repaint\?\.\(\)/);
  assert.doesNotMatch(fs.readFileSync(new URL('../src/article-pbe-context.js', import.meta.url), 'utf8').replace(/^\s*\/\/.*$/gm, ''), /\/api\/markets|workers\.dev/);
});
