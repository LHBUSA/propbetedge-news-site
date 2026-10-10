#!/usr/bin/env node
// Captures a PageSpeed Insights (PSI v5) result set for the pages in docs/global/perf/pages.json.
// Zero dependencies (Node >= 18 fetch). Keyless: PSI runs Lighthouse from Google's network, so this never
// polls production from this machine's IP (which trips the Vercel Security Checkpoint).
//
//   node scripts/perf-capture.mjs --out result.json [--pages docs/global/perf/pages.json]
//        [--runs 1] [--key-runs 3] [--strategies mobile,desktop] [--only id1,id2] [--cache dir]
//        [--gap-ms 3000] [--concurrency 2]
//
// Output: pbe-perf-results/1 (the same shape as baseline-*.json). Per page x strategy the lab value of each
// metric is the MEDIAN over successful runs (computed per metric). Field data (CrUX p75) is copied as PSI
// returns it; `field.scope` says whether it is URL-level, an origin fallback, or absent (null).
// Feed the output to scripts/perf-gate.mjs. A PSI API key is NOT used; if PSI rate-limits, the run is
// recorded as an error and the page stays UNKNOWN (null metrics).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : 'true']);
  return acc;
}, []));
const PAGES = args.pages || 'docs/global/perf/pages.json';
const OUT = args.out;
const RUNS = Number(args.runs || 1);
const KEY_RUNS = Number(args['key-runs'] || RUNS);
const STRATEGIES = (args.strategies || 'mobile,desktop').split(',');
const ONLY = args.only ? new Set(args.only.split(',')) : null;
const CACHE = args.cache || null;
const GAP = Math.max(3000, Number(args['gap-ms'] || 3000));
const CONC = Math.max(1, Number(args.concurrency || 2));
if (!OUT) { console.error('usage: perf-capture.mjs --out <file> [options]'); process.exit(2); }
if (CACHE) mkdirSync(CACHE, { recursive: true });

const pages = JSON.parse(readFileSync(PAGES, 'utf8')).pages.filter(p => !ONLY || ONLY.has(p.id));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const median = xs => { const v = xs.filter(x => x != null).sort((a, b) => a - b); if (!v.length) return null; const m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };

function fieldOf(exp) {
  if (!exp || !exp.metrics || !Object.keys(exp.metrics).length) return null;
  const p = k => num(exp.metrics[k]?.percentile);
  const cls = p('CUMULATIVE_LAYOUT_SHIFT_SCORE');
  return {
    id: exp.id || null, overall: exp.overall_category || null,
    lcp_p75_ms: p('LARGEST_CONTENTFUL_PAINT_MS'), inp_p75_ms: p('INTERACTION_TO_NEXT_PAINT'),
    cls_p75: cls == null ? null : cls / 100, fcp_p75_ms: p('FIRST_CONTENTFUL_PAINT_MS'),
    ttfb_p75_ms: p('EXPERIMENTAL_TIME_TO_FIRST_BYTE'),
  };
}

/** One PSI call -> a trimmed run record (never the full Lighthouse JSON). */
function trim(json) {
  const lr = json.lighthouseResult || {};
  const a = lr.audits || {};
  const nv = k => num(a[k]?.numericValue);
  const summary = {};
  for (const it of a['resource-summary']?.details?.items || []) summary[it.resourceType] = { requests: it.requestCount, bytes: it.transferSize };
  const net = a['network-requests']?.details?.items || [];
  const doc = net.find(i => i.resourceType === 'Document') || null;
  const url = json.loadingExperience || null;
  const urlLevel = url && url.id && !url.origin_fallback && url.metrics && Object.keys(url.metrics).length;
  return {
    fetch_time: lr.fetchTime || null, lighthouse_version: lr.lighthouseVersion || null,
    final_url: lr.finalDisplayedUrl || lr.finalUrl || null,
    doc_status: doc ? doc.statusCode : null, runtime_error: lr.runtimeError?.code || null,
    warnings: lr.runWarnings || [],
    perf_score: num(lr.categories?.performance?.score),
    lcp_ms: nv('largest-contentful-paint'), cls: nv('cumulative-layout-shift'), tbt_ms: nv('total-blocking-time'),
    fcp_ms: nv('first-contentful-paint'), si_ms: nv('speed-index'), ttfb_ms: nv('server-response-time'),
    bytes: nv('total-byte-weight'), requests: summary.total?.requests ?? (net.length || null),
    transfer: {
      document: summary.document?.bytes ?? null, script: summary.script?.bytes ?? null,
      stylesheet: summary.stylesheet?.bytes ?? null, image: summary.image?.bytes ?? null,
      font: summary.font?.bytes ?? null, other: summary.other?.bytes ?? null,
      third_party: summary['third-party']?.bytes ?? null,
    },
    request_counts: Object.fromEntries(Object.entries(summary).map(([k, v]) => [k, v.requests])),
    field: urlLevel ? { scope: 'url', ...fieldOf(url) } : null,
    origin_field: fieldOf(json.originLoadingExperience),
  };
}

let lastStart = 0;
async function slot() { // >= GAP between request starts, across all workers
  for (;;) { const wait = lastStart + GAP - Date.now(); if (wait <= 0) { lastStart = Date.now(); return; } await sleep(wait); }
}

async function psi(url, strategy) {
  const q = new URLSearchParams({ url, strategy, category: 'performance' });
  for (let attempt = 0; attempt < 4; attempt++) {
    await slot();
    let res, body;
    try {
      res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${q}`, { signal: AbortSignal.timeout(180000) });
      body = await res.text();
    } catch (e) { if (attempt === 3) return { error: `fetch: ${e.message}` }; await sleep(15000); continue; }
    if (res.ok) return trim(JSON.parse(body));
    const msg = (() => { try { return JSON.parse(body).error?.message; } catch { return body.slice(0, 200); } })();
    if (res.status === 429 || res.status >= 500) { if (attempt === 3) return { error: `HTTP ${res.status}: ${msg}` }; await sleep(30000 * (attempt + 1)); continue; }
    return { error: `HTTP ${res.status}: ${msg}` };
  }
}

const jobs = [];
for (const p of pages) for (const s of STRATEGIES) {
  const n = p.key ? KEY_RUNS : RUNS;
  for (let r = 0; r < n; r++) jobs.push({ p, s, r });
}
const runs = new Map();
let done = 0;
async function worker() {
  for (;;) {
    const job = jobs.shift(); if (!job) return;
    const file = CACHE && join(CACHE, `${job.p.id}.${job.s}.${job.r}.json`);
    let rec = file && existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
    if (!rec || rec.error) { rec = await psi(job.p.url, job.s); if (file) writeFileSync(file, JSON.stringify(rec, null, 1)); }
    const k = `${job.p.id}|${job.s}`; (runs.get(k) || runs.set(k, []).get(k)).push(rec);
    console.error(`[${++done}] ${job.p.id} ${job.s} #${job.r + 1}: ${rec.error ? 'ERROR ' + rec.error : `LCP ${Math.round(rec.lcp_ms)}ms CLS ${rec.cls?.toFixed(3)} TBT ${Math.round(rec.tbt_ms)}ms doc ${rec.doc_status}`}`);
  }
}
await Promise.all(Array.from({ length: CONC }, worker));

const LAB = ['perf_score', 'lcp_ms', 'cls', 'tbt_ms', 'fcp_ms', 'si_ms', 'ttfb_ms', 'bytes', 'requests'];
const TRANSFER = ['document', 'script', 'stylesheet', 'image', 'font', 'other', 'third_party'];
const results = [];
for (const p of pages) for (const s of STRATEGIES) {
  const all = runs.get(`${p.id}|${s}`) || [];
  // A run counts only if Lighthouse loaded a real 2xx document (a 403 checkpoint page would be a fake "fast" result).
  const ok = all.filter(r => !r.error && !r.runtime_error && r.doc_status >= 200 && r.doc_status < 300);
  const lab = ok.length ? Object.fromEntries(LAB.map(k => [k, median(ok.map(r => r[k]))])) : Object.fromEntries(LAB.map(k => [k, null]));
  lab.transfer = Object.fromEntries(TRANSFER.map(k => [k, ok.length ? median(ok.map(r => r.transfer?.[k] ?? null)) : null]));
  const last = ok[ok.length - 1] || all[all.length - 1] || {};
  results.push({
    id: p.id, site: p.site, lang: p.lang, url: p.url, en: p.en || null, strategy: s,
    runs_attempted: all.length, runs_ok: ok.length,
    lab, lab_runs: ok.map(r => ({ fetch_time: r.fetch_time, lcp_ms: r.lcp_ms, cls: r.cls, tbt_ms: r.tbt_ms, bytes: r.bytes, requests: r.requests, perf_score: r.perf_score })),
    field: last.field || null, origin_field: last.origin_field || null,
    final_url: last.final_url || null, doc_status: last.doc_status ?? null, lighthouse_version: last.lighthouse_version || null,
    warnings: [...new Set(ok.flatMap(r => r.warnings || []))],
    errors: all.filter(r => r.error || r.runtime_error || !(r.doc_status >= 200 && r.doc_status < 300)).map(r => r.error || r.runtime_error || `document status ${r.doc_status}`),
  });
}
writeFileSync(OUT, JSON.stringify({
  schema: 'pbe-perf-results/1', captured_at: new Date().toISOString(),
  method: { tool: 'PageSpeed Insights API v5 (keyless)', category: 'performance', strategies: STRATEGIES, runs: RUNS, key_runs: KEY_RUNS, aggregate: 'per-metric median of successful runs' },
  results,
}, null, 2) + '\n');
console.error(`wrote ${OUT}: ${results.filter(r => r.runs_ok).length}/${results.length} page-strategies measured`);
