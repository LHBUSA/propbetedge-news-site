/**
 * scripts/build-entity-dictionary.mjs
 *
 * Builds src/entity-graph/dictionary.js — the committed, deterministic entity
 * dictionary the PropBetEdge content graph resolves against.
 *
 * Why a committed snapshot instead of live lookups:
 *   - Article rendering must never fan out into dozens of entity API calls.
 *   - SSR (Edge Middleware) and the client must resolve *identically*. A shared
 *     static dictionary is the only way to guarantee that.
 *   - Entity ids are permanent. A roster snapshot going stale costs us a chip
 *     label, never a wrong link target.
 *
 * Sources are exactly the ones the site already depends on:
 *   teams   — ESPN site API (same source /team/:sport/:slug resolves against)
 *   mlb     — MLB StatsAPI (same source /player/mlb/:id resolves against)
 *   nfl/nba — ESPN team rosters  (same source /player/:sport/:id resolves against)
 *   nhl     — NHL api-web rosters (same source /player/nhl/:id resolves against)
 *
 * Usage:  node scripts/build-entity-dictionary.mjs [--sport=mlb,nfl,nba,nhl]
 */

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'src/entity-graph/dictionary.js');

const ESPN_PATH = {
  mlb: 'baseball/mlb',
  nfl: 'football/nfl',
  nba: 'basketball/nba',
  nhl: 'hockey/nhl',
};

const SPORTS = ['mlb', 'nfl', 'nba', 'nhl'];

const argSport = process.argv.find((a) => a.startsWith('--sport='));
const TARGET_SPORTS = argSport
  ? argSport.slice('--sport='.length).split(',').map((s) => s.trim().toLowerCase()).filter((s) => SPORTS.includes(s))
  : SPORTS;

// ─── fetch helpers ───────────────────────────────────────────────────────────

async function getJson(url, { attempts = 3 } = {}) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        headers: { accept: 'application/json', 'user-agent': 'PropBetEdge-EntityDictionary/1.0' },
      });
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return await res.json();
    } catch (error) {
      lastError = error;
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw lastError;
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      out[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return out;
}

// ─── normalization (must mirror src/entity-graph/text.js) ────────────────────

function slugifyEntity(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ─── teams ───────────────────────────────────────────────────────────────────

async function buildTeams(sport) {
  const data = await getJson(
    `https://site.api.espn.com/apis/site/v2/sports/${ESPN_PATH[sport]}/teams?limit=100`,
  );
  const raw = (data?.sports?.[0]?.leagues?.[0]?.teams || [])
    .map((entry) => entry?.team || entry)
    .filter((team) => team && team.displayName && team.id);

  const teams = raw.map((team) => {
    const logo = team.logos?.find((l) => l?.href && !/dark/i.test(String(l.rel || '')))?.href
      || team.logos?.[0]?.href
      || (team.abbreviation
        ? `https://a.espncdn.com/i/teamlogos/${sport}/500/${String(team.abbreviation).toLowerCase()}.png`
        : null);

    return {
      id: String(team.id),
      name: team.displayName,
      location: team.location || '',
      nickname: team.name || '',
      abbr: String(team.abbreviation || '').toUpperCase(),
      short: team.shortDisplayName || '',
      slug: slugifyEntity(team.displayName),
      color: team.color || '',
      logo,
    };
  });

  teams.sort((a, b) => (a.id.padStart(8, '0') < b.id.padStart(8, '0') ? -1 : 1));
  return teams;
}

// ─── players ─────────────────────────────────────────────────────────────────

async function buildMlbPlayers(teams) {
  // One authoritative call. The per-team 40-man endpoint silently omits active
  // players on the 60-day IL or added after its snapshot (it missed TJ Friedl
  // and Jake Fraley, both active); the season players index does not.
  const season = new Date().getUTCFullYear();
  const data = await getJson(`https://statsapi.mlb.com/api/v1/sports/1/players?season=${season}`);
  const people = Array.isArray(data?.people) ? data.people : [];

  // Map MLB StatsAPI team ids onto the ESPN-derived abbreviations our /team
  // slugs use, so a player chip links to the same team page the article does.
  const teamsData = await getJson('https://statsapi.mlb.com/api/v1/teams?sportId=1');
  const byName = new Map(teams.map((t) => [t.name.toLowerCase(), t.abbr]));
  const teamAbbr = new Map();
  for (const team of teamsData?.teams || []) {
    if (!team?.id || !team?.name) continue;
    const abbr = byName.get(String(team.name).toLowerCase())
      || teams.find((x) => x.nickname && String(team.name).endsWith(x.nickname))?.abbr
      || String(team.abbreviation || '').toUpperCase();
    if (abbr) teamAbbr.set(team.id, abbr);
  }

  return dedupePlayers(people.map((person) => ({
    id: String(person?.id || ''),
    name: person?.fullName || '',
    team: teamAbbr.get(person?.currentTeam?.id) || '',
    pos: person?.primaryPosition?.abbreviation || '',
  })));
}

async function buildEspnPlayers(sport, teams) {
  const rosters = await mapLimit(teams, 6, async (team) => {
    try {
      const data = await getJson(
        `https://site.api.espn.com/apis/site/v2/sports/${ESPN_PATH[sport]}/teams/${team.id}/roster`,
      );
      const groups = Array.isArray(data?.athletes) ? data.athletes : [];
      const athletes = groups.flatMap((group) => {
        if (Array.isArray(group?.items)) return group.items;
        if (Array.isArray(group?.athletes)) return group.athletes;
        return group?.fullName || group?.displayName ? [group] : [];
      });
      return athletes
        .filter((a) => a && /^\d+$/.test(String(a.id || '')))
        .map((a) => ({
          id: String(a.id),
          name: a.fullName || a.displayName || '',
          team: team.abbr,
          pos: a.position?.abbreviation || '',
        }));
    } catch {
      return [];
    }
  });

  return dedupePlayers(rosters.flat());
}

async function buildNhlPlayers(teams) {
  // NHL player pages resolve against NHL ids, so the roster must come from the
  // NHL api-web (ESPN athlete ids would produce 404 player routes).
  const standings = await getJson('https://api-web.nhle.com/v1/standings/now');
  const tricodes = [...new Set(
    (standings?.standings || [])
      .map((row) => String(row?.teamAbbrev?.default || '').toUpperCase())
      .filter(Boolean),
  )].sort();

  // Tie NHL tricodes back to the ESPN team identity our /team routes use.
  const byNickname = new Map();
  for (const team of teams) {
    if (team.nickname) byNickname.set(team.nickname.toLowerCase(), team);
    byNickname.set(team.name.toLowerCase(), team);
  }

  const rosters = await mapLimit(tricodes, 6, async (code) => {
    try {
      const data = await getJson(`https://api-web.nhle.com/v1/roster/${code}/current`);
      const groups = ['forwards', 'defensemen', 'goalies'];
      const out = [];
      for (const group of groups) {
        for (const p of data?.[group] || []) {
          const name = `${p?.firstName?.default || ''} ${p?.lastName?.default || ''}`.trim();
          if (!name || !p?.id) continue;
          out.push({
            id: String(p.id),
            name,
            team: code,
            pos: p?.positionCode || '',
            headshot: typeof p?.headshot === 'string' ? p.headshot : '',
          });
        }
      }
      return out;
    } catch {
      return [];
    }
  });

  return { players: dedupePlayers(rosters.flat()), tricodes, byNickname };
}

function dedupePlayers(players) {
  const byId = new Map();
  for (const p of players) {
    if (!p.id || !p.name) continue;
    if (!byId.has(p.id)) byId.set(p.id, p);
  }
  return [...byId.values()].sort((a, b) => (a.name === b.name
    ? (a.id < b.id ? -1 : 1)
    : (a.name < b.name ? -1 : 1)));
}

// ─── NHL tricode → ESPN team reconciliation ──────────────────────────────────

async function nhlTricodeMap(teams) {
  const standings = await getJson('https://api-web.nhle.com/v1/standings/now');
  const map = {};
  for (const row of standings?.standings || []) {
    const code = String(row?.teamAbbrev?.default || '').toUpperCase();
    const fullName = String(row?.teamName?.default || '').trim();
    if (!code || !fullName) continue;
    const team = teams.find((t) => t.name.toLowerCase() === fullName.toLowerCase())
      || teams.find((t) => t.nickname && fullName.endsWith(t.nickname));
    if (team) map[code] = team.abbr;
  }
  return map;
}

// ─── emit ────────────────────────────────────────────────────────────────────

function emit(payload) {
  const lines = [];
  lines.push('/**');
  lines.push(' * src/entity-graph/dictionary.js — GENERATED FILE, DO NOT EDIT BY HAND.');
  lines.push(' *');
  lines.push(' * Regenerate with: node scripts/build-entity-dictionary.mjs');
  lines.push(' *');
  lines.push(' * Entity ids here are the real ids the PropBetEdge routes resolve against:');
  lines.push(' *   /player/mlb/:id  → MLB StatsAPI person id');
  lines.push(' *   /player/nfl/:id  → ESPN athlete id');
  lines.push(' *   /player/nba/:id  → ESPN athlete id');
  lines.push(' *   /player/nhl/:id  → NHL api-web player id');
  lines.push(' *   /team/:sport/:slug → slugified ESPN displayName');
  lines.push(' *');
  lines.push(` * Snapshot taken ${payload.generated_at}.`);
  lines.push(' */');
  lines.push('');
  lines.push(`export const DICTIONARY_VERSION = ${JSON.stringify(payload.version)};`);
  lines.push(`export const GENERATED_AT = ${JSON.stringify(payload.generated_at)};`);
  lines.push(`export const NHL_HEADSHOT_SEASON = ${JSON.stringify(payload.nhl_headshot_season)};`);
  lines.push('');
  lines.push('// [id, displayName, location, nickname, abbr, slug, logoUrl]');
  lines.push('export const TEAMS = {');
  for (const sport of SPORTS) {
    const rows = payload.teams[sport] || [];
    lines.push(`  ${sport}: [`);
    for (const t of rows) {
      lines.push(`    ${JSON.stringify([t.id, t.name, t.location, t.nickname, t.abbr, t.slug, t.logo || ''])},`);
    }
    lines.push('  ],');
  }
  lines.push('};');
  lines.push('');
  lines.push('// NHL api-web tricode → ESPN team abbreviation (our /team slug identity).');
  lines.push(`export const NHL_TRICODE_TO_ABBR = ${JSON.stringify(payload.nhl_tricode_map, null, 2)};`);
  lines.push('');
  lines.push('// [id, fullName, teamAbbr, position]');
  lines.push('export const PLAYERS = {');
  for (const sport of SPORTS) {
    const rows = payload.players[sport] || [];
    lines.push(`  ${sport}: [`);
    for (const p of rows) {
      lines.push(`    ${JSON.stringify([p.id, p.name, p.team, p.pos || ''])},`);
    }
    lines.push('  ],');
  }
  lines.push('};');
  lines.push('');

  writeFileSync(OUT, lines.join('\n'), 'utf8');
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  const existing = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  const payload = {
    version: '1',
    generated_at: new Date().toISOString(),
    nhl_headshot_season: '',
    teams: {},
    players: {},
    nhl_tricode_map: {},
  };

  // Preserve untouched sports when building a subset.
  for (const sport of SPORTS) {
    if (TARGET_SPORTS.includes(sport)) continue;
    const teams = extractExisting(existing, 'TEAMS', sport);
    const players = extractExisting(existing, 'PLAYERS', sport);
    payload.teams[sport] = teams.map(([id, name, location, nickname, abbr, slug, logo]) => ({
      id, name, location, nickname, abbr, slug, logo,
    }));
    payload.players[sport] = players.map(([id, name, team, pos]) => ({ id, name, team, pos }));
  }

  for (const sport of TARGET_SPORTS) {
    process.stdout.write(`building ${sport} teams… `);
    const teams = await buildTeams(sport);
    payload.teams[sport] = teams;
    process.stdout.write(`${teams.length} teams\n`);

    process.stdout.write(`building ${sport} players… `);
    let players;
    if (sport === 'mlb') players = await buildMlbPlayers(teams);
    else if (sport === 'nhl') {
      const nhl = await buildNhlPlayers(teams);
      payload.nhl_tricode_map = await nhlTricodeMap(teams);
      // Re-key NHL rosters onto the ESPN abbreviation our team slugs use.
      players = nhl.players.map((p) => ({
        ...p,
        team: payload.nhl_tricode_map[p.team] || p.team,
      }));
      payload.nhl_headshot_season = nhlSeasonFrom(nhl.players);
    } else players = await buildEspnPlayers(sport, teams);
    payload.players[sport] = players;
    process.stdout.write(`${players.length} players\n`);
  }

  if (!TARGET_SPORTS.includes('nhl')) {
    payload.nhl_tricode_map = extractExistingObject(existing, 'NHL_TRICODE_TO_ABBR');
    payload.nhl_headshot_season = extractExistingString(existing, 'NHL_HEADSHOT_SEASON');
  }

  emit(payload);

  const totalTeams = SPORTS.reduce((n, s) => n + (payload.teams[s]?.length || 0), 0);
  const totalPlayers = SPORTS.reduce((n, s) => n + (payload.players[s]?.length || 0), 0);
  const bytes = readFileSync(OUT).length;
  console.log(`\nwrote ${OUT}`);
  console.log(`  teams:   ${totalTeams}`);
  console.log(`  players: ${totalPlayers}`);
  console.log(`  size:    ${(bytes / 1024).toFixed(1)} KB`);
}

function nhlSeasonFrom(players) {
  for (const p of players) {
    const match = String(p.headshot || '').match(/\/mugs\/nhl\/(\d{8})\//);
    if (match) return match[1];
  }
  return '';
}

function extractExisting(source, constant, sport) {
  const block = source.match(new RegExp(`export const ${constant} = \\{([\\s\\S]*?)\\n\\};`));
  if (!block) return [];
  const sportBlock = block[1].match(new RegExp(`\\n  ${sport}: \\[([\\s\\S]*?)\\n  \\],`));
  if (!sportBlock) return [];
  return sportBlock[1]
    .split('\n')
    .map((line) => line.trim().replace(/,$/, ''))
    .filter((line) => line.startsWith('['))
    .map((line) => JSON.parse(line));
}

function extractExistingObject(source, constant) {
  const match = source.match(new RegExp(`export const ${constant} = (\\{[\\s\\S]*?\\n\\});`));
  return match ? JSON.parse(match[1]) : {};
}

function extractExistingString(source, constant) {
  const match = source.match(new RegExp(`export const ${constant} = ("[^"]*");`));
  return match ? JSON.parse(match[1]) : '';
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
