/**
 * tests/search-learn.test.mjs — Learn documents in PropBetEdge network search.
 *
 * learn.propbetedge.ai publishes /search-manifest.json (schema pbe-learn-search/1);
 * the hub ingests it into KV search:v2:learn as type "learn" docs. The fixture is a
 * captured copy of the real manifest. No live network.
 *
 * Run: node --test --test-concurrency=1 tests/search-learn.test.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { searchDocs, toResult, groupResults, parseSearchParams, SEARCH_TYPES } from '../src/search/rank.js';
import worker from '../workers/pbe-entity-hub/src/index.js';
import {
  staticDocs, resetSearchCaches, KEYS, learnDocsFromManifest, refreshLearnIndex, LEARN_SITE,
} from '../workers/pbe-entity-hub/src/search-service.js';
import { resultLabel } from '../src/search-palette.js';

const MANIFEST = JSON.parse(fs.readFileSync(new URL('./fixtures/search/learn-search-manifest.json', import.meta.url), 'utf8'));
const LEARN = learnDocsFromManifest(MANIFEST);
const base = staticDocs();
const CORPUS = [...base.players, ...base.teams, ...base.tools, ...LEARN];
const rank = (q, opts = {}) => searchDocs(CORPUS, q, { limit: 20, ...opts }).map(toResult);

function fakeKv(seed = {}) {
  const store = new Map(Object.entries(seed).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]));
  return {
    store,
    async get(key, type) { if (!store.has(key)) return null; const v = store.get(key); return type === 'json' ? JSON.parse(v) : v; },
    async put(key, value) { store.set(key, String(value)); },
    async delete(key) { store.delete(key); },
    async list({ prefix = '' } = {}) { return { keys: [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }; },
  };
}
const ctxStub = () => { const jobs = []; return { jobs, waitUntil: (p) => jobs.push(Promise.resolve(p).catch(() => {})) }; };
async function call(path, { origin = 'https://learn.propbetedge.ai', env } = {}) {
  const res = await worker.fetch(new Request(`https://pbe-entity-hub.sales-fd3.workers.dev${path}`, { headers: origin ? { Origin: origin } : {} }), env, ctxStub());
  return { res, body: await res.json() };
}
const learnEnv = () => ({ ENTITY_KV: fakeKv({ [KEYS.learn]: { built_at: new Date().toISOString(), docs: LEARN } }) });

test('manifest → learn docs: shape, origin and sanitisation', () => {
  assert.ok(LEARN.length >= 100, `${LEARN.length} docs`);
  assert.ok(LEARN.every((d) => d.type === 'learn' && d.href.startsWith(`${LEARN_SITE}/`)));
  assert.ok(LEARN.filter((d) => d.kind === 'lesson').length >= 20);
  assert.ok(LEARN.filter((d) => d.kind === 'glossary').length >= 60);

  assert.equal(learnDocsFromManifest({ schema: 'other/1', docs: [] }), null);
  assert.equal(learnDocsFromManifest(null), null);
  const hostile = learnDocsFromManifest({ schema: 'pbe-learn-search/1', docs: [
    { type: 'player', kind: 'lesson', title: 'x', href: `${LEARN_SITE}/a` },                  // wrong type
    { type: 'learn', kind: 'lesson', title: 'Off site', href: 'https://evil.example/x' },      // off-origin
    { type: 'learn', kind: 'lesson', title: 'Sneaky', href: 'https://learn.propbetedge.ai.evil.example/x' },
    { type: 'learn', kind: 'story', title: 'Bad kind', href: `${LEARN_SITE}/b` },
    { type: 'learn', kind: 'glossary', title: 'T'.repeat(500), href: `${LEARN_SITE}/glossary#t`, boost: 999, sport: 'xfl', aliases: ['a', 7, 'b'] },
    { type: 'learn', kind: 'glossary', title: 'Dup', href: `${LEARN_SITE}/glossary#t` },
  ] });
  assert.equal(hostile.length, 1);
  assert.equal(hostile[0].title.length, 140);
  assert.equal(hostile[0].boost, 40);
  assert.equal(hostile[0].sport, undefined);
  assert.deepEqual(hostile[0].aliases, ['a', 'b']);
});

test('learn is a first-class search type', () => {
  assert.ok(SEARCH_TYPES.includes('learn'));
  assert.deepEqual(parseSearchParams(new URLSearchParams('q=kelly&type=learn')).types, ['learn']);
  const groups = groupResults(rank('brier score'));
  assert.ok(groups.some((g) => g.key === 'learn' && g.label === 'Learn'), 'learn results are grouped, not dropped');
});

test('educational queries land on Learn', () => {
  const top = (q) => rank(q)[0];
  for (const [q, re] of [
    ['Brier score', /brier/i], ['Kelly criterion', /kelly/i], ['closing line value', /closing line value/i],
    ['implied probability', /implied probability/i], ['calibration', /calibration/i], ['Monte Carlo', /monte carlo/i],
  ]) {
    const t = top(q);
    assert.ok(t, q);
    assert.equal(t.type, 'learn', `${q} → ${t.type} ${t.title}`);
    assert.match(t.title, re, q);
  }
  // Fight DNA: the UFC product page and the Learn lesson both surface.
  const dna = rank('Fight DNA');
  assert.ok(dna.some((r) => r.type === 'tool' && /ufc\.propbetedge\.ai\/learn\/fight-dna/.test(r.href)), 'UFC Fight DNA tool');
  assert.ok(dna.some((r) => r.type === 'learn'), 'Learn Fight DNA docs');
  assert.ok(rank('touchdown probability').some((r) => r.type === 'learn' && /touchdown/i.test(r.title)), 'touchdown probability');
});

test('Learn docs never displace entity results', () => {
  const judge = rank('Aaron Judge');
  assert.equal(judge[0].type, 'player');
  assert.equal(judge[0].title, 'Aaron Judge');
  assert.ok(!judge.some((r) => r.type === 'learn'), 'no learn noise on a player query');
  const nyy = rank('Yankees');
  assert.equal(nyy[0].type, 'team');
  // type filter still isolates Learn
  assert.ok(rank('kelly', { types: ['learn'] }).every((r) => r.type === 'learn'));
});

test('worker: learn.propbetedge.ai is an allowed origin and learn docs are served', async () => {
  resetSearchCaches();
  const { res, body } = await call('/v1/search?q=brier%20score&limit=10', { env: learnEnv() });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://learn.propbetedge.ai');
  assert.equal(body.results[0].type, 'learn');
  assert.equal(body.results[0].label, 'LEARN · GLOSSARY');
  assert.ok(body.sources.learn && body.sources.learn.docs === LEARN.length);
  resetSearchCaches();
  const pre = await worker.fetch(new Request('https://pbe-entity-hub.sales-fd3.workers.dev/v1/search?q=x', { method: 'OPTIONS', headers: { Origin: 'https://learn.propbetedge.ai' } }), learnEnv(), ctxStub());
  assert.equal(pre.headers.get('Access-Control-Allow-Origin'), 'https://learn.propbetedge.ai');
  resetSearchCaches();
  const denied = await call('/v1/search?q=brier', { origin: 'https://learn.propbetedge.ai.evil.example', env: learnEnv() });
  assert.equal(denied.res.headers.get('Access-Control-Allow-Origin'), null);
});

test('refreshLearnIndex: gate, write, and bootstrap when missing', async () => {
  const realFetch = globalThis.fetch;
  try {
    let manifest = MANIFEST;
    globalThis.fetch = async (req) => {
      const url = typeof req === 'string' ? req : req.url;
      assert.equal(url, `${LEARN_SITE}/search-manifest.json`);
      return new Response(JSON.stringify(manifest), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    const env = { ENTITY_KV: fakeKv() };
    const ok = await refreshLearnIndex(env);
    assert.equal(ok.ok, true);
    const stored = JSON.parse(env.ENTITY_KV.store.get(KEYS.learn));
    assert.equal(stored.docs.length, LEARN.length);

    manifest = { ...MANIFEST, docs: MANIFEST.docs.slice(0, 5) };           // truncated deploy
    const gated = await refreshLearnIndex(env);
    assert.equal(gated.ok, false);
    assert.equal(gated.reason, 'implausible_manifest');
    assert.equal(JSON.parse(env.ENTITY_KV.store.get(KEYS.learn)).docs.length, LEARN.length, 'good index kept');

    manifest = { schema: 'nope', docs: [] };
    assert.equal((await refreshLearnIndex(env)).reason, 'bad_manifest_schema');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('palette labels learn results', () => {
  assert.deepEqual(resultLabel({ type: 'learn', label: 'LEARN · LESSON', subtitle: 'Model Literacy · 10 min' }), { kicker: 'LEARN · LESSON', detail: 'Model Literacy · 10 min' });
  assert.equal(resultLabel({ type: 'learn', subtitle: '' }).kicker, 'LEARN');
});
