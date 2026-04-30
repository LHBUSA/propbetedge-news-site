/**
 * src/pages/leaders-shared.js
 * v3.12 — shared rendering primitives used by all 4 per-sport leader pages.
 *
 * Centralizes the player card, leader row, hero, sport-tab strip, advanced-stat
 * upsell card, and computed-stat helpers so each sport file stays focused on
 * its own data shape and stat catalog.
 */

import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';

// ─── Hero ────────────────────────────────────────────────────────────────
export function renderLeadersHero(sportLabel, dek, kickerSuffix = '') {
  return `
    <section class="leaders-hero">
      <div class="leaders-hero-mesh"></div>
      <div class="leaders-hero-inner">
        <div class="leaders-hero-kicker">
          <span class="live-dot-big"></span>
          <span>${sportLabel.toUpperCase()} STAT LEADERS${kickerSuffix ? ' · ' + kickerSuffix : ''}</span>
        </div>
        <h1 class="leaders-hero-title">${sportLabel} Leaders</h1>
        <p class="leaders-hero-dek">${dek}</p>
      </div>
    </section>
  `;
}

// ─── Sport tab strip (real navigation between routes) ──────────────────
export function renderSportTabStrip(activeSport) {
  const tabs = [
    { sport: 'mlb', label: '⚾ MLB' },
    { sport: 'nhl', label: '🏒 NHL' },
    { sport: 'nba', label: '🏀 NBA' },
    { sport: 'nfl', label: '🏈 NFL' },
  ];
  return `
    <div class="leaders-sport-tabs">
      ${tabs.map((t) => `
        <a href="/leaders/${t.sport}" class="leaders-sport-tab ${t.sport === activeSport ? 'active' : ''}">
          ${t.label}
        </a>
      `).join('')}
    </div>
  `;
}

// ─── Page chrome wrapper ────────────────────────────────────────────────
export function leadersPageShell(sportSlug, sportLabel, dek, bodyHtml, kickerSuffix = '') {
  return `
    ${renderHeader()}
    <main>
      <div class="container">
        ${renderLeadersHero(sportLabel, dek, kickerSuffix)}
        ${renderSportTabStrip(sportSlug)}
        ${bodyHtml}
        ${renderEdgeStrip()}
      </div>
    </main>
    ${renderFooter()}
  `;
}

// ─── Edge strip CTA (same on every leaders page) ───────────────────────
export function renderEdgeStrip() {
  return `
    <section class="games-edge-strip">
      <div class="games-edge-grid">
        <div class="games-edge-cell">
          <div class="games-edge-icon">🎯</div>
          <div class="games-edge-title">PropBetEdge Picks</div>
          <div class="games-edge-dek">Daily AI-scored prop picks built on stats deeper than what's shown here.</div>
          <a href="https://mlb.propbetedge.ai" class="games-edge-cta">See picks →</a>
        </div>
        <div class="games-edge-cell">
          <div class="games-edge-icon">📡</div>
          <div class="games-edge-title">PropSports API</div>
          <div class="games-edge-dek">47 endpoints · 4 sports · Statcast · model odds. Free demo key.</div>
          <a href="https://propsports.proptechusa.ai" class="games-edge-cta">API docs →</a>
        </div>
        <div class="games-edge-cell">
          <div class="games-edge-icon">🔒</div>
          <div class="games-edge-title">Free MLB for life</div>
          <div class="games-edge-dek">Subscribe before May 15 to lock in MLB picks free forever. After: $29/mo.</div>
          <a href="https://mlb.propbetedge.ai" class="games-edge-cta">Subscribe →</a>
        </div>
      </div>
    </section>
  `;
}

// ─── Premium analytics upsell card (advanced stats blocked by CORS) ────
export function renderPremiumStatCard(label, color, statName, dek) {
  return `
    <div class="leader-card leader-card-premium">
      <div class="leader-card-head" style="border-color:${color}33">
        <span class="leader-card-stat" style="color:${color}">${label}</span>
        <span class="leader-card-meta premium-tag">🔒 PREMIUM</span>
      </div>
      <div class="premium-card-body">
        <div class="premium-stat-name">${statName}</div>
        <div class="premium-dek">${dek}</div>
        <a href="https://mlb.propbetedge.ai" class="premium-cta">Premium analytics in picks app →</a>
      </div>
    </div>
  `;
}

// ─── Empty card (when API returns no data) ──────────────────────────────
export function renderEmptyStatCard(label, color, message = 'No data yet') {
  return `
    <div class="leader-card">
      <div class="leader-card-head" style="border-color:${color}33">
        <span class="leader-card-stat" style="color:${color}">${label}</span>
      </div>
      <div class="leader-empty">${message}</div>
    </div>
  `;
}

// ─── Rich leader row (used by all sports) ──────────────────────────────
// opts:
//   rank, color, name, team, photo, value, valueColor (optional)
//   meta1 (e.g. "1B · 27 yrs · #15"), meta2 (e.g. "GP: 24")
//   trend ('up' | 'down' | 'flat' | null)
//   teamLogo (optional small logo overlay on photo)
//   href (link target)
export function renderLeaderRow(opts) {
  const {
    rank, color, name, team, photo, value, valueColor,
    meta1, meta2, trend, teamLogo, href,
  } = opts;

  const isTop = rank === 0;
  const tag = href ? 'a' : 'div';
  const valColor = valueColor || (isTop ? color : 'var(--ink)');
  const rankColor = rank < 3 ? color : 'rgba(20,17,13,0.4)';

  const trendArrow = trend === 'up' ? '<span class="leader-trend leader-trend-up">↑</span>'
                   : trend === 'down' ? '<span class="leader-trend leader-trend-down">↓</span>'
                   : '';

  const photoBlock = photo
    ? `<div class="leader-photo-wrap">
         <img src="${photo}" alt="${escapeAttr(name)}" class="leader-photo${isTop ? ' leader-photo-top' : ''}" loading="lazy" onerror="this.style.display='none'" />
         ${teamLogo ? `<img src="${teamLogo}" alt="" class="leader-team-overlay" loading="lazy" onerror="this.style.display='none'" />` : ''}
       </div>`
    : '<div class="leader-photo-fallback"></div>';

  return `
    <${tag} ${href ? `href="${href}"` : ''} class="leader-row leader-row-rich ${isTop ? 'is-top' : ''}">
      <span class="leader-rank" style="color:${rankColor}">${rank + 1}</span>
      ${photoBlock}
      <div class="leader-info">
        <div class="leader-name-line">
          <span class="leader-name">${escapeHtml(name)}</span>
          ${trendArrow}
        </div>
        <div class="leader-meta-line">
          <span class="leader-team">${escapeHtml(team || '')}</span>
          ${meta1 ? `<span class="leader-meta-sep">·</span><span class="leader-meta">${escapeHtml(meta1)}</span>` : ''}
          ${meta2 ? `<span class="leader-meta-sep">·</span><span class="leader-meta">${escapeHtml(meta2)}</span>` : ''}
        </div>
      </div>
      <span class="leader-value" style="color:${valColor}; font-size:${isTop ? '22px' : '16px'}">${value}</span>
    </${tag}>
  `;
}

// ─── Stat card wrapper ──────────────────────────────────────────────────
export function renderStatCard(label, color, leaders, count = 10) {
  if (!leaders || !leaders.length) return renderEmptyStatCard(label, color);
  return `
    <div class="leader-card">
      <div class="leader-card-head" style="border-color:${color}33">
        <span class="leader-card-stat" style="color:${color}">${label}</span>
        <span class="leader-card-meta">Top ${Math.min(count, leaders.length)}</span>
      </div>
      ${leaders.slice(0, count).map((row) => row).join('')}
    </div>
  `;
}

// ─── Compute helpers ────────────────────────────────────────────────────

// MLB BABIP = (H - HR) / (AB - K - HR + SF)
export function computeBABIP(stat) {
  const h = +stat.hits || 0;
  const hr = +stat.homeRuns || 0;
  const ab = +stat.atBats || 0;
  const k = +stat.strikeOuts || 0;
  const sf = +stat.sacFlies || 0;
  const denom = ab - k - hr + sf;
  if (denom <= 0) return null;
  return (h - hr) / denom;
}

// MLB ISO = SLG - AVG (raw power isolation)
export function computeISO(stat) {
  const slg = parseFloat(stat.slg);
  const avg = parseFloat(stat.avg);
  if (isNaN(slg) || isNaN(avg)) return null;
  return slg - avg;
}

// MLB K% = K / PA
export function computeKPct(stat) {
  const k = +stat.strikeOuts || 0;
  const pa = +stat.plateAppearances || 0;
  if (pa <= 0) return null;
  return k / pa;
}

// MLB BB% = BB / PA
export function computeBBPct(stat) {
  const bb = +stat.baseOnBalls || 0;
  const pa = +stat.plateAppearances || 0;
  if (pa <= 0) return null;
  return bb / pa;
}

// NBA TS% = PTS / (2 * (FGA + 0.44 * FTA))
export function computeTSPct(stat) {
  const pts = +stat.avgPoints || +stat.points || 0;
  const fga = +stat.avgFieldGoalsAttempted || +stat.fieldGoalsAttempted || 0;
  const fta = +stat.avgFreeThrowsAttempted || +stat.freeThrowsAttempted || 0;
  const denom = 2 * (fga + 0.44 * fta);
  if (denom <= 0) return null;
  return pts / denom;
}

// NBA eFG% = (FGM + 0.5 * 3PM) / FGA
export function computeEFGPct(stat) {
  const fgm = +stat.avgFieldGoalsMade || +stat.fieldGoalsMade || 0;
  const tpm = +stat.avgThreePointFieldGoalsMade || +stat.threePointFieldGoalsMade || 0;
  const fga = +stat.avgFieldGoalsAttempted || +stat.fieldGoalsAttempted || 0;
  if (fga <= 0) return null;
  return (fgm + 0.5 * tpm) / fga;
}

// NHL Shooting % = G / SOG
export function computeNhlShPct(stat) {
  const g = +stat.goals || 0;
  const sog = +stat.shots || +stat.shotsOnGoal || 0;
  if (sog <= 0) return null;
  return g / sog;
}

// NHL Points per 60 = (P / TOI_min) * 60
export function computeNhlP60(stat) {
  const pts = +stat.points || 0;
  const toi = +stat.timeOnIcePerGame || +stat.toi || 0;
  if (toi <= 0) return null;
  return (pts / toi) * 60;
}

// ─── Loading state ──────────────────────────────────────────────────────
export function renderLeaderLoading() {
  return `<div class="games-loading">
    <div class="games-loading-dot"></div>
    <div class="games-loading-dot"></div>
    <div class="games-loading-dot"></div>
  </div>`;
}

// ─── Helpers ────────────────────────────────────────────────────────────
export function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
export function escapeAttr(s) { return escapeHtml(s); }

export function fmtAvg(v) { return parseFloat(v).toFixed(3).replace(/^0/, ''); }
export function fmtPct(v, decimals = 1) { return (parseFloat(v) * 100).toFixed(decimals) + '%'; }
export function fmtDec(v, decimals = 2) { return parseFloat(v).toFixed(decimals); }
export function fmtInt(v) { return parseInt(v) || 0; }
