#!/usr/bin/env node
// Regression gate for the international rollout (Global #67): compares a new PSI result set (from
// scripts/perf-capture.mjs) against the committed baseline. Zero dependencies.
//
//   node scripts/perf-gate.mjs --current result.json [--baseline docs/global/perf/baseline-2026-10-10.json]
//        [--strict] [--json] [--lcp-rule max|any]
//
// A page x strategy REGRESSES when any of these hold (lab values are per-metric medians):
//   LCP   current > baseline + 250 ms AND > baseline * 1.10   (--lcp-rule max, default: both must be exceeded,
//         so tiny pages are not flagged on noise; --lcp-rule any flags when EITHER is exceeded)
//   CLS   current - baseline > 0.02
//   TBT   current - baseline > 50 ms
//   bytes current > baseline * 1.05   (total-byte-weight, transfer bytes)
//   INP   field p75, ONLY when both baseline and current carry URL-level CrUX data:
//         current > baseline * 1.10 AND current - baseline > 25 ms
// A metric whose baseline or current value is null is UNKNOWN: never a pass, never a fail. It is listed.
// Also listed (informational, never failing): Good-threshold debts today (LCP > 2500 ms, CLS > 0.1, INP > 200 ms).
//
// Exit: 0 no regression; 1 at least one regression; 3 (--strict only) nothing regressed but something is UNKNOWN.
import { readFileSync } from 'node:fs';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : 'true']);
  return acc;
}, []));
if (!args.current) { console.error('usage: perf-gate.mjs --current <result.json> [--baseline <file>] [--strict] [--json]'); process.exit(2); }
const BASELINE = args.baseline || 'docs/global/perf/baseline-2026-10-10.json';
const LCP_RULE = args['lcp-rule'] || 'max';
const load = f => JSON.parse(readFileSync(f, 'utf8'));
const base = load(BASELINE);
const cur = load(args.current);
const key = r => `${r.id}|${r.strategy}`;
const curMap = new Map(cur.results.map(r => [key(r), r]));
const isNum = v => typeof v === 'number' && Number.isFinite(v);

const RULES = {
  lcp_ms: (b, c) => LCP_RULE === 'any' ? (c - b > 250 || c > b * 1.10) : (c - b > 250 && c > b * 1.10),
  cls: (b, c) => c - b > 0.02,
  tbt_ms: (b, c) => c - b > 50,
  bytes: (b, c) => c > b * 1.05,
};
const inpRule = (b, c) => c > b * 1.10 && c - b > 25;

const rows = [];
let regressions = 0, unknowns = 0;
for (const b of base.results) {
  const c = curMap.get(key(b));
  const row = { id: b.id, strategy: b.strategy, url: b.url, regressions: [], unknown: [], debts: [] };
  for (const [m, rule] of Object.entries(RULES)) {
    const bv = b.lab?.[m], cv = c?.lab?.[m];
    if (!isNum(bv) || !isNum(cv)) { row.unknown.push(`${m} (${!isNum(bv) ? 'no baseline' : 'no current'})`); continue; }
    if (rule(bv, cv)) row.regressions.push({ metric: m, baseline: bv, current: cv, delta: +(cv - bv).toFixed(4) });
  }
  const bi = b.field?.scope === 'url' ? b.field.inp_p75_ms : null;
  const ci = c?.field?.scope === 'url' ? c.field.inp_p75_ms : null;
  if (isNum(bi) && isNum(ci) && inpRule(bi, ci)) row.regressions.push({ metric: 'inp_p75_ms (field)', baseline: bi, current: ci, delta: ci - bi });
  const L = c?.lab || {};
  if (isNum(L.lcp_ms) && L.lcp_ms > 2500) row.debts.push(`LCP ${Math.round(L.lcp_ms)} ms > 2500`);
  if (isNum(L.cls) && L.cls > 0.1) row.debts.push(`CLS ${L.cls.toFixed(3)} > 0.1`);
  if (isNum(ci) && ci > 200) row.debts.push(`INP p75 ${ci} ms > 200`);
  regressions += row.regressions.length ? 1 : 0;
  unknowns += row.unknown.length ? 1 : 0;
  rows.push(row);
}
const added = cur.results.filter(r => !base.results.some(b => key(b) === key(r))).map(key);

if (args.json === 'true') console.log(JSON.stringify({ baseline: BASELINE, current: args.current, regressions, unknowns, added, rows }, null, 2));
else {
  for (const r of rows) {
    const tag = r.regressions.length ? 'REGRESSION' : r.unknown.length === Object.keys(RULES).length ? 'UNKNOWN' : r.unknown.length ? 'PARTIAL' : 'ok';
    console.log(`${tag.padEnd(10)} ${r.strategy.padEnd(7)} ${r.id}`);
    for (const g of r.regressions) console.log(`           ${g.metric}: ${g.baseline} -> ${g.current} (+${g.delta})`);
    if (r.unknown.length && tag !== 'UNKNOWN') console.log(`           unknown: ${r.unknown.join(', ')}`);
    if (r.debts.length) console.log(`           debt (pre-existing threshold miss): ${r.debts.join('; ')}`);
  }
  if (added.length) console.log(`not in baseline (no gate): ${added.join(', ')}`);
  console.log(`\n${regressions} regressed, ${unknowns} with UNKNOWN metrics, of ${rows.length} page-strategies (lcp-rule=${LCP_RULE})`);
}
process.exit(regressions ? 1 : (args.strict === 'true' && unknowns ? 3 : 0));
