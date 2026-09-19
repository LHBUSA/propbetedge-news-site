/**
 * /leaders/ufc — current UFC divisional champions.
 *
 * This intentionally is not a "stat leaders" board. Championship state comes
 * from the same dated UFC official rankings snapshot used by ufc.propbetedge.ai.
 */

import {
  leadersPageShell,
  renderLeaderLoading,
  renderLeaderLiveStatus,
  markLeaderUpdated,
  startLeaderAutoRefresh,
  escapeHtml,
  escapeAttr,
} from './leaders-shared.js';

let _payload = null;
let _loading = null;

export async function renderUfcChampionsPage(root) {
  root.innerHTML = leadersPageShell(
    'ufc',
    'UFC',
    'Current divisional champions from the dated UFC official rankings snapshot. No pound-for-pound list and no invented belt status.',
    `
      ${renderLeaderLiveStatus('UFC official rankings snapshot', 300)}
      <div id="leaders-body">${renderLeaderLoading()}</div>
    `,
    'CURRENT BELTS',
    { title: 'UFC Champions', kicker: 'UFC CHAMPIONS' },
  );

  await loadData({ force: true });
  renderActive();
  markLeaderUpdated('UFC rankings');

  startLeaderAutoRefresh('ufc', async () => {
    await loadData({ force: true });
    renderActive();
    markLeaderUpdated('UFC rankings');
  }, 300000);
}

async function loadData({ force = false } = {}) {
  if (_payload && !force) return _payload;
  if (_loading) return _loading;

  _loading = fetch(`/api/ufc-champions?t=${Date.now()}`, {
    cache: 'no-store',
    credentials: 'omit',
  })
    .then((r) => {
      if (!r.ok) throw new Error(`UFC champions ${r.status}`);
      return r.json();
    })
    .then((data) => {
      _payload = data;
      return data;
    })
    .catch((error) => {
      console.warn('[leaders/ufc] champions unavailable', error);
      return null;
    })
    .finally(() => {
      _loading = null;
    });

  return _loading;
}

function renderActive() {
  const body = document.getElementById('leaders-body');
  if (!body) return;

  const divisions = Array.isArray(_payload?.divisions) ? _payload.divisions : [];
  if (!divisions.length) {
    body.innerHTML = `
      <div class="games-empty">
        <h3>UFC champions temporarily unavailable</h3>
        <p>The verified rankings snapshot could not be loaded. This page retries automatically.</p>
      </div>
    `;
    return;
  }

  const men = divisions.filter((d) => !d.isWomen);
  const women = divisions.filter((d) => d.isWomen);
  const stamp = _payload.snapshotDate || formatDate(_payload.capturedAt);

  body.innerHTML = `
    <div class="leaders-banner">
      🏆 ${stamp ? `Snapshot ${escapeHtml(stamp)} · ` : ''}${escapeHtml(_payload.source || 'UFC official rankings')} · divisional champions only
    </div>
    ${renderGroup('Men’s Divisions', men)}
    ${renderGroup('Women’s Divisions', women)}
    <div class="ufc-champions-source">
      Championship status is sourced from the dated UFC rankings snapshot.
      <a href="${escapeAttr(_payload.sourceUrl || 'https://www.ufc.com/rankings')}" target="_blank" rel="noopener">Official source →</a>
    </div>
  `;
}

function renderGroup(title, divisions) {
  if (!divisions.length) return '';
  return `
    <section class="ufc-champions-group">
      <div class="ufc-champions-group-head">
        <h2>${escapeHtml(title)}</h2>
        <span>${divisions.length} champions</span>
      </div>
      <div class="leaders-grid ufc-champions-grid">
        ${divisions.map(renderChampionCard).join('')}
      </div>
    </section>
  `;
}

function renderChampionCard(row) {
  const champ = row.champion || {};
  const href = champ.href || 'https://ufc.propbetedge.ai/rankings';
  return `
    <section class="leader-card ufc-champion-card">
      <div class="leader-card-head">
        <span class="leader-card-stat" style="color:var(--gold)">${escapeHtml(row.division || 'Division')}</span>
        <span class="leader-card-meta">CHAMPION</span>
      </div>
      <a href="${escapeAttr(href)}" class="ufc-champion-link" target="_blank" rel="noopener">
        <div class="ufc-champion-media">
          ${champ.image ? `<img src="${escapeAttr(champ.image)}" alt="${escapeAttr(champ.name || 'UFC champion')}" loading="lazy" onerror="this.style.display='none'" />` : ''}
          <span class="ufc-champion-belt" aria-hidden="true">🏆</span>
        </div>
        <div class="ufc-champion-copy">
          <strong>${escapeHtml(champ.name || 'Champion')}</strong>
          <span>${escapeHtml(row.division || '')}</span>
          <small>Open fighter intelligence →</small>
        </div>
      </a>
    </section>
  `;
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : '';
}
