export const SPORT_CONFIG = Object.freeze({
  mlb: Object.freeze({
    key: 'mlb',
    label: 'MLB',
    name: 'Major League Baseball',
    emoji: '⚾',
    espnPath: 'baseball/mlb',
    productUrl: 'https://mlb.propbetedge.ai',
    picksUrl: 'https://mlb.propbetedge.ai/picks',
    primaryCta: 'Open MLB Intelligence',
    standingsLabel: 'MLB Standings',
  }),
  nfl: Object.freeze({
    key: 'nfl',
    label: 'NFL',
    name: 'National Football League',
    emoji: '🏈',
    espnPath: 'football/nfl',
    productUrl: 'https://nfl.propbetedge.ai',
    picksUrl: 'https://nfl.propbetedge.ai/#picks',
    primaryCta: 'Open NFL Intelligence',
    standingsLabel: 'NFL Standings',
  }),
  nba: Object.freeze({
    key: 'nba',
    label: 'NBA',
    name: 'National Basketball Association',
    emoji: '🏀',
    espnPath: 'basketball/nba',
    productUrl: 'https://nba.propbetedge.ai',
    picksUrl: 'https://nba.propbetedge.ai',
    primaryCta: 'Open NBA Intelligence',
    standingsLabel: 'NBA Standings',
  }),
  nhl: Object.freeze({
    key: 'nhl',
    label: 'NHL',
    name: 'National Hockey League',
    emoji: '🏒',
    espnPath: 'hockey/nhl',
    productUrl: 'https://nhl.propbetedge.ai',
    picksUrl: 'https://nhl.propbetedge.ai',
    primaryCta: 'Open NHL Intelligence',
    standingsLabel: 'NHL Standings',
  }),
});

export function getSportConfig(sport) {
  return SPORT_CONFIG[String(sport || '').toLowerCase()] || null;
}

export function requireSportConfig(sport) {
  const config = getSportConfig(sport);
  if (!config) throw new Error(`Unsupported sport: ${sport}`);
  return config;
}

export function slugifyEntity(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function entityHref(kind, sport, value) {
  const cleanSport = String(sport || '').toLowerCase();
  const slug = slugifyEntity(value);
  if (!cleanSport || !slug) return '#';
  if (kind === 'team') return `/team/${cleanSport}/${slug}`;
  return '#';
}
