/**
 * src/search/destinations.js — the real, verified destinations of the
 * PropBetEdge network, as compact search documents.
 *
 * Every href below was confirmed against the owning site's route table AND
 * fetched (HTTP 200) before it was listed. Hash-routed products (NFL, NBA,
 * NHL) are linked by their hash route because their path URLs either 404 or
 * silently land on a default page. Do not add a destination here without
 * doing both checks — a search result that lands on a dead page is worse than
 * no result.
 *
 * Pure data + tiny builders. Imported by the pbe-entity-hub Worker (server
 * index) and by the browser palette (offline fallback + empty state).
 */

const UFC = 'https://ufc.propbetedge.ai';
const MLB = 'https://mlb.propbetedge.ai';
const NFL = 'https://nfl.propbetedge.ai';
const NBA = 'https://nba.propbetedge.ai';
const NHL = 'https://nhl.propbetedge.ai';
const WNBA = 'https://wnba.propbetedge.ai';

export const SPORT_LABEL = Object.freeze({
  mlb: 'MLB', nfl: 'NFL', nba: 'NBA', wnba: 'WNBA', nhl: 'NHL', ufc: 'UFC',
});

export const PRODUCT_HUBS = Object.freeze({
  mlb: `${MLB}/sharp-tools`,
  nfl: NFL,
  nba: NBA,
  wnba: WNBA,
  nhl: NHL,
  ufc: UFC,
});

/**
 * [id, sport, title, label, href, aliases, keywords, boost]
 * `label` is the display line under the title ("UFC INTELLIGENCE · LABS").
 */
const TOOL_ROWS = [
  // ── league intelligence products ──────────────────────────────────────────
  ['mlb-intelligence', 'mlb', 'MLB Intelligence', 'MLB · LIVE INTELLIGENCE', PRODUCT_HUBS.mlb, ['mlb', 'baseball', 'mlb propbetedge', 'sharp tools'], ['statcast', 'props', 'model', 'picks', 'player research'], 20],
  ['nfl-intelligence', 'nfl', 'NFL Intelligence', 'NFL · LIVE INTELLIGENCE', PRODUCT_HUBS.nfl, ['nfl', 'football', 'nfl propbetedge'], ['market board', 'model lab', 'simulation', 'props', 'matchups'], 20],
  ['nba-intelligence', 'nba', 'NBA Intelligence', 'NBA · LIVE INTELLIGENCE', PRODUCT_HUBS.nba, ['nba', 'basketball', 'nba propbetedge'], ['nbacast', 'props', 'injuries', 'matchups'], 20],
  ['wnba-intelligence', 'wnba', 'WNBA Intelligence', 'WNBA · LIVE INTELLIGENCE', PRODUCT_HUBS.wnba, ['wnba', 'womens basketball', 'wnba propbetedge'], ['wnbacast', 'predictions', 'props', 'players'], 20],
  ['nhl-intelligence', 'nhl', 'NHL Intelligence', 'NHL · LIVE INTELLIGENCE', PRODUCT_HUBS.nhl, ['nhl', 'hockey', 'nhl propbetedge'], ['ice board', 'pbe cast', 'picks', 'props'], 20],
  ['ufc-intelligence', 'ufc', 'UFC Intelligence', 'UFC · LIVE INTELLIGENCE', PRODUCT_HUBS.ufc, ['ufc', 'mma', 'ufc propbetedge'], ['fight dna', 'fighters', 'cards', 'rankings', 'fight week'], 20],

  // ── UFC ───────────────────────────────────────────────────────────────────
  ['ufc-simulator', 'ufc', 'Fight Simulator', 'UFC INTELLIGENCE · LABS', `${UFC}/simulator`, ['fight simulator', 'simulator', 'ufc simulator', 'fight sim', 'mma simulator'], ['simulate', 'matchup', 'labs', 'what if'], 10],
  ['ufc-fight-dna', 'ufc', 'Fight DNA', 'UFC INTELLIGENCE · FIGHT DNA', `${UFC}/learn/fight-dna`, ['fight dna', 'fighter dna', 'dna', 'ufc dna'], ['style', 'profile', 'metrics'], 5],
  ['ufc-pbe-picks', 'ufc', 'PBE Picks · UFC', 'UFC INTELLIGENCE · PBE PICKS', `${UFC}/algo/card`, ['pbe picks', 'ufc picks', 'ufc pbe picks', 'picks'], ['model', 'selections', 'card', 'bets'], 0],
  ['ufc-algo', 'ufc', 'PBE Algo', 'UFC INTELLIGENCE · ALGO', `${UFC}/algo`, ['pbe algo', 'algo', 'ufc algo'], ['win probability', 'model', 'predictions'], 0],
  ['ufc-track-record', 'ufc', 'Track Record · UFC', 'UFC INTELLIGENCE · TRACK RECORD', `${UFC}/algo/record`, ['track record', 'ufc track record', 'past picks'], ['results', 'roi', 'units', 'graded'], 0],
  ['ufc-model', 'ufc', 'PBE Fight Model', 'UFC INTELLIGENCE · MODEL LAB', `${UFC}/model`, ['fight model', 'model lab', 'ufc model'], ['win probability', 'odds', 'model'], 0],
  ['ufc-rankings', 'ufc', 'UFC Rankings', 'UFC INTELLIGENCE · RANKINGS', `${UFC}/rankings`, ['rankings', 'ufc rankings', 'mma rankings', 'champions'], ['divisions', 'top 15', 'pound for pound'], 5],
  ['ufc-injuries', 'ufc', 'Injuries · UFC', 'UFC INTELLIGENCE · INJURIES', `${UFC}/injuries`, ['injuries', 'ufc injuries', 'withdrawals'], ['status', 'injury', 'out'], 0],
  ['ufc-events', 'ufc', 'UFC Schedule & Results', 'UFC INTELLIGENCE · EVENTS', `${UFC}/events`, ['ufc schedule', 'ufc events', 'ufc results', 'schedule'], ['cards', 'events', 'results'], 0],
  ['ufc-fight-week', 'ufc', 'Fight Week', 'UFC INTELLIGENCE · FIGHT WEEK', `${UFC}/fight-week`, ['fight week', 'ufc fight week'], ['pregame', 'card', 'weigh ins'], 0],
  ['ufc-news', 'ufc', 'UFC News', 'UFC NEWSROOM', `${UFC}/news`, ['ufc news', 'mma news'], ['news', 'stories', 'fighters'], 0],

  // ── MLB ───────────────────────────────────────────────────────────────────
  ['mlb-hr-targets', 'mlb', 'HR Targets', 'MLB INTELLIGENCE · HOME RUNS', `${MLB}/hr-picks`, ['hr targets', 'home run targets', 'hr picks', 'hr props', 'home run props', 'home runs'], ['hr', 'homer', 'power', 'picks'], 10],
  ['mlb-k-props', 'mlb', 'K Props', 'MLB INTELLIGENCE · STRIKEOUTS', `${MLB}/k-picks`, ['k props', 'strikeout props', 'k picks', 'strikeouts'], ['pitcher', 'ks', 'strikeout'], 5],
  ['mlb-pbecast', 'mlb', 'PBEcast · MLB', 'MLB INTELLIGENCE · LIVE GAMES', `${MLB}/pbecast`, ['pbecast', 'mlb pbecast', 'pbe cast'], ['live', 'game cast', 'pitch by pitch'], 0],
  ['mlb-track-record', 'mlb', 'Track Record · MLB', 'MLB INTELLIGENCE · TRACK RECORD', `${MLB}/track-record`, ['track record', 'mlb track record'], ['results', 'roi'], 0],
  ['mlb-best-line', 'mlb', 'Best Line · MLB', 'MLB INTELLIGENCE · MARKET', `${MLB}/best-line`, ['best line', 'mlb odds', 'mlb best line'], ['market', 'odds', 'lines', 'sportsbooks'], 0],
  ['mlb-analytics', 'mlb', 'Analytics Lab · MLB', 'MLB INTELLIGENCE · LAB', `${MLB}/analytics`, ['analytics lab', 'mlb analytics'], ['model', 'statcast', 'research'], 0],
  ['mlb-hr-simulator', 'mlb', 'HR Simulator', 'MLB INTELLIGENCE · LABS', `${MLB}/hr-simulator`, ['hr simulator', 'home run simulator'], ['simulate', 'home run'], 0],
  ['mlb-injuries', 'mlb', 'Injuries · MLB', 'MLB INTELLIGENCE · INJURIES', `${MLB}/injuries`, ['injuries', 'mlb injuries'], ['il', 'injury', 'status'], 0],

  // ── NFL (hash-routed) ─────────────────────────────────────────────────────
  ['nfl-pbe-picks', 'nfl', 'PBE Picks · NFL', 'NFL INTELLIGENCE · PBE PICKS', `${NFL}/#pbepicks`, ['pbe picks', 'nfl picks', 'nfl pbe picks', 'picks'], ['model', 'bets'], 0],
  ['nfl-model-lab', 'nfl', 'Model Lab · NFL', 'NFL INTELLIGENCE · MODEL LAB', `${NFL}/#picks`, ['model lab', 'nfl model lab', 'nfl model'], ['simulation', 'projections'], 0],
  ['nfl-market-board', 'nfl', 'Market Board · NFL', 'NFL INTELLIGENCE · MARKET', `${NFL}/#marketwatch`, ['market board', 'market watch', 'nfl market board', 'nfl odds'], ['lines', 'odds', 'movement'], 0],
  ['nfl-pbecast', 'nfl', 'PBEcast · NFL', 'NFL INTELLIGENCE · LIVE GAMES', `${NFL}/#pbecast`, ['pbecast', 'nfl pbecast', 'pbe cast'], ['live', 'game cast'], 0],
  ['nfl-track-record', 'nfl', 'Track Record · NFL', 'NFL INTELLIGENCE · TRACK RECORD', `${NFL}/#trackrecord`, ['track record', 'nfl track record'], ['results', 'roi'], 0],
  ['nfl-prop-board', 'nfl', 'Prop Board · NFL', 'NFL INTELLIGENCE · PROPS', `${NFL}/#propboard`, ['prop board', 'nfl props', 'player props'], ['props', 'lines'], 0],
  ['nfl-injuries', 'nfl', 'Injuries · NFL', 'NFL INTELLIGENCE · INJURIES', `${NFL}/#injuries`, ['injuries', 'nfl injuries', 'injury report'], ['status', 'out', 'questionable'], 0],
  ['nfl-simulator', 'nfl', 'Game Simulator · NFL', 'NFL INTELLIGENCE · LABS', `${NFL}/#simulator`, ['nfl simulator', 'line simulation'], ['simulate', 'simulator'], 0],

  // ── NBA (hash-routed) ─────────────────────────────────────────────────────
  ['nba-pbe-picks', 'nba', 'PBE Picks · NBA', 'NBA INTELLIGENCE · PBE PICKS', `${NBA}/#pbe-picks`, ['pbe picks', 'nba picks', 'nba pbe picks', 'picks'], ['model'], 0],
  ['nba-cast', 'nba', 'NBACast', 'NBA INTELLIGENCE · LIVE GAMES', `${NBA}/#nbacast`, ['nbacast', 'pbecast', 'nba pbecast', 'pbe cast'], ['live', 'game cast'], 0],
  ['nba-models', 'nba', 'Model Lab · NBA', 'NBA INTELLIGENCE · MODEL LAB', `${NBA}/#models`, ['model lab', 'nba models', 'nba model'], ['projections'], 0],
  ['nba-track-record', 'nba', 'Track Record · NBA', 'NBA INTELLIGENCE · TRACK RECORD', `${NBA}/#trackrecord`, ['track record', 'nba track record'], ['results'], 0],
  ['nba-props', 'nba', 'Props · NBA', 'NBA INTELLIGENCE · PROPS', `${NBA}/#props`, ['nba props', 'player props'], ['props', 'lines'], 0],
  ['nba-injuries', 'nba', 'Injuries · NBA', 'NBA INTELLIGENCE · INJURIES', `${NBA}/#injuries`, ['injuries', 'nba injuries'], ['status'], 0],

  // ── WNBA ──────────────────────────────────────────────────────────────────
  ['wnba-pbe-picks', 'wnba', 'PBE Picks · WNBA', 'WNBA INTELLIGENCE · PBE PICKS', `${WNBA}/pbe-picks`, ['pbe picks', 'wnba picks', 'wnba pbe picks', 'picks'], ['model', 'win probability'], 0],
  ['wnba-model', 'wnba', 'Model Lab · WNBA', 'WNBA INTELLIGENCE · MODEL LAB', `${WNBA}/pbe-picks/model`, ['model lab', 'wnba model'], ['methodology'], 0],
  ['wnba-cast', 'wnba', 'WNBACast', 'WNBA INTELLIGENCE · LIVE GAMES', `${WNBA}/cast`, ['wnbacast', 'pbecast', 'wnba pbecast', 'pbe cast'], ['live', 'play by play'], 0],
  ['wnba-props', 'wnba', 'Props · WNBA', 'WNBA INTELLIGENCE · PROPS', `${WNBA}/props`, ['wnba props', 'player props'], ['props', 'lines'], 0],
  ['wnba-injuries', 'wnba', 'Injuries · WNBA', 'WNBA INTELLIGENCE · INJURIES', `${WNBA}/injuries`, ['injuries', 'wnba injuries'], ['availability'], 0],
  ['wnba-track-record', 'wnba', 'Track Record · WNBA', 'WNBA INTELLIGENCE · TRACK RECORD', `${WNBA}/track-record`, ['track record', 'wnba track record'], ['results'], 0],
  ['wnba-scenario-lab', 'wnba', 'Scenario Lab · WNBA', 'WNBA INTELLIGENCE · LABS', `${WNBA}/scenario-lab`, ['scenario lab'], ['simulate', 'game paths'], 0],

  // ── NHL (hash-routed) ─────────────────────────────────────────────────────
  ['nhl-pbe-picks', 'nhl', 'PBE Picks · NHL', 'NHL INTELLIGENCE · PBE PICKS', `${NHL}/#/pbe-picks`, ['pbe picks', 'nhl picks', 'nhl pbe picks', 'picks'], ['model'], 0],
  ['nhl-cast', 'nhl', 'PBE Cast · NHL', 'NHL INTELLIGENCE · LIVE GAMES', `${NHL}/#/cast`, ['pbe cast', 'pbecast', 'nhl pbecast', 'nhl cast'], ['live', 'game cast'], 0],
  ['nhl-props', 'nhl', 'Props · NHL', 'NHL INTELLIGENCE · PROPS', `${NHL}/#/props`, ['nhl props', 'player props'], ['props'], 0],
  ['nhl-lines', 'nhl', 'Lines · NHL', 'NHL INTELLIGENCE · MARKET', `${NHL}/#/lines`, ['nhl lines', 'nhl odds'], ['market', 'odds'], 0],
  ['nhl-injuries', 'nhl', 'Injuries · NHL', 'NHL INTELLIGENCE · INJURIES', `${NHL}/#/injuries`, ['injuries', 'nhl injuries'], ['status'], 0],
  ['nhl-track-record', 'nhl', 'Track Record · NHL', 'NHL INTELLIGENCE · TRACK RECORD', `${NHL}/#/track-record`, ['track record', 'nhl track record'], ['results'], 0],

  // ── propbetedge.ai hub ────────────────────────────────────────────────────
  ['hub-home', null, 'PropBetEdge Home', 'PROPBETEDGE · FRONT PAGE', '/', ['home', 'front page', 'propbetedge'], ['my edge'], -10],
  ['hub-games', null, 'PBEcast Live Games', 'PROPBETEDGE · LIVE GAMES', '/games', ['pbecast', 'live games', 'scores', 'pbe cast', 'game center'], ['live', 'scoreboard'], 12],
  ['hub-picks', null, 'Free Picks', 'PROPBETEDGE · PBE PICKS', '/odds', ['free picks', 'pbe picks', 'picks', 'odds'], ['hr props', 'model', 'bets'], 8],
  ['hub-picks-history', null, 'Free Picks History', 'PROPBETEDGE · TRACK RECORD', '/odds/history', ['free picks history', 'picks history', 'track record'], ['results'], -5],
  ['hub-leaders', null, 'Stat Leaders', 'PROPBETEDGE · LEADERS', '/leaders', ['leaders', 'stat leaders', 'stats'], ['players', 'league leaders'], 0],
  ['hub-news', null, 'All News', 'PROPBETEDGE · NEWSROOM', '/news', ['news', 'all news', 'latest news', 'stories'], ['newsroom'], 0],
];

// Standings and leaders live on the hub for every league it covers.
const HUB_LEAGUE_ROWS = [];
for (const sport of ['mlb', 'nfl', 'nba', 'wnba', 'nhl']) {
  const L = SPORT_LABEL[sport];
  HUB_LEAGUE_ROWS.push([`${sport}-standings`, sport, `${L} Standings`, `${L} INTELLIGENCE · STANDINGS`, `/standings/${sport}`, ['standings', `${sport} standings`, `${sport} table`], ['records', 'table'], 0]);
  HUB_LEAGUE_ROWS.push([`${sport}-leaders`, sport, `${L} Leaders`, `${L} INTELLIGENCE · LEADERS`, `/leaders/${sport}`, ['leaders', `${sport} leaders`, `${sport} stats`], ['stats', 'top players'], 0]);
}
for (const sport of ['mlb', 'nfl', 'nba', 'nhl']) {
  const L = SPORT_LABEL[sport];
  HUB_LEAGUE_ROWS.push([`${sport}-news`, sport, `${L} News`, `${L} NEWSROOM`, `/news/${sport}`, [`${sport} news`], ['news', 'stories'], 0]);
}
HUB_LEAGUE_ROWS.push(['ufc-champions', 'ufc', 'UFC Champions', 'UFC INTELLIGENCE · LEADERS', '/leaders/ufc', ['ufc champions', 'ufc leaders'], ['champions', 'titles'], 0]);

function toolDoc([id, sport, title, label, href, aliases, keywords, boost]) {
  return Object.freeze({
    type: 'tool',
    sport: sport || null,
    id,
    title,
    subtitle: label,
    label,
    href,
    image: null,
    aliases: Object.freeze([...aliases]),
    keywords: Object.freeze([...keywords]),
    boost: boost || 0,
  });
}

export const TOOL_DOCS = Object.freeze([...TOOL_ROWS, ...HUB_LEAGUE_ROWS].map(toolDoc));

export function toolById(id) {
  return TOOL_DOCS.find((d) => d.id === id) || null;
}

/** Empty-state rows. Real destinations, never canned "results". */
export const EMPTY_STATE = Object.freeze({
  live: Object.freeze(['mlb', 'nfl', 'nba', 'wnba', 'nhl', 'ufc'].map((sport) => Object.freeze({
    id: `${sport}-intelligence`,
    title: SPORT_LABEL[sport],
    href: PRODUCT_HUBS[sport],
    sport,
  }))),
  popular: Object.freeze([
    Object.freeze({ id: 'hub-picks', title: 'PBE Picks', href: '/odds', sport: null }),
    Object.freeze({ id: 'hub-games', title: 'PBEcast', href: '/games', sport: null }),
    Object.freeze({ id: 'ufc-simulator', title: 'Fight Simulator', href: `${UFC}/simulator`, sport: 'ufc' }),
    Object.freeze({ id: 'mlb-hr-targets', title: 'HR Targets', href: `${MLB}/hr-picks`, sport: 'mlb' }),
    Object.freeze({ id: 'ufc-fight-dna', title: 'Fight DNA', href: `${UFC}/learn/fight-dna`, sport: 'ufc' }),
  ]),
});

// ─── teams ──────────────────────────────────────────────────────────────────

/** WNBA clubs (wnba-api /v1/teams, 2026). Canonical pages live on wnba.propbetedge.ai. */
export const WNBA_TEAMS = Object.freeze([
  ['20', 'Atlanta Dream', 'Atlanta', 'Dream', 'ATL'],
  ['19', 'Chicago Sky', 'Chicago', 'Sky', 'CHI'],
  ['18', 'Connecticut Sun', 'Connecticut', 'Sun', 'CON'],
  ['3', 'Dallas Wings', 'Dallas', 'Wings', 'DAL'],
  ['129689', 'Golden State Valkyries', 'Golden State', 'Valkyries', 'GS'],
  ['5', 'Indiana Fever', 'Indiana', 'Fever', 'IND'],
  ['17', 'Las Vegas Aces', 'Las Vegas', 'Aces', 'LV'],
  ['6', 'Los Angeles Sparks', 'Los Angeles', 'Sparks', 'LA'],
  ['8', 'Minnesota Lynx', 'Minnesota', 'Lynx', 'MIN'],
  ['9', 'New York Liberty', 'New York', 'Liberty', 'NY'],
  ['11', 'Phoenix Mercury', 'Phoenix', 'Mercury', 'PHX'],
  ['132052', 'Portland Fire', 'Portland', 'Fire', 'POR'],
  ['14', 'Seattle Storm', 'Seattle', 'Storm', 'SEA'],
  ['131935', 'Toronto Tempo', 'Toronto', 'Tempo', 'TOR'],
  ['16', 'Washington Mystics', 'Washington', 'Mystics', 'WSH'],
]);

/**
 * One team search document. `extraAliases` carries the identity system's
 * alternate abbreviations (tagger spellings, NHL tricodes).
 */
export function teamDoc({ sport, id, name, location, nickname, abbr, href, logo, extraAliases = [] }) {
  const aliases = new Set([abbr, nickname, `${location} ${nickname}`, ...extraAliases].filter(Boolean));
  // "Athletics" style clubs have location === nickname; don't alias bare cities
  // otherwise — "Seattle" is four clubs in four leagues and the city itself.
  aliases.delete(name);
  return {
    type: 'team',
    sport,
    id: String(id),
    title: name,
    subtitle: [abbr, location && location !== nickname ? location : null].filter(Boolean).join(' · '),
    href,
    image: logo || null,
    aliases: [...aliases],
    keywords: [location, 'team'].filter(Boolean),
  };
}

/** WNBA team docs from the static table (browser fallback) or the live API. */
export function wnbaTeamDocs(rows = WNBA_TEAMS) {
  return rows.map(([id, name, location, nickname, abbr]) => teamDoc({
    sport: 'wnba', id, name, location, nickname, abbr,
    href: `${WNBA}/teams/${id}`,
    logo: `https://a.espncdn.com/i/teamlogos/wnba/500/${String(abbr).toLowerCase()}.png`,
  }));
}

/**
 * Team docs from the entity dictionary's TEAMS table
 * ([id, name, location, nickname, abbr, slug, logo] per sport). Takes the
 * table as an argument so the browser can pass just TEAMS without pulling the
 * 6,000-player roster into its bundle.
 */
export function dictionaryTeamDocs(TEAMS, aliasesFor = () => []) {
  const out = [];
  for (const sport of Object.keys(TEAMS || {})) {
    for (const [id, name, location, nickname, abbr, slug, logo] of TEAMS[sport]) {
      out.push(teamDoc({
        sport, id, name, location, nickname, abbr,
        href: `/team/${sport}/${slug}`,
        logo,
        extraAliases: aliasesFor(sport, abbr) || [],
      }));
    }
  }
  return out;
}
