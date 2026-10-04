// NFL PBE context for the Article Market module (shared client pbeContext, propbetedge-workers d2a920a;
// docs/POST_EVENT_MARKET_RESULT.md "Non-official PBE context").
//
// The market module's own PBE line is the OFFICIAL Algo-vs-Market record, which correctly has no NFL algorithm, so
// NFL articles said "No official call" even when the game carried real frozen PBE validation decisions. This reads
// the NFL product's own authenticated per-game contracts and hands the module a SEPARATE context:
//
//   https://nfl.propbetedge.ai/api/pbe-picks?view=game&game_id=<ESPN id>             game-engine decisions
//   https://nfl.propbetedge.ai/api/pbe-touchdown-targets?view=game&game_id=<ESPN id> TD targets
//
// credentials: 'include' — propbetedge.ai and nfl.propbetedge.ai are the same site, so the NFL session cookie rides
// along and the NFL server decides the tier (NFL Pro / All Access / owner = full; anyone else = counts only). This
// file never decides entitlement and never selects anything: it only reshapes what the server already chose to send.
// The public cached /api/markets response is untouched. Any failed read -> null (the module keeps its original line).

export const NFL_PBE_ORIGIN = 'https://nfl.propbetedge.ai';
export const NFL_PBE_CTA = Object.freeze({ href: 'https://propbetedge.ai/pro', label: 'NFL Pro / All Access' });
const MARKET_ORDER = { moneyline: 0, spread: 1, total: 2 };
const finite = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

async function readJson(url, fetchImpl) {
  try {
    const r = await fetchImpl(url, { credentials: 'include', headers: { accept: 'application/json' } });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

/** Server responses -> the module's pbeContext, or null when nothing trustworthy came back. */
export function buildNflPbeContext(picks, td) {
  const picksOk = picks?.view === 'game';
  const tdOk = td?.view === 'game';
  if (!picksOk && !tdOk) return null;

  // Only non-official rows belong in this block (it says "not the Official Track Record"). An official NFL row would
  // be the official record's job, never relabelled here.
  const signals = picksOk && picks.access === 'pro' && Array.isArray(picks.picks)
    ? picks.picks
      .filter((p) => p?.publication_scope === 'tracking' && p.selection?.display && finite(p.model?.prob) !== null)
      .sort((a, b) => (MARKET_ORDER[a.market] ?? 9) - (MARKET_ORDER[b.market] ?? 9))
      .map((p) => {
        const issued = Date.parse(p.issue?.at || '');
        const lock = Date.parse(p.lock?.boundary || p.kickoff_ts || '');
        return {
          market: p.market,
          display: p.selection.display,
          price: finite(p.issue?.price),
          probability: finite(p.model.prob),
          lifecycle: p.lifecycle,
          before_kickoff: Number.isFinite(issued) && Number.isFinite(lock) ? issued < lock : null,
          scope_label: p.label || null,
        };
      })
    : [];
  const targets = tdOk && td.access === 'pro' && Array.isArray(td.targets)
    ? td.targets
      .filter((t) => t?.publication_scope === 'tracking' && t.player?.name && finite(t.model?.probability) !== null)
      .map((t) => ({ rank: t.target_rank === 'primary' ? 'PRIMARY' : 'SECONDARY', name: t.player.name, probability: finite(t.model.probability), scope_label: t.scope_label || null }))
    : [];
  if (signals.length || targets.length) return { scope: signals.length ? 'VALIDATION' : 'TRACKING', access: 'full', game_signals: signals, td_targets: targets };

  // Locked (or an entitled reader whose rows were all official): existence only, never a name or a number.
  const signalCount = picksOk && picks.access !== 'pro' ? Number(picks.count) || 0 : 0;
  const targetCount = tdOk && td.access !== 'pro' ? Number(td.counts?.targets) || 0 : 0;
  if (signalCount > 0) return { scope: 'VALIDATION', access: 'locked', cta: NFL_PBE_CTA };
  if (targetCount > 0) return { scope: 'TRACKING', access: 'locked', cta: NFL_PBE_CTA };

  // "No PBE decision" only when BOTH reads answered and both say the game has nothing at any scope.
  const picksNone = picksOk && (picks.evaluated === false || (Number(picks.count) || 0) === 0);
  const tdNone = tdOk && (td.evaluated === false || (Number(td.counts?.targets) || 0) === 0);
  return picksNone && tdNone ? { scope: 'NONE' } : null;
}

/** Both NFL per-game reads in parallel; resolves to the context or null. Never throws. */
export async function loadNflPbeContext(eventId, fetchImpl = (...a) => globalThis.fetch(...a)) {
  if (!/^\d{6,12}$/.test(String(eventId || ''))) return null;
  const id = encodeURIComponent(eventId);
  const [picks, td] = await Promise.all([
    readJson(`${NFL_PBE_ORIGIN}/api/pbe-picks?view=game&game_id=${id}`, fetchImpl),
    readJson(`${NFL_PBE_ORIGIN}/api/pbe-touchdown-targets?view=game&game_id=${id}`, fetchImpl),
  ]);
  return buildNflPbeContext(picks, td);
}
