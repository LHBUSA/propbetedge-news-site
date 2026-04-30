/**
 * src/pages/player-shared.js
 *
 * v3.13 Drop 1 — shared rendering primitives for player pages (all 4 sports).
 *
 * Bet-focused design:
 *   1. Hero — big photo + name + bio meta + tonight's game status
 *   2. Stat ribbon — 6-8 key metrics with up/down indicators vs league avg
 *   3. PropBetEdge angle — "What the market thinks tonight" + AI projection CTA
 *   4. Recent form — last 10 games table with hot/cold heatmap
 *   5. Splits — vs L/R, home/away, situation-specific (sport-aware)
 *   6. Game log — full season table, sortable
 *   7. Recent prop history — placeholder for v2 (linked to picks DB)
 *   8. News tease — articles mentioning this player
 */

import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';

// ─── Page shell ─────────────────────────────────────────────────────────
export function playerPageShell(bodyHtml) {
  return `
    ${renderHeader()}
    <main>
      <div class="container">
        ${bodyHtml}
      </div>
    </main>
    ${renderFooter()}
  `;
}

// ─── Hero band ──────────────────────────────────────────────────────────
// opts:
//   sport, photo, name, jersey, position, team, teamLogo, teamColor,
//   age, height, weight, bats, throws, gameStatus (optional)
export function renderPlayerHero(opts) {
  const {
    sport, photo, name, jersey, position, team, teamLogo, teamColor,
    age, height, weight, bats, throws, batsThrows, gameStatus,
  } = opts;

  const teamGradient = teamColor
    ? `linear-gradient(135deg, ${teamColor} 0%, ${darken(teamColor, 0.3)} 100%)`
    : `linear-gradient(135deg, var(--ink) 0%, #1a1612 100%)`;

  const metaItems = [
    position && { label: 'POS', value: position },
    jersey && { label: '#', value: jersey },
    age && { label: 'AGE', value: age },
    height && { label: 'HT', value: height },
    weight && { label: 'WT', value: weight },
    batsThrows && { label: 'B/T', value: batsThrows },
    bats && !batsThrows && { label: 'BATS', value: bats },
    throws && !batsThrows && { label: 'THROWS', value: throws },
  ].filter(Boolean);

  return `
    <section class="player-hero" style="background: ${teamGradient}">
      <div class="player-hero-mesh"></div>
      <div class="player-hero-inner">
        <div class="player-hero-photo-wrap">
          ${photo
            ? `<img src="${photo}" alt="${escapeAttr(name)}" class="player-hero-photo" onerror="this.style.display='none'" />`
            : `<div class="player-hero-photo-fallback">${initials(name)}</div>`
          }
          ${teamLogo ? `<img src="${teamLogo}" alt="" class="player-hero-team-badge" onerror="this.style.display='none'" />` : ''}
        </div>
        <div class="player-hero-content">
          <div class="player-hero-kicker">
            <span class="sport-pill">${sportBadge(sport)}</span>
            ${team ? `<a href="/team/${sport}/${opts.teamId || ''}" class="player-hero-team">${escapeHtml(team)}</a>` : ''}
          </div>
          <h1 class="player-hero-name">${escapeHtml(name)}</h1>
          <div class="player-hero-meta">
            ${metaItems.map((m) => `
              <div class="player-meta-item">
                <span class="player-meta-label">${m.label}</span>
                <span class="player-meta-value">${escapeHtml(String(m.value))}</span>
              </div>
            `).join('')}
          </div>
          ${gameStatus ? `<div class="player-hero-game-status">${gameStatus}</div>` : ''}
        </div>
      </div>
    </section>
  `;
}

// ─── Stat ribbon ────────────────────────────────────────────────────────
// stats: [{ label, value, color, vs?: 'up' | 'down' | 'flat', delta? }]
export function renderStatRibbon(stats, kicker = 'SEASON STATS') {
  if (!stats || !stats.length) return '';
  return `
    <section class="player-stat-ribbon">
      <div class="player-section-kicker">${kicker}</div>
      <div class="player-stat-grid">
        ${stats.map((s) => `
          <div class="player-stat-cell">
            <div class="player-stat-label">${s.label}</div>
            <div class="player-stat-value" style="color:${s.color || 'var(--ink)'}">
              ${s.value || '—'}
              ${s.vs === 'up' ? '<span class="player-stat-arrow up">↑</span>' :
                s.vs === 'down' ? '<span class="player-stat-arrow down">↓</span>' : ''}
            </div>
            ${s.delta ? `<div class="player-stat-delta">${s.delta}</div>` : ''}
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

// ─── PropBetEdge angle (the wedge) ──────────────────────────────────────
export function renderPropAngle(opts) {
  const { name, sport, gameStatus, projection } = opts;
  return `
    <section class="player-prop-angle">
      <div class="player-prop-head">
        <span class="player-prop-icon">🎯</span>
        <div>
          <div class="player-prop-kicker">PROPBETEDGE ANGLE</div>
          <div class="player-prop-title">What the market thinks ${gameStatus ? 'tonight' : 'this week'}</div>
        </div>
      </div>
      <div class="player-prop-body">
        <div class="player-prop-locked">
          <div class="player-prop-lock-icon">🔒</div>
          <div class="player-prop-lock-content">
            <div class="player-prop-lock-title">Live prop lines + AI projections</div>
            <div class="player-prop-lock-dek">
              See ${escapeHtml(name)}'s active props (HR, K, hits, points, goals — sport-dependent),
              our model's projection, edge%, and historical hit rate. Updated as lines move.
            </div>
            <a href="https://${sport === 'mlb' ? 'mlb.' : ''}propbetedge.ai" class="player-prop-cta">
              Unlock in PropBetEdge Picks →
            </a>
          </div>
        </div>
      </div>
    </section>
  `;
}

// ─── Recent form (sparkline + last N games) ─────────────────────────────
// games: [{ date, opp, result, statValues: [{ label, value, isHot? }] }]
export function renderRecentForm(games, primaryStatKey, primaryStatLabel) {
  if (!games || !games.length) {
    return `
      <section class="player-section">
        <div class="player-section-kicker">RECENT FORM</div>
        <div class="player-empty-card">No recent games — season may not be active.</div>
      </section>
    `;
  }

  const top10 = games.slice(0, 10);
  // Build sparkline from primary stat
  const values = top10.map((g) => parseFloat(g.statValues?.find((s) => s.label === primaryStatLabel)?.value) || 0).reverse();
  const sparkline = renderSparkline(values, 280, 50);

  return `
    <section class="player-section">
      <div class="player-section-kicker">RECENT FORM · LAST ${top10.length} GAMES</div>
      <div class="player-form-card">
        <div class="player-form-spark">
          ${sparkline}
          <div class="player-form-spark-label">${primaryStatLabel} trend (oldest → newest)</div>
        </div>
        <div class="player-form-table">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Opp</th>
                ${top10[0].statValues.map((s) => `<th>${s.label}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${top10.map((g) => `
                <tr>
                  <td>${formatGameDate(g.date)}</td>
                  <td>${escapeHtml(g.opp || '—')}</td>
                  ${g.statValues.map((s) => `
                    <td class="${s.isHot ? 'stat-hot' : s.isCold ? 'stat-cold' : ''}">${s.value || '—'}</td>
                  `).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `;
}

// ─── Splits panel ───────────────────────────────────────────────────────
// splits: [{ name, rows: [{ label, statValues: [{ label, value }] }] }]
export function renderSplits(splits) {
  if (!splits || !splits.length) return '';
  return `
    <section class="player-section">
      <div class="player-section-kicker">SPLITS</div>
      <div class="player-splits-grid">
        ${splits.map((split) => `
          <div class="player-split-card">
            <div class="player-split-title">${escapeHtml(split.name)}</div>
            <div class="player-split-rows">
              ${split.rows.map((row) => `
                <div class="player-split-row">
                  <span class="player-split-label">${escapeHtml(row.label)}</span>
                  <div class="player-split-stats">
                    ${row.statValues.map((s) => `
                      <span class="player-split-stat">
                        <span class="player-split-stat-label">${s.label}</span>
                        <span class="player-split-stat-value">${s.value || '—'}</span>
                      </span>
                    `).join('')}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

// ─── Game log (full season, scrollable) ─────────────────────────────────
export function renderGameLog(games, headers) {
  if (!games || !games.length) return '';
  return `
    <section class="player-section">
      <div class="player-section-kicker">GAME LOG · ${games.length} GAMES</div>
      <div class="player-gamelog-wrap">
        <table class="player-gamelog">
          <thead>
            <tr>
              ${headers.map((h) => `<th>${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${games.map((g) => `
              <tr>
                ${g.cells.map((c) => `<td class="${c.cls || ''}">${c.value}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

// ─── Loading ────────────────────────────────────────────────────────────
export function renderPlayerLoading() {
  return `
    <div class="player-loading">
      <div class="games-loading">
        <div class="games-loading-dot"></div>
        <div class="games-loading-dot"></div>
        <div class="games-loading-dot"></div>
      </div>
      <div class="player-loading-text">Loading player profile…</div>
    </div>
  `;
}

// ─── Sparkline SVG ──────────────────────────────────────────────────────
export function renderSparkline(values, width = 280, height = 50, color = 'var(--gold)') {
  if (!values || values.length < 2) return '';
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);
  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * (height - 8) - 4;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  // Last point gets a dot
  const lastX = (values.length - 1) * stepX;
  const lastY = height - ((values[values.length - 1] - min) / range) * (height - 8) - 4;

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="player-sparkline">
      <polyline points="${points}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
      <circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="3.5" fill="${color}" />
    </svg>
  `;
}

// ─── Helpers ────────────────────────────────────────────────────────────
export function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
export function escapeAttr(s) { return escapeHtml(s); }

export function initials(name) {
  if (!name) return '?';
  return name.split(' ').map((p) => p[0] || '').slice(0, 2).join('').toUpperCase();
}

export function darken(hex, amt = 0.3) {
  if (!hex || !hex.startsWith('#')) return '#1a1612';
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const f = 1 - amt;
  return `#${Math.round(r * f).toString(16).padStart(2, '0')}${Math.round(g * f).toString(16).padStart(2, '0')}${Math.round(b * f).toString(16).padStart(2, '0')}`;
}

export function sportBadge(sport) {
  const map = { mlb: '⚾ MLB', nhl: '🏒 NHL', nba: '🏀 NBA', nfl: '🏈 NFL' };
  return map[sport] || sport.toUpperCase();
}

export function formatGameDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
  } catch { return iso; }
}

export function fmt(v, decimals) {
  if (v == null || v === '') return '—';
  const n = parseFloat(v);
  if (isNaN(n)) return v;
  if (decimals != null) return n.toFixed(decimals);
  return n;
}

// Setmeta wrapper for player pages (called from sport-specific render fns)
export function setPlayerMeta(setMeta, name, sport, team) {
  if (!setMeta) return;
  setMeta({
    title: `${name}${team ? ` · ${team}` : ''} — ${sport.toUpperCase()} | PropBetEdge`,
    description: `${name} stats, splits, recent form, and prop-bet projections — ${sport.toUpperCase()} player profile on PropBetEdge.`,
  });
}
