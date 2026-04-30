/**
 * src/pages/games-hub.js — /games
 * Multi-sport live scoreboard, free public layer.
 *
 * v4.0 — VISUAL UPGRADE
 *   - Self-contained styles injected inline (drop-in, no CSS file changes)
 *   - Sport-tinted accent system (MLB red / NBA orange / NHL cyan / NFL purple)
 *   - Animated mesh gradient hero with gradient text title
 *   - Glassmorphism cards with sport-specific top accent bar
 *   - Live cards: animated glowing border + pulsing live dots
 *   - Final cards: gold-accent winner row
 *   - Stagger card entrance, hover lift, polished tab pill
 *   - Mobile responsive
 *
 * v3.11 (preserved):
 *   - Stat Leaders compact teaser (renderLeadersTeaserSlot + loadLeadersTeaser)
 *   - Teaser updates when sport tab changes; hidden on "All" and "NFL"
 *
 * Powered by PropSports API (propsports.proptechusa.ai)
 */

import { sports } from '../api-sports.js';
import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { renderLeadersTeaserSlot, loadLeadersTeaser } from '../components/leaders-teaser.js';

// ─── Visual Upgrade Styles ────────────────────────────────────────────────
function getEnhancedStyles() {
  return `
<style id="games-hub-v4-styles">
/* === Games Hub v4 — Visual Upgrade ============================== */
:root {
  --gh-surface: rgba(255,255,255,0.03);
  --gh-surface-2: rgba(255,255,255,0.05);
  --gh-border: rgba(255,255,255,0.08);
  --gh-border-strong: rgba(255,255,255,0.16);
  --gh-text: #f5f5f7;
  --gh-text-dim: rgba(245,245,247,0.62);
  --gh-text-faint: rgba(245,245,247,0.4);
  --gh-gold: var(--gold, #d4af37);
  --gh-live: #ef4444;
  --gh-live-soft: rgba(239,68,68,0.15);

  --gh-mlb: #ef4444; --gh-mlb-2: #b91c1c;
  --gh-nba: #f97316; --gh-nba-2: #c2410c;
  --gh-nhl: #06b6d4; --gh-nhl-2: #0e7490;
  --gh-nfl: #8b5cf6; --gh-nfl-2: #6d28d9;
}

/* ── Hero ───────────────────────────────────────────────────────── */
.games-hero {
  position: relative;
  border-radius: 24px;
  overflow: hidden;
  padding: 56px 40px 48px;
  margin: 24px 0 32px;
  background: linear-gradient(135deg, #0c0c14 0%, #1a1a2e 100%);
  border: 1px solid var(--gh-border);
}
.games-hero-mesh {
  position: absolute; inset: 0; pointer-events: none;
  background:
    radial-gradient(60% 80% at 18% 0%,  rgba(239,68,68,0.20), transparent 60%),
    radial-gradient(50% 70% at 82% 100%, rgba(139,92,246,0.18), transparent 60%),
    radial-gradient(40% 60% at 50% 50%, rgba(212,175,55,0.10), transparent 60%);
  animation: gh-mesh 18s ease-in-out infinite alternate;
}
@keyframes gh-mesh {
  0%   { transform: translate(0,0) scale(1); }
  100% { transform: translate(24px,-12px) scale(1.06); }
}
.games-hero-inner { position: relative; z-index: 1; }

.games-hero-kicker {
  display: inline-flex; align-items: center; gap: 10px;
  padding: 8px 16px; border-radius: 999px;
  background: rgba(239,68,68,0.12);
  border: 1px solid rgba(239,68,68,0.32);
  color: #fca5a5;
  font-size: 11px; font-weight: 700; letter-spacing: 0.1em;
  margin-bottom: 22px; text-transform: uppercase;
}

.games-hero-title {
  font-size: clamp(40px, 6vw, 72px);
  font-weight: 800; line-height: 1; letter-spacing: -0.03em;
  margin: 0 0 16px;
  background: linear-gradient(135deg, #fff 0%, #fff 55%, var(--gh-gold) 100%);
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent;
}
.games-hero-dek {
  font-size: 18px; color: var(--gh-text-dim);
  max-width: 640px; margin: 0 0 32px; line-height: 1.5;
}

.games-hero-counts {
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: 14px; max-width: 720px;
}
.games-hero-stat {
  padding: 18px 22px; border-radius: 14px;
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--gh-border);
  backdrop-filter: blur(10px);
  transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease;
}
.games-hero-stat:hover {
  border-color: var(--gh-border-strong);
  background: rgba(255,255,255,0.06);
  transform: translateY(-2px);
}
.games-hero-stat-num {
  font-size: 34px; font-weight: 800; line-height: 1;
  font-variant-numeric: tabular-nums;
  margin-bottom: 6px; color: var(--gh-text);
  letter-spacing: -0.02em;
}
.games-hero-stat-num.live {
  color: var(--gh-live);
  text-shadow: 0 0 24px rgba(239,68,68,0.5);
}
.games-hero-stat-lbl {
  font-size: 11px; font-weight: 600;
  letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--gh-text-faint);
}

/* ── Live dots ──────────────────────────────────────────────────── */
.live-dot, .live-dot-big {
  display: inline-block; background: var(--gh-live);
  border-radius: 50%; position: relative; flex-shrink: 0;
}
.live-dot { width: 8px; height: 8px; }
.live-dot-big { width: 10px; height: 10px; }
.live-dot::after, .live-dot-big::after {
  content: ''; position: absolute; inset: -4px;
  border-radius: 50%; background: var(--gh-live); opacity: 0.5;
  animation: gh-pulse 1.6s ease-out infinite;
}
@keyframes gh-pulse {
  0%   { transform: scale(0.8); opacity: 0.5; }
  100% { transform: scale(2.4); opacity: 0; }
}

/* ── Tabs ───────────────────────────────────────────────────────── */
.games-tabs {
  display: flex; gap: 6px;
  margin: 32px 0 24px;
  flex-wrap: wrap; padding: 6px;
  background: rgba(255,255,255,0.03);
  border: 1px solid var(--gh-border);
  border-radius: 14px;
  backdrop-filter: blur(10px);
  width: fit-content; max-width: 100%;
}
.games-tab {
  padding: 10px 18px;
  background: transparent;
  border: 1px solid transparent;
  color: var(--gh-text-dim);
  font-size: 14px; font-weight: 600;
  border-radius: 10px; cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}
.games-tab:hover {
  color: var(--gh-text);
  background: rgba(255,255,255,0.05);
}
.games-tab.active {
  background: linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04));
  border-color: var(--gh-border-strong);
  color: var(--gh-text);
  box-shadow:
    0 1px 0 rgba(255,255,255,0.1) inset,
    0 8px 24px rgba(0,0,0,0.25);
}

/* ── Sections ───────────────────────────────────────────────────── */
.games-section { margin-bottom: 40px; }
.games-section-head { margin-bottom: 20px; }
.games-section-head h2 {
  display: flex; align-items: center; gap: 12px;
  font-size: 22px; font-weight: 700;
  letter-spacing: -0.01em; color: var(--gh-text);
  margin: 0;
}
.games-count {
  font-size: 12px; font-weight: 700;
  padding: 3px 10px; border-radius: 999px;
  background: rgba(255,255,255,0.06);
  border: 1px solid var(--gh-border);
  color: var(--gh-text-dim);
}

/* ── Game grid + cards ──────────────────────────────────────────── */
.games-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 16px;
}
.games-grid > .game-card {
  animation: gh-enter 0.4s ease-out backwards;
}
.games-grid > .game-card:nth-child(1)  { animation-delay: 0.02s; }
.games-grid > .game-card:nth-child(2)  { animation-delay: 0.05s; }
.games-grid > .game-card:nth-child(3)  { animation-delay: 0.08s; }
.games-grid > .game-card:nth-child(4)  { animation-delay: 0.11s; }
.games-grid > .game-card:nth-child(5)  { animation-delay: 0.14s; }
.games-grid > .game-card:nth-child(6)  { animation-delay: 0.17s; }
.games-grid > .game-card:nth-child(7)  { animation-delay: 0.20s; }
.games-grid > .game-card:nth-child(8)  { animation-delay: 0.23s; }
.games-grid > .game-card:nth-child(9)  { animation-delay: 0.26s; }
.games-grid > .game-card:nth-child(10) { animation-delay: 0.29s; }
@keyframes gh-enter {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}

.game-card {
  position: relative;
  display: block;
  padding: 18px 20px 16px;
  background: linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%);
  border: 1px solid var(--gh-border);
  border-radius: 16px;
  text-decoration: none; color: inherit;
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  overflow: hidden;
}

/* Sport accent bar (top edge) */
.game-card::before {
  content: ''; position: absolute;
  top: 0; left: 0; right: 0; height: 2px;
  opacity: 0.85;
}
.game-card.sport-mlb::before { background: linear-gradient(90deg, var(--gh-mlb), var(--gh-mlb-2)); }
.game-card.sport-nba::before { background: linear-gradient(90deg, var(--gh-nba), var(--gh-nba-2)); }
.game-card.sport-nhl::before { background: linear-gradient(90deg, var(--gh-nhl), var(--gh-nhl-2)); }
.game-card.sport-nfl::before { background: linear-gradient(90deg, var(--gh-nfl), var(--gh-nfl-2)); }

/* Hover (sport-tinted glow) */
a.game-card { cursor: pointer; }
a.game-card:hover {
  transform: translateY(-3px);
  border-color: var(--gh-border-strong);
}
a.game-card.sport-mlb:hover { box-shadow: 0 12px 32px rgba(239,68,68,0.18); }
a.game-card.sport-nba:hover { box-shadow: 0 12px 32px rgba(249,115,22,0.18); }
a.game-card.sport-nhl:hover { box-shadow: 0 12px 32px rgba(6,182,212,0.18); }
a.game-card.sport-nfl:hover { box-shadow: 0 12px 32px rgba(139,92,246,0.18); }

/* Live cards: glowing animated border */
.game-card.live {
  border-color: rgba(239,68,68,0.35);
  background: linear-gradient(180deg, rgba(239,68,68,0.06) 0%, rgba(255,255,255,0.02) 100%);
  animation: gh-live-glow 2.5s ease-in-out infinite;
}
@keyframes gh-live-glow {
  0%, 100% { box-shadow: 0 0 0 1px rgba(239,68,68,0.15), 0 0 24px rgba(239,68,68,0.10); }
  50%      { box-shadow: 0 0 0 1px rgba(239,68,68,0.4),  0 0 38px rgba(239,68,68,0.25); }
}

/* Card head */
.game-card-head {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 14px;
  font-size: 11px; font-weight: 700; letter-spacing: 0.05em;
  position: relative; z-index: 1;
}
.game-sport-tag {
  color: var(--gh-text-faint);
  text-transform: uppercase;
}
.game-status {
  color: var(--gh-text-dim);
  text-transform: uppercase;
  display: inline-flex; align-items: center; gap: 6px;
}
.game-status.live { color: var(--gh-live); font-weight: 800; }

/* Teams */
.game-teams { display: flex; flex-direction: column; }
.game-team {
  display: grid;
  grid-template-columns: 36px 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  position: relative;
}
.game-team + .game-team::before {
  content: '';
  position: absolute;
  top: 0; left: 48px; right: 0;
  height: 1px;
  background: var(--gh-border);
}
.game-team-logo {
  width: 36px; height: 36px;
  object-fit: contain;
  filter: drop-shadow(0 2px 8px rgba(0,0,0,0.35));
}
.game-team-logo-fallback {
  width: 36px; height: 36px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 8px;
  background: rgba(255,255,255,0.06);
  border: 1px solid var(--gh-border);
  font-size: 10px; font-weight: 800;
  color: var(--gh-text-dim);
  letter-spacing: 0.04em;
}
.game-team-meta { min-width: 0; }
.game-team-name {
  font-size: 15px; font-weight: 600;
  color: var(--gh-text);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.game-team-record {
  font-size: 11px;
  color: var(--gh-text-faint);
  font-variant-numeric: tabular-nums;
  margin-top: 2px;
}
.game-team-score {
  font-size: 26px; font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: var(--gh-text-dim);
  min-width: 38px; text-align: right;
  letter-spacing: -0.02em;
  line-height: 1;
}
.game-card.live .game-team-score { color: var(--gh-text); }
.game-team.winner .game-team-score { color: var(--gh-gold); }
.game-team.winner .game-team-name  { color: var(--gh-text); font-weight: 700; }

/* Card foot */
.game-card-foot {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--gh-border);
  font-size: 12px;
  color: var(--gh-text-faint);
}
.game-card-cta {
  margin-top: 12px;
  font-size: 11px; font-weight: 700;
  letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--gh-gold);
  opacity: 0.7;
  transition: opacity 0.15s ease, transform 0.15s ease;
}
a.game-card:hover .game-card-cta {
  opacity: 1;
  transform: translateX(2px);
}

/* ── Edge strip ─────────────────────────────────────────────────── */
.games-edge-strip {
  margin: 48px 0 32px;
  padding: 32px;
  background: linear-gradient(135deg, rgba(212,175,55,0.06) 0%, rgba(255,255,255,0.02) 100%);
  border: 1px solid var(--gh-border);
  border-radius: 20px;
  position: relative;
  overflow: hidden;
}
.games-edge-strip::before {
  content: '';
  position: absolute; top: 0; left: 0; right: 0; height: 1px;
  background: linear-gradient(90deg, transparent, var(--gh-gold), transparent);
  opacity: 0.5;
}
.games-edge-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 20px;
}
.games-edge-cell {
  padding: 24px;
  background: rgba(0,0,0,0.32);
  border: 1px solid var(--gh-border);
  border-radius: 14px;
  transition: all 0.2s ease;
}
.games-edge-cell:hover {
  border-color: rgba(212,175,55,0.35);
  background: rgba(212,175,55,0.04);
  transform: translateY(-2px);
}
.games-edge-icon { font-size: 28px; margin-bottom: 12px; line-height: 1; }
.games-edge-title {
  font-size: 16px; font-weight: 700;
  color: var(--gh-text); margin-bottom: 6px;
}
.games-edge-dek {
  font-size: 13px; color: var(--gh-text-dim);
  line-height: 1.5; margin-bottom: 16px;
}
.games-edge-cta {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 9px 16px;
  background: linear-gradient(135deg, var(--gh-gold), #b8941f);
  color: #1a1a1a;
  font-size: 12px; font-weight: 800;
  text-decoration: none; border-radius: 8px;
  letter-spacing: 0.04em; text-transform: uppercase;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.games-edge-cta:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(212,175,55,0.35);
}

/* ── Empty + loading ───────────────────────────────────────────── */
.games-empty {
  padding: 60px 24px;
  text-align: center;
  background: var(--gh-surface);
  border: 1px solid var(--gh-border);
  border-radius: 16px;
}
.games-empty h3 {
  font-size: 20px; margin: 0 0 8px;
  color: var(--gh-text); font-weight: 700;
}
.games-empty p { color: var(--gh-text-dim); margin: 0; }

.games-loading {
  display: flex; justify-content: center; align-items: center;
  gap: 8px; padding: 80px 0;
}
.games-loading-dot {
  width: 12px; height: 12px;
  border-radius: 50%;
  background: var(--gh-gold);
  animation: gh-bounce 1.4s ease-in-out infinite;
}
.games-loading-dot:nth-child(2) { animation-delay: 0.2s; }
.games-loading-dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes gh-bounce {
  0%, 80%, 100% { transform: scale(0.5); opacity: 0.4; }
  40%           { transform: scale(1);   opacity: 1; }
}

/* ── Mobile ─────────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .games-hero { padding: 36px 24px 32px; border-radius: 18px; }
  .games-hero-counts { grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .games-hero-stat { padding: 14px 16px; }
  .games-hero-stat-num { font-size: 28px; }
  .games-grid { grid-template-columns: 1fr; }
  .games-tabs { width: 100%; overflow-x: auto; }
  .games-tab { padding: 9px 14px; font-size: 13px; }
  .games-edge-strip { padding: 24px 18px; }
}
@media (prefers-reduced-motion: reduce) {
  .games-hero-mesh, .live-dot::after, .live-dot-big::after,
  .game-card.live, .games-loading-dot, .games-grid > .game-card {
    animation: none !important;
  }
}
</style>
  `;
}

// ─── Main render ──────────────────────────────────────────────────────────
export async function renderGamesHub(root) {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  root.innerHTML = `
    ${renderHeader()}
    ${getEnhancedStyles()}
    <main>
      <div class="container">

        <!-- Hero -->
        <section class="games-hero">
          <div class="games-hero-mesh"></div>
          <div class="games-hero-inner">
            <div class="games-hero-kicker">
              <span class="live-dot-big"></span>
              <span>LIVE GAMES · ${today}</span>
            </div>
            <h1 class="games-hero-title">Today's Action</h1>
            <p class="games-hero-dek">
              MLB · NBA · NHL · NFL — every score, every game, every night.
              Powered by <strong style="color:var(--gh-gold)">PropSports API</strong>.
            </p>
            <div id="games-hero-counts" class="games-hero-counts"></div>
          </div>
        </section>

        <!-- Sport tabs -->
        <div class="games-tabs">
          <button class="games-tab active" data-sport="all">All Sports</button>
          <button class="games-tab" data-sport="mlb">⚾ MLB</button>
          <button class="games-tab" data-sport="nba">🏀 NBA</button>
          <button class="games-tab" data-sport="nhl">🏒 NHL</button>
          <button class="games-tab" data-sport="nfl">🏈 NFL</button>
        </div>

        <!-- Live + Final + Upcoming -->
        <div id="games-content" class="games-content">
          <div class="games-loading">
            <div class="games-loading-dot"></div>
            <div class="games-loading-dot"></div>
            <div class="games-loading-dot"></div>
          </div>
        </div>

        <!-- Compact Stat Leaders teaser (sport-aware, hidden on "All" + "NFL") -->
        ${renderLeadersTeaserSlot()}

        <!-- PropBetEdge angle / API plug -->
        <section class="games-edge-strip">
          <div class="games-edge-grid">
            <div class="games-edge-cell">
              <div class="games-edge-icon">🎯</div>
              <div class="games-edge-title">PropBetEdge Picks</div>
              <div class="games-edge-dek">Daily AI-scored prop picks across MLB, NBA, NHL, NFL.</div>
              <a href="https://mlb.propbetedge.ai" class="games-edge-cta">See picks →</a>
            </div>
            <div class="games-edge-cell">
              <div class="games-edge-icon">📡</div>
              <div class="games-edge-title">PropSports API</div>
              <div class="games-edge-dek">47 endpoints. 4 sports. Live scoreboards, box scores, Statcast, model odds. Free demo key.</div>
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
      </div>
    </main>
    ${renderFooter()}
  `;

  // Fetch all 4 sports in parallel
  const data = await sports.allTodayScoreboards().catch((e) => {
    console.error('[games-hub]', e);
    return { mlb: { games: [] }, nba: { games: [] }, nhl: { games: [] }, nfl: { games: [] } };
  });

  // Normalize each sport's games into a common format
  const all = [
    ...normalizeMLB(data.mlb.games || []),
    ...normalizeNBA(data.nba.games || []),
    ...normalizeNHL(data.nhl.games || []),
    ...normalizeNFL(data.nfl.games || []),
  ];

  // Render hero counts
  const live = all.filter((g) => g.state === 'live');
  const final = all.filter((g) => g.state === 'final');
  const upcoming = all.filter((g) => g.state === 'pre');

  document.getElementById('games-hero-counts').innerHTML = `
    <div class="games-hero-stat">
      <div class="games-hero-stat-num live">${live.length}</div>
      <div class="games-hero-stat-lbl">Live Now</div>
    </div>
    <div class="games-hero-stat">
      <div class="games-hero-stat-num">${upcoming.length}</div>
      <div class="games-hero-stat-lbl">Upcoming</div>
    </div>
    <div class="games-hero-stat">
      <div class="games-hero-stat-num">${final.length}</div>
      <div class="games-hero-stat-lbl">Final</div>
    </div>
    <div class="games-hero-stat">
      <div class="games-hero-stat-num">${all.length}</div>
      <div class="games-hero-stat-lbl">Total Games</div>
    </div>
  `;

  // Render the games content
  renderGamesList(all, 'all');

  // Initial leaders teaser load — default to MLB on "All" tab so something shows.
  loadLeadersTeaser('mlb');

  // Wire up tabs
  document.querySelectorAll('.games-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.games-tab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const sport = btn.dataset.sport;
      renderGamesList(all, sport);
      loadLeadersTeaser(sport === 'all' ? 'mlb' : sport);
    });
  });

  // Auto-refresh live games every 30s
  if (live.length > 0) {
    setInterval(async () => {
      try {
        const fresh = await sports.allTodayScoreboards();
        const freshAll = [
          ...normalizeMLB(fresh.mlb.games || []),
          ...normalizeNBA(fresh.nba.games || []),
          ...normalizeNHL(fresh.nhl.games || []),
          ...normalizeNFL(fresh.nfl.games || []),
        ];
        const activeTab = document.querySelector('.games-tab.active')?.dataset.sport || 'all';
        renderGamesList(freshAll, activeTab);
      } catch (e) {
        // silent — just retry next cycle
      }
    }, 30000);
  }
}

// ─── Normalizers ──────────────────────────────────────────────────────────
function normalizeMLB(games) {
  return games.map((g) => {
    const status = g.status?.abstractGameState || g.status?.detailedState || '';
    const state = status === 'Live' || status === 'In Progress' ? 'live'
                : status === 'Final' || status === 'Game Over' ? 'final'
                : 'pre';
    const ls = g.linescore || {};
    return {
      sport: 'mlb',
      sportLabel: '⚾ MLB',
      gameId: g.gamePk,
      state,
      statusText: state === 'live'
        ? `${ls.inningHalf || 'Live'} ${ls.currentInningOrdinal || ''}`
        : state === 'final' ? 'Final' : formatTime(g.gameDate),
      home: {
        name: g.teams?.home?.team?.name || '',
        abbr: g.teams?.home?.team?.abbreviation || teamAbbr(g.teams?.home?.team?.name),
        logo: g.teams?.home?.team?.id ? `https://www.mlbstatic.com/team-logos/${g.teams.home.team.id}.svg` : null,
        score: g.teams?.home?.score ?? '',
        record: g.teams?.home?.leagueRecord ? `${g.teams.home.leagueRecord.wins}-${g.teams.home.leagueRecord.losses}` : '',
      },
      away: {
        name: g.teams?.away?.team?.name || '',
        abbr: g.teams?.away?.team?.abbreviation || teamAbbr(g.teams?.away?.team?.name),
        logo: g.teams?.away?.team?.id ? `https://www.mlbstatic.com/team-logos/${g.teams.away.team.id}.svg` : null,
        score: g.teams?.away?.score ?? '',
        record: g.teams?.away?.leagueRecord ? `${g.teams.away.leagueRecord.wins}-${g.teams.away.leagueRecord.losses}` : '',
      },
      detailUrl: `/games/mlb/${g.gamePk}`,
      pitchers: g.teams ? `${g.teams.away?.probablePitcher?.fullName || 'TBD'} vs ${g.teams.home?.probablePitcher?.fullName || 'TBD'}` : null,
      gameDate: g.gameDate,
    };
  });
}

function normalizeNBA(games) {
  return games.map((g) => {
    const stateRaw = g.statusState || '';
    const state = stateRaw === 'in' ? 'live' : stateRaw === 'post' ? 'final' : 'pre';
    return {
      sport: 'nba',
      sportLabel: '🏀 NBA',
      gameId: g.id,
      state,
      statusText: state === 'live' ? `Q${g.period || ''} ${g.clock || ''}`.trim()
                : state === 'final' ? 'Final'
                : g.statusDetail || formatTime(g.date),
      home: {
        name: g.home,
        abbr: g.homeAbbr,
        logo: g.homeLogo,
        score: g.homeScore ?? '',
        record: '',
      },
      away: {
        name: g.away,
        abbr: g.awayAbbr,
        logo: g.awayLogo,
        score: g.awayScore ?? '',
        record: '',
      },
      detailUrl: `/games/nba/${g.id}`,
      gameDate: g.date,
    };
  });
}

function normalizeNHL(games) {
  return games.map((g) => {
    const state = ['LIVE', 'CRIT'].includes(g.status) ? 'live'
                : ['OFF', 'FINAL'].includes(g.status) ? 'final'
                : 'pre';
    return {
      sport: 'nhl',
      sportLabel: '🏒 NHL',
      gameId: g.id,
      state,
      statusText: state === 'live' ? 'Live'
                : state === 'final' ? 'Final'
                : formatTime(g.date),
      home: {
        name: g.home,
        abbr: teamAbbr(g.home),
        logo: null,
        score: g.homeScore ?? '',
        record: '',
      },
      away: {
        name: g.away,
        abbr: teamAbbr(g.away),
        logo: null,
        score: g.awayScore ?? '',
        record: '',
      },
      detailUrl: null,
      gameDate: g.date,
    };
  });
}

function normalizeNFL(games) {
  return games.map((g) => {
    const status = (g.status || '').toLowerCase();
    const state = status.includes('in progress') ? 'live'
                : status.includes('final') ? 'final'
                : 'pre';
    return {
      sport: 'nfl',
      sportLabel: '🏈 NFL',
      gameId: g.id,
      state,
      statusText: state === 'live' ? 'Live'
                : state === 'final' ? 'Final'
                : formatTime(g.date),
      home: {
        name: g.home,
        abbr: teamAbbr(g.home),
        logo: null,
        score: g.homeScore ?? '',
        record: '',
      },
      away: {
        name: g.away,
        abbr: teamAbbr(g.away),
        logo: null,
        score: g.awayScore ?? '',
        record: '',
      },
      detailUrl: null,
      gameDate: g.date,
    };
  });
}

function teamAbbr(name) {
  if (!name) return '';
  const parts = name.split(' ');
  return parts[parts.length - 1].slice(0, 3).toUpperCase();
}

function formatTime(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York',
    }) + ' ET';
  } catch {
    return '—';
  }
}

// ─── Renderers ────────────────────────────────────────────────────────────
function renderGamesList(all, sportFilter) {
  const filtered = sportFilter === 'all' ? all : all.filter((g) => g.sport === sportFilter);
  const live = filtered.filter((g) => g.state === 'live');
  const upcoming = filtered.filter((g) => g.state === 'pre');
  const final = filtered.filter((g) => g.state === 'final');

  const target = document.getElementById('games-content');
  if (!target) return;

  if (filtered.length === 0) {
    target.innerHTML = `
      <div class="games-empty">
        <h3>No games today</h3>
        <p>Check back tomorrow — schedule resets at midnight ET.</p>
      </div>
    `;
    return;
  }

  target.innerHTML = `
    ${live.length ? `
      <section class="games-section">
        <div class="games-section-head">
          <h2><span class="live-dot-big"></span> Live Now <span class="games-count">${live.length}</span></h2>
        </div>
        <div class="games-grid">
          ${live.map(renderGameCard).join('')}
        </div>
      </section>
    ` : ''}

    ${upcoming.length ? `
      <section class="games-section">
        <div class="games-section-head">
          <h2>⏰ Upcoming <span class="games-count">${upcoming.length}</span></h2>
        </div>
        <div class="games-grid">
          ${upcoming.map(renderGameCard).join('')}
        </div>
      </section>
    ` : ''}

    ${final.length ? `
      <section class="games-section">
        <div class="games-section-head">
          <h2>✓ Final <span class="games-count">${final.length}</span></h2>
        </div>
        <div class="games-grid">
          ${final.map(renderGameCard).join('')}
        </div>
      </section>
    ` : ''}
  `;
}

function renderGameCard(g) {
  const isLive = g.state === 'live';
  const isFinal = g.state === 'final';
  const clickable = !!g.detailUrl;
  const tag = clickable ? 'a' : 'div';
  const href = clickable ? `href="${g.detailUrl}"` : '';

  const teamRow = (team, isWinner) => `
    <div class="game-team ${isWinner ? 'winner' : ''}">
      ${team.logo
        ? `<img src="${team.logo}" alt="${team.abbr || ''}" class="game-team-logo" loading="lazy" onerror="this.style.display='none'" />`
        : `<div class="game-team-logo-fallback">${(team.abbr || '?').slice(0, 3)}</div>`}
      <div class="game-team-meta">
        <div class="game-team-name">${team.name || team.abbr || '—'}</div>
        ${team.record ? `<div class="game-team-record">${team.record}</div>` : ''}
      </div>
      <div class="game-team-score">${team.score !== '' ? team.score : ''}</div>
    </div>
  `;

  const homeWins = isFinal && parseInt(g.home.score) > parseInt(g.away.score);
  const awayWins = isFinal && parseInt(g.away.score) > parseInt(g.home.score);

  // sport-${g.sport} class drives the accent bar + hover glow color
  return `
    <${tag} ${href} class="game-card sport-${g.sport} ${isLive ? 'live' : ''} ${isFinal ? 'final' : ''}">
      <div class="game-card-head">
        <span class="game-sport-tag">${g.sportLabel}</span>
        <span class="game-status ${isLive ? 'live' : ''}">
          ${isLive ? '<span class="live-dot"></span>' : ''}
          ${g.statusText}
        </span>
      </div>
      <div class="game-teams">
        ${teamRow(g.away, awayWins)}
        ${teamRow(g.home, homeWins)}
      </div>
      ${g.pitchers ? `<div class="game-card-foot">⚾ ${g.pitchers}</div>` : ''}
      ${clickable ? '<div class="game-card-cta">View Game →</div>' : ''}
    </${tag}>
  `;
}
