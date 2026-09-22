/**
 * Free Picks History — immutable public proof ledger.
 *
 * This page is intentionally separate from the live Free Picks sampler.
 * It only reads the frozen public ledger created on 2026-09-20.
 */

import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { escapeHtml } from '../components/article-card.js';
import {
  organizationSchema, websiteSchema, breadcrumbSchema, injectSchemas,
} from '../schema.js';

const TRACKER_URL = 'https://tkmlnhmylqnttmnsnief.supabase.co/functions/v1/free-picks-tracker';

const SPORTS = Object.freeze({
  MLB: { emoji: '⚾', label: 'MLB', cadence: 'DAILY' },
  NFL: { emoji: '🏈', label: 'NFL', cadence: 'WEEKLY' },
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
        The public proof ledger for PropBetEdge free picks. Tracking started September 20, 2026 with no historical backfill.
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

  return `
    <section class="free-history-summary">
      <div class="free-history-overall">
        <span>OVERALL FREE RECORD</span>
        <strong>${wins}–${losses}${pushes ? `–${pushes}P` : ''}</strong>
        <small>${entries.length} recorded free pick${entries.length === 1 ? '' : 's'} · ${pending} pending</small>
      </div>

      <div class="free-history-summary-copy">
        <span class="free-history-epoch">STARTED 09/20/26 · NO BACKFILL</span>
        <h2>A public record built from the actual free board.</h2>
        <p>Daily lanes: MLB, WNBA, NHL and NBA. Weekly lanes: NFL and UFC. The overall record is just the sum of those individual ledgers.</p>
      </div>
    </section>

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

  return `
    <article
      class="free-history-row is-${escapeHtml(result.toLowerCase())}"
      data-history-sport="${escapeHtml(sport)}"
      data-history-result="${escapeHtml(result)}"
    >
      <div class="free-history-row-sport">
        <span aria-hidden="true">${meta.emoji}</span>
        <div><b>${escapeHtml(meta.label)}</b><small>${escapeHtml(meta.cadence)}</small></div>
      </div>

      <div class="free-history-row-pick">
        <span>${escapeHtml(entry.pick_type || 'FREE PICK')}</span>
        <strong>${escapeHtml(entry.selection || 'Recorded free pick')}</strong>
        <small>${escapeHtml(entry.matchup || entry.opponent || '')}</small>
      </div>

      <div class="free-history-row-times">
        <span><b>Published</b>${escapeHtml(published)}</span>
        <span><b>${settled ? 'Settled' : 'Status'}</b>${settled ? escapeHtml(settledAt) : escapeHtml(statusLabel)}</span>
      </div>

      <div class="free-history-row-result">
        <span class="free-history-result-badge is-${escapeHtml(result.toLowerCase())}">${escapeHtml(result === 'WIN' ? 'HIT' : result === 'LOSS' ? 'MISS' : statusLabel)}</span>
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
