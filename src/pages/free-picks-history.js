/**
 * Free Picks History — immutable public proof ledger.
 *
 * This page is intentionally separate from the live Free Picks sampler.
 * It only reads the frozen public ledger created on 2026-09-20.
 */

import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { escapeHtml } from '../components/article-card.js';
import { countsTowardRecord, isFeaturedPlayer, isTdTarget, namespacedRecord, productLabel, selectionType } from '../lib/free-board.js';
import {
  organizationSchema, websiteSchema, breadcrumbSchema, injectSchemas,
} from '../schema.js';

const TRACKER_URL = 'https://tkmlnhmylqnttmnsnief.supabase.co/functions/v1/free-picks-tracker';

const SPORTS = Object.freeze({
  MLB: { emoji: '⚾', label: 'MLB', cadence: 'DAILY' },
  NFL: { emoji: '🏈', label: 'NFL', cadence: 'DAILY SLATE' },
  UFC: { emoji: '🥊', label: 'UFC', cadence: 'WEEKLY' },
  WNBA: { emoji: '🏀', label: 'WNBA', cadence: 'DAILY' },
  NHL: { emoji: '🏒', label: 'NHL', cadence: 'DAILY' },
  NBA: { emoji: '🏀', label: 'NBA', cadence: 'DAILY' },
});

const RESULT_ORDER = Object.freeze({ WIN: 0, LOSS: 1, PUSH: 2, VOID: 3, PENDING: 4 });

export async function renderFreePicksHistory(root) {
  root.innerHTML = `
    ${renderHeader()}
    <main class="free-history-page">
      <div class="container" style="padding-top:32px">
        ${renderHero()}
        <div id="free-history-root">${renderSkeleton()}</div>
      </div>
    </main>
    ${renderFooter()}
  `;

  injectSchemas([
    organizationSchema(),
    websiteSchema(),
    breadcrumbSchema([
      { name: 'Home', url: '/' },
      { name: 'Free Picks', url: '/odds' },
      { name: 'Free Picks History' },
    ]),
  ], 'jsonld-free-picks-history');

  const mount = document.getElementById('free-history-root');
  if (!mount) return;

  try {
    const response = await fetch(TRACKER_URL, { cache: 'no-store', credentials: 'omit' });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const tracker = await response.json();
    if (!tracker?.ok) throw new Error('tracker unavailable');
    mount.innerHTML = renderHistory(tracker);
    bindFilters(mount);
  } catch (error) {
    console.warn('[free-picks-history] tracker unavailable:', error);
    mount.innerHTML = renderUnavailable();
  }
}

function renderHero() {
  return `
    <header class="free-history-hero">
      <div class="free-history-back"><a href="/odds">← Back to Free Picks</a></div>
      <span class="kicker kicker-gold">FREE PICKS HISTORY</span>
      <h1>Every free pick. Every result. Nothing disappears.</h1>
      <p>
        The public proof ledger for PropBetEdge free picks. Tracking started September 20, 2026.
        No model-history backfill. Documented public picks missed during capture outages may be restored and are explicitly labeled RECOVERED.
        Once a free pick is recorded here, the pick identity stays frozen; only its settlement can change.
      </p>
    </header>
  `;
}

function renderSkeleton() {
  return `
    <section class="free-history-summary is-loading">
      <div class="skel skel-card" style="height:180px"></div>
    </section>
    <section class="free-history-ledger">
      <div class="skel skel-card" style="height:320px"></div>
    </section>
  `;
}

function renderUnavailable() {
  return `
    <section class="free-history-unavailable">
      <span class="kicker kicker-gold">PUBLIC PROOF LEDGER</span>
      <h2>History is reconnecting.</h2>
      <p>The live Free Picks board is separate and remains available.</p>
      <a href="/odds">Return to Free Picks →</a>
    </section>
  `;
}

function renderHistory(tracker) {
  const record = tracker.record || {};
  const entries = normalizeEntries(tracker.entries);
  const wins = Number(record.wins || 0);
  const losses = Number(record.losses || 0);
  const pushes = Number(record.pushes || 0);
  const pending = Number(record.pending || 0);
  const picks = entries.filter(countsTowardRecord);
  const featured = entries.filter(isFeaturedPlayer);
  const legacy = entries.length - picks.length - featured.length;

  return `
    <section class="free-history-summary">
      <div class="free-history-overall">
        <span>OVERALL FREE RECORD</span>
        <strong>${wins}–${losses}${pushes ? `–${pushes}P` : ''}</strong>
        <small>${picks.length} recorded free pick${picks.length === 1 ? '' : 's'} · ${pending} pending${legacy ? ` · ${legacy} legacy validation signal${legacy === 1 ? '' : 's'} excluded` : ''}</small>
      </div>

      <div class="free-history-summary-copy">
        <span class="free-history-epoch">STARTED 09/20/26 · NO MODEL-HISTORY BACKFILL</span>
        <h2>A public record built from the actual free board.</h2>
        <p>Free products since Sep 28, 2026: MLB Featured Player (one a day, not an Algo Pick, its own record) and up to 2 NFL TD Targets per slate. UFC, WNBA and NHL publish from their own models. The overall free record is the sum of the model-pick ledgers; the MLB Featured Player is never part of it.</p>
      </div>
    </section>

    ${renderProductRecords(tracker)}

    <section class="free-history-sports">
      ${Object.keys(SPORTS).map((sport) => renderSportSummary(tracker, sport)).join('')}
    </section>

    <section class="free-history-ledger">
      <div class="free-history-ledger-head">
        <div>
          <span class="kicker kicker-gold">COMPLETE PUBLIC LEDGER</span>
          <h2>All recorded free picks</h2>
          <p>Newest first. Settled picks stay visible permanently; pending picks remain on the board until they resolve.</p>
        </div>
        <a class="free-history-live-link" href="/odds">Current Free Picks →</a>
      </div>

      <div class="free-history-filters" role="group" aria-label="Filter free picks history">
        <button type="button" class="is-active" data-history-filter="ALL">All</button>
        ${Object.keys(SPORTS).map((sport) => `<button type="button" data-history-filter="${sport}">${sport}</button>`).join('')}
        <button type="button" data-history-filter="SETTLED">Settled</button>
        <button type="button" data-history-filter="PENDING">Pending</button>
      </div>

      <div class="free-history-list" id="free-history-list">
        ${entries.map(renderHistoryRow).join('')}
      </div>

      <div class="free-history-empty" id="free-history-empty" hidden>No recorded picks match this filter.</div>
    </section>

    <section class="free-history-method">
      <div>
        <span class="kicker kicker-gold">HOW TO READ THIS</span>
        <h2>The live board and history ledger are separate by design.</h2>
      </div>
      <p>
        The live page decides what is currently being shown. This page never selects or rotates picks.
        It only preserves what was already published publicly and records the result when that sport's settlement source confirms it.
      </p>
      <p>
        No model-history backfill. Documented public picks missed during capture outages may be restored and are explicitly labeled RECOVERED.
        A pick replaced before its event is never swapped: the original is marked WITHDRAWN (void, with the reason and time) and the replacement is recorded separately.
        On Sep 28, 2026 the MLB free pick changed from an official Algo selection to the Featured Player, and the NFL free pick changed from team picks to TD Targets. Earlier rows keep the product that generated them and are labelled LEGACY FREE PRODUCT.
        Rows labeled LEGACY VALIDATION SIGNAL were shown publicly before the Free Picks contract excluded validation output; they stay here for transparency and are excluded from the Free Picks record.
      </p>
    </section>
  `;
}

function renderProductRecords(tracker) {
  const rows = [
    ['MLB Featured Player', namespacedRecord(tracker, 'free_featured_player_record'), 'Since Sep 28, 2026 · editorial showcase · not an Algo record'],
    ['NFL Free TD Targets', namespacedRecord(tracker, 'free_td_target_record'), 'Since Sep 28, 2026 · official TD Targets only'],
    ['MLB Algo free picks', namespacedRecord(tracker, 'legacy.mlb_algo_free_picks'), 'Legacy free product · Sep 20–27, 2026'],
    ['NFL team picks', namespacedRecord(tracker, 'legacy.nfl_team_picks'), 'Legacy free product · before Sep 28, 2026'],
  ].filter(([, rec]) => rec);
  if (!rows.length) return '';
  return `
    <section class="free-history-sports free-history-products" aria-label="Free product records">
      ${rows.map(([label, rec, note]) => `
        <article class="free-history-sport">
          <div>
            <b>${escapeHtml(label)}</b>
            <small>${escapeHtml(note)}</small>
          </div>
          <strong>${escapeHtml(rec.record)}</strong>
          <em>${rec.pending ? `${rec.pending} pending` : (rec.wins || rec.losses) ? 'settled' : 'no picks yet'}${rec.voids ? ` · ${rec.voids} void` : ''}</em>
        </article>`).join('')}
    </section>
  `;
}

function normalizeEntries(entries) {
  return (Array.isArray(entries) ? entries : [])
    .filter((entry) => entry?.evidence?.suppressed !== true)
    .sort((a, b) => {
      const ta = Date.parse(a.published_at || a.created_at || 0);
      const tb = Date.parse(b.published_at || b.created_at || 0);
      if (tb !== ta) return tb - ta;
      return (RESULT_ORDER[a.result] ?? 99) - (RESULT_ORDER[b.result] ?? 99);
    });
}

function renderSportSummary(tracker, sport) {
  const meta = SPORTS[sport];
  const stat = tracker?.by_sport?.[sport] || {};
  const wins = Number(stat.wins || 0);
  const losses = Number(stat.losses || 0);
  const pushes = Number(stat.pushes || 0);
  const pending = Number(stat.pending || 0);
  const record = `${wins}–${losses}${pushes ? `–${pushes}P` : ''}`;

  return `
    <article class="free-history-sport">
      <div class="free-history-sport-icon" aria-hidden="true">${meta.emoji}</div>
      <div>
        <b>${meta.label}</b>
        <small>${meta.cadence}</small>
      </div>
      <strong>${record}</strong>
      <em>${pending ? `${pending} pending` : (wins || losses || pushes) ? 'settled' : 'no picks yet'}</em>
    </article>
  `;
}

function pendingStatusLabel(entry) {
  const result = String(entry?.result || 'PENDING').toUpperCase();
  if (result !== 'PENDING') return result;
  const status = String(entry?.evidence?.status || '');
  if (/postpon/i.test(status)) return 'POSTPONED';
  if (/suspend/i.test(status)) return 'SUSPENDED';
  if (/delay|rain|weather/i.test(status)) return 'WEATHER DELAY';
  return 'PENDING';
}

function renderHistoryRow(entry) {
  const sport = String(entry.sport || '').toUpperCase();
  const meta = SPORTS[sport] || { emoji: '⚡', label: sport || 'PBE', cadence: String(entry.cadence || '').toUpperCase() };
  const result = String(entry.result || 'PENDING').toUpperCase();
  const statusLabel = pendingStatusLabel(entry);
  const settled = result !== 'PENDING';
  const provider = proofLabel(entry);
  const published = formatEt(entry.published_at);
  const settledAt = settled ? formatEt(entry.result_at) : null;
  const featured = isFeaturedPlayer(entry);
  const legacy = !countsTowardRecord(entry) && !featured;
  const type = selectionType(entry);
  const productFlag = featured
    ? '<span class="free-history-flag is-featured">FEATURED PLAYER · NOT AN ALGO PICK · SEPARATE RECORD</span>'
    : isTdTarget(entry) ? '<span class="free-history-flag is-td">FREE TD TARGET · OFFICIAL</span>'
      : (type === 'algo' || type === 'team_pick') ? `<span class="free-history-flag is-product-legacy">${escapeHtml(productLabel(entry))}</span>` : '';
  const withdrawn = entry?.evidence?.withdrawn === true;
  const recovered = entry?.evidence?.recovered === true;
  const badge = withdrawn ? 'WITHDRAWN' : result === 'WIN' ? 'HIT' : result === 'LOSS' ? 'MISS' : statusLabel;
  const flags = [
    productFlag,
    legacy ? '<span class="free-history-flag is-legacy">LEGACY VALIDATION SIGNAL · EXCLUDED FROM FREE PICKS RECORD</span>' : '',
    withdrawn ? `<span class="free-history-flag is-withdrawn">WITHDRAWN ${escapeHtml(formatEt(entry.evidence.withdrawn_at))} · ${escapeHtml(String(entry.evidence.withdrawn_reason || '').replace(/_/g, ' '))}</span>` : '',
    recovered ? `<span class="free-history-flag is-recovered">RECOVERED ${escapeHtml(formatEt(entry.evidence.recovered_at))} · missed at capture (${escapeHtml(String(entry.evidence.capture_gap_reason || 'capture gap').replace(/_/g, ' '))})</span>` : '',
  ].filter(Boolean).join('');

  return `
    <article
      class="free-history-row is-${escapeHtml(result.toLowerCase())}${legacy ? ' is-legacy' : ''}"
      data-history-sport="${escapeHtml(sport)}"
      data-history-result="${escapeHtml(result)}"
    >
      <div class="free-history-row-sport">
        <span aria-hidden="true">${meta.emoji}</span>
        <div><b>${escapeHtml(meta.label)}</b><small>${escapeHtml(String(entry.cadence || meta.cadence).toUpperCase())}</small></div>
      </div>

      <div class="free-history-row-pick">
        <span>${escapeHtml(featured ? 'FEATURED PLAYER · HR' : isTdTarget(entry) ? 'TD TARGET · ANYTIME TD' : entry.pick_type || 'FREE PICK')}</span>
        <strong>${escapeHtml(entry.selection || 'Recorded free pick')}</strong>
        <small>${escapeHtml(entry.matchup || entry.opponent || '')}</small>
        ${flags}
      </div>

      <div class="free-history-row-times">
        <span><b>Published</b>${escapeHtml(published)}</span>
        <span><b>${settled ? 'Settled' : 'Status'}</b>${settled ? escapeHtml(settledAt) : escapeHtml(statusLabel)}</span>
      </div>

      <div class="free-history-row-result">
        <span class="free-history-result-badge is-${escapeHtml(result.toLowerCase())}">${escapeHtml(badge)}</span>
        ${entry.score ? `<strong>${escapeHtml(entry.score)}</strong>` : ''}
        <small>${escapeHtml(provider)}</small>
      </div>
    </article>
  `;
}

function proofLabel(entry) {
  const result = String(entry?.result || 'PENDING').toUpperCase();
  const statusLabel = pendingStatusLabel(entry);
  const provider = String(entry?.evidence?.provider || entry?.evidence?.source || '').toLowerCase();
  if (result === 'PENDING' && statusLabel !== 'PENDING') return 'Grading paused until the game is officially final';
  if (provider.includes('mlb')) return 'Verified from live MLB result data';
  if (provider.includes('nfl')) return 'Verified from NFL graded ledger';
  if (provider.includes('ufc')) return 'Verified from UFC bout result';
  if (provider.includes('wnba')) return 'Verified from WNBA graded ledger';
  if (provider.includes('nhl')) return 'Verified from NHL graded ledger';
  return result === 'PENDING'
    ? 'Waiting for official settlement'
    : 'Verified public result';
}

function formatEt(value) {
  const ms = Date.parse(value || '');
  if (!Number.isFinite(ms)) return '—';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(ms));
}

function bindFilters(root) {
  const buttons = [...root.querySelectorAll('[data-history-filter]')];
  const rows = [...root.querySelectorAll('.free-history-row')];
  const empty = root.querySelector('#free-history-empty');

  const apply = (filter) => {
    let visible = 0;
    for (const row of rows) {
      const sport = row.dataset.historySport;
      const result = row.dataset.historyResult;
      const show = filter === 'ALL'
        || sport === filter
        || (filter === 'SETTLED' && result !== 'PENDING')
        || (filter === 'PENDING' && result === 'PENDING');
      row.hidden = !show;
      if (show) visible += 1;
    }
    if (empty) empty.hidden = visible !== 0;
    for (const button of buttons) {
      button.classList.toggle('is-active', button.dataset.historyFilter === filter);
    }
  };

  for (const button of buttons) {
    button.addEventListener('click', () => apply(button.dataset.historyFilter || 'ALL'));
  }
}
