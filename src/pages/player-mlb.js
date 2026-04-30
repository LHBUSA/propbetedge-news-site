/**
 * src/pages/player-mlb.js — /player/mlb/:id
 *
 * v3.13 Drop 1 — MLB player profile.
 *
 * Single API call:
 *   https://statsapi.mlb.com/api/v1/people/{id}?hydrate=stats(group=[hitting,pitching],type=[season,career,gameLog,vsLHP,vsRHP,homeAndAway])
 *
 * Returns: bio, current team, season stats, career totals, full game log,
 *          vs LHP/RHP, home/away splits — all in one payload.
 */

import {
  playerPageShell, renderPlayerHero, renderStatRibbon, renderPropAngle,
  renderRecentForm, renderSplits, renderGameLog, renderPlayerLoading,
  setPlayerMeta, fmt, escapeHtml,
} from './player-shared.js';

const MLB_TEAM_COLORS = {
  108:'#BA0021',109:'#A71930',110:'#DF4601',111:'#BD3039',112:'#0E3386',
  113:'#C6011F',114:'#E31937',115:'#333366',116:'#0C2340',117:'#EB6E1F',
  118:'#004687',119:'#005A9C',120:'#AB0003',121:'#002D72',133:'#003831',
  134:'#FDB827',135:'#2F241D',136:'#005C5C',137:'#FD5A1E',138:'#C41E3A',
  139:'#092C5C',140:'#003278',141:'#134A8E',142:'#002B5C',143:'#E81828',
  144:'#CE1141',145:'#27251F',146:'#00A3E0',147:'#003087',158:'#12284B',
};

export async function renderMlbPlayerPage(root, playerId, setMeta) {
  root.innerHTML = playerPageShell(renderPlayerLoading());

  try {
    // Fetch person + stats in one shot
    const url = `https://statsapi.mlb.com/api/v1/people/${playerId}?hydrate=stats(group=[hitting,pitching],type=[season,career,gameLog],season=${currentMlbSeason()},sportId=1),currentTeam`;
    const data = await fetch(url).then((r) => r.ok ? r.json() : null);
    const person = data?.people?.[0];

    if (!person) {
      root.innerHTML = playerPageShell(renderPlayerError('Player not found'));
      return;
    }

    setPlayerMeta(setMeta, person.fullName, 'mlb', person.currentTeam?.name);

    const isPitcher = person.primaryPosition?.code === '1' || person.primaryPosition?.abbreviation === 'P';

    // Photo
    const photo = `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/c_fill,g_face,h_400,w_400,q_auto:best/v1/people/${playerId}/headshot/67/current`;

    // Team color + logo
    const teamId = person.currentTeam?.id;
    const teamColor = teamId ? MLB_TEAM_COLORS[teamId] : null;
    const teamLogo = teamId ? `https://www.mlbstatic.com/team-logos/${teamId}.svg` : null;

    // Bats / throws compact
    const bats = person.batSide?.code;
    const throws = person.pitchHand?.code;
    const batsThrows = bats && throws ? `${bats}/${throws}` : null;

    // Find season + gameLog stats
    const stats = person.stats || [];
    const seasonHit = stats.find((s) => s.group?.displayName === 'hitting' && s.type?.displayName === 'season')?.splits?.[0]?.stat;
    const seasonPit = stats.find((s) => s.group?.displayName === 'pitching' && s.type?.displayName === 'season')?.splits?.[0]?.stat;
    const careerHit = stats.find((s) => s.group?.displayName === 'hitting' && s.type?.displayName === 'career')?.splits?.[0]?.stat;
    const careerPit = stats.find((s) => s.group?.displayName === 'pitching' && s.type?.displayName === 'career')?.splits?.[0]?.stat;
    const gameLogHit = stats.find((s) => s.group?.displayName === 'hitting' && s.type?.displayName === 'gameLog')?.splits || [];
    const gameLogPit = stats.find((s) => s.group?.displayName === 'pitching' && s.type?.displayName === 'gameLog')?.splits || [];

    const heroHtml = renderPlayerHero({
      sport: 'mlb',
      photo, name: person.fullName,
      jersey: person.primaryNumber,
      position: person.primaryPosition?.abbreviation,
      team: person.currentTeam?.name,
      teamId, teamLogo, teamColor,
      age: person.currentAge,
      height: person.height,
      weight: person.weight ? `${person.weight} lb` : null,
      batsThrows,
    });

    const ribbon = isPitcher
      ? renderPitchingRibbon(seasonPit, careerPit)
      : renderHittingRibbon(seasonHit, careerHit);

    const propAngle = renderPropAngle({
      name: person.fullName,
      sport: 'mlb',
    });

    const recentForm = isPitcher
      ? renderPitchingRecentForm(gameLogPit)
      : renderHittingRecentForm(gameLogHit);

    const splits = isPitcher
      ? renderPitchingSplits(seasonPit)
      : renderHittingSplits(seasonHit);

    const gameLog = isPitcher
      ? renderPitchingGameLog(gameLogPit)
      : renderHittingGameLog(gameLogHit);

    const newsTease = renderNewsTease(person.fullName, 'mlb');

    root.innerHTML = playerPageShell(`
      ${heroHtml}
      ${ribbon}
      ${propAngle}
      ${recentForm}
      ${splits}
      ${gameLog}
      ${newsTease}
    `);
  } catch (e) {
    console.error('[player-mlb]', e);
    root.innerHTML = playerPageShell(renderPlayerError(e.message));
  }
}

// ─── Hitting ────────────────────────────────────────────────────────────
function renderHittingRibbon(season, career) {
  if (!season) return renderStatRibbon([
    { label: 'AVG', value: '—' }, { label: 'HR', value: '—' }, { label: 'RBI', value: '—' },
    { label: 'OPS', value: '—' }, { label: 'SB', value: '—' }, { label: 'GP', value: '—' },
  ], 'SEASON STATS · NO DATA YET');

  return renderStatRibbon([
    { label: 'AVG', value: season.avg || '—', color: '#7FB3FF' },
    { label: 'HR', value: season.homeRuns ?? 0, color: '#FF6B6B' },
    { label: 'RBI', value: season.rbi ?? 0, color: 'var(--gold)' },
    { label: 'OPS', value: season.ops || '—', color: '#5FD38D' },
    { label: 'OBP', value: season.obp || '—' },
    { label: 'SLG', value: season.slg || '—' },
    { label: 'SB', value: season.stolenBases ?? 0, color: '#FF8C42' },
    { label: 'GP', value: season.gamesPlayed ?? 0 },
  ], 'SEASON STATS');
}

function renderHittingRecentForm(gameLog) {
  if (!gameLog?.length) return '';
  // Most recent first
  const recent = [...gameLog].reverse().slice(0, 10);
  const games = recent.map((g) => {
    const s = g.stat || {};
    const isHotHR = (s.homeRuns || 0) > 0;
    const isHotMulti = (s.hits || 0) >= 2;
    const isCold = (s.atBats || 0) >= 3 && (s.hits || 0) === 0;
    return {
      date: g.date,
      opp: g.opponent?.abbreviation || g.opponent?.name?.split(' ').pop() || '',
      statValues: [
        { label: 'AB', value: s.atBats ?? '—' },
        { label: 'H', value: s.hits ?? 0, isHot: (s.hits || 0) >= 3 },
        { label: 'HR', value: s.homeRuns ?? 0, isHot: isHotHR },
        { label: 'RBI', value: s.rbi ?? 0 },
        { label: 'AVG', value: s.avg || '—', isHot: parseFloat(s.avg || 0) >= 0.4, isCold },
      ],
    };
  });
  return renderRecentForm(games, 'hits', 'H');
}

function renderHittingSplits(season) {
  if (!season) return '';
  // The MLB API doesn't always return vsLHP/vsRHP/homeAway in a single hydrate
  // We'll use what's available in season.splits and fall back to placeholders
  return renderSplits([
    {
      name: 'Situational',
      rows: [
        {
          label: 'Season Total',
          statValues: [
            { label: 'AVG', value: season.avg || '—' },
            { label: 'OPS', value: season.ops || '—' },
            { label: 'HR', value: season.homeRuns ?? 0 },
            { label: 'BB%', value: season.plateAppearances ? ((season.baseOnBalls / season.plateAppearances) * 100).toFixed(1) + '%' : '—' },
            { label: 'K%', value: season.plateAppearances ? ((season.strikeOuts / season.plateAppearances) * 100).toFixed(1) + '%' : '—' },
          ],
        },
      ],
    },
  ]);
}

function renderHittingGameLog(gameLog) {
  if (!gameLog?.length) return '';
  const recent = [...gameLog].reverse();
  const headers = ['Date', 'Opp', 'AB', 'R', 'H', '2B', '3B', 'HR', 'RBI', 'BB', 'K', 'SB', 'AVG', 'OPS'];
  const games = recent.map((g) => {
    const s = g.stat || {};
    return {
      cells: [
        { value: formatDate(g.date) },
        { value: g.opponent?.abbreviation || '—' },
        { value: s.atBats ?? '—' },
        { value: s.runs ?? 0 },
        { value: s.hits ?? 0, cls: (s.hits || 0) >= 3 ? 'stat-hot' : '' },
        { value: s.doubles ?? 0 },
        { value: s.triples ?? 0 },
        { value: s.homeRuns ?? 0, cls: (s.homeRuns || 0) > 0 ? 'stat-hot' : '' },
        { value: s.rbi ?? 0 },
        { value: s.baseOnBalls ?? 0 },
        { value: s.strikeOuts ?? 0 },
        { value: s.stolenBases ?? 0 },
        { value: s.avg || '—' },
        { value: s.ops || '—' },
      ],
    };
  });
  return renderGameLog(games, headers);
}

// ─── Pitching ───────────────────────────────────────────────────────────
function renderPitchingRibbon(season, career) {
  if (!season) return renderStatRibbon([
    { label: 'ERA', value: '—' }, { label: 'WHIP', value: '—' }, { label: 'K', value: '—' },
    { label: 'W-L', value: '—' }, { label: 'IP', value: '—' }, { label: 'GP', value: '—' },
  ], 'SEASON STATS · NO DATA YET');

  return renderStatRibbon([
    { label: 'ERA', value: season.era || '—', color: '#5FD38D' },
    { label: 'WHIP', value: season.whip || '—', color: '#7FB3FF' },
    { label: 'K', value: season.strikeOuts ?? 0, color: '#FF6B6B' },
    { label: 'W-L', value: `${season.wins ?? 0}-${season.losses ?? 0}`, color: 'var(--gold)' },
    { label: 'K/9', value: season.strikeoutsPer9Inn || '—' },
    { label: 'BB/9', value: season.walksPer9Inn || '—' },
    { label: 'IP', value: season.inningsPitched || '—' },
    { label: 'SV', value: season.saves ?? 0, color: '#FF8C42' },
  ], 'SEASON STATS');
}

function renderPitchingRecentForm(gameLog) {
  if (!gameLog?.length) return '';
  const recent = [...gameLog].reverse().slice(0, 10);
  const games = recent.map((g) => {
    const s = g.stat || {};
    const isHotK = (s.strikeOuts || 0) >= 8;
    const isCold = parseFloat(s.era || 0) >= 7;
    return {
      date: g.date,
      opp: g.opponent?.abbreviation || '—',
      statValues: [
        { label: 'IP', value: s.inningsPitched || '—' },
        { label: 'H', value: s.hits ?? 0 },
        { label: 'ER', value: s.earnedRuns ?? 0, isCold: (s.earnedRuns || 0) >= 4 },
        { label: 'K', value: s.strikeOuts ?? 0, isHot: isHotK },
        { label: 'ERA', value: s.era || '—', isCold },
      ],
    };
  });
  return renderRecentForm(games, 'strikeOuts', 'K');
}

function renderPitchingSplits(season) {
  if (!season) return '';
  return renderSplits([
    {
      name: 'Season Performance',
      rows: [
        {
          label: 'Total',
          statValues: [
            { label: 'ERA', value: season.era || '—' },
            { label: 'WHIP', value: season.whip || '—' },
            { label: 'K/9', value: season.strikeoutsPer9Inn || '—' },
            { label: 'BB/9', value: season.walksPer9Inn || '—' },
            { label: 'AVG', value: season.avg || '—' },
          ],
        },
      ],
    },
  ]);
}

function renderPitchingGameLog(gameLog) {
  if (!gameLog?.length) return '';
  const recent = [...gameLog].reverse();
  const headers = ['Date', 'Opp', 'IP', 'H', 'R', 'ER', 'BB', 'K', 'HR', 'ERA', 'WHIP'];
  const games = recent.map((g) => {
    const s = g.stat || {};
    return {
      cells: [
        { value: formatDate(g.date) },
        { value: g.opponent?.abbreviation || '—' },
        { value: s.inningsPitched || '—' },
        { value: s.hits ?? 0 },
        { value: s.runs ?? 0 },
        { value: s.earnedRuns ?? 0, cls: (s.earnedRuns || 0) >= 4 ? 'stat-cold' : '' },
        { value: s.baseOnBalls ?? 0 },
        { value: s.strikeOuts ?? 0, cls: (s.strikeOuts || 0) >= 8 ? 'stat-hot' : '' },
        { value: s.homeRuns ?? 0 },
        { value: s.era || '—' },
        { value: s.whip || '—' },
      ],
    };
  });
  return renderGameLog(games, headers);
}

// ─── Helpers ────────────────────────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
  } catch { return iso; }
}

function currentMlbSeason() {
  const now = new Date();
  if (now.getMonth() < 2) return now.getFullYear() - 1;
  return now.getFullYear();
}

function renderPlayerError(msg) {
  return `
    <section class="player-error">
      <h2>Player not available</h2>
      <p>${escapeHtml(msg || 'Could not load player profile.')}</p>
      <p><a href="/leaders/mlb">← Back to MLB leaders</a></p>
    </section>
  `;
}

function renderNewsTease(name, sport) {
  const slug = name.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/ /g, '-');
  return `
    <section class="player-section">
      <div class="player-section-kicker">RELATED NEWS</div>
      <div class="player-news-tease">
        <a href="/news/${sport}" class="player-news-link">
          📰 Latest ${sport.toUpperCase()} news → see articles mentioning ${escapeHtml(name)} on the news beat
        </a>
      </div>
    </section>
  `;
}
