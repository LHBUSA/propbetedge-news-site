const GAME_ID = /^\d{6,12}$/;

const CAST_BASE = Object.freeze({
  nfl: 'https://nfl.propbetedge.ai',
  nhl: 'https://nhl.propbetedge.ai',
  wnba: 'https://wnba.propbetedge.ai',
});

export function liveCastUrl(sport, gameId) {
  const key = String(sport || '').toLowerCase();
  const id = String(gameId || '').trim();
  if (!GAME_ID.test(id) || !CAST_BASE[key]) return null;

  if (key === 'nfl') return `${CAST_BASE.nfl}/?event=${encodeURIComponent(id)}#pbecast`;
  if (key === 'nhl') return `${CAST_BASE.nhl}/#/cast/${encodeURIComponent(id)}`;
  return `${CAST_BASE.wnba}/cast/${encodeURIComponent(id)}`;
}

export function liveCastLabel(sport) {
  const key = String(sport || '').toLowerCase();
  if (key === 'wnba') return 'WNBACast';
  if (key === 'nfl') return 'NFL PBEcast';
  if (key === 'nhl') return 'NHL PBEcast';
  return 'Game Center';
}

export function liveCastHome(sport) {
  const key = String(sport || '').toLowerCase();
  if (key === 'wnba') return `${CAST_BASE.wnba}/cast`;
  if (key === 'nfl') return `${CAST_BASE.nfl}/#pbecast`;
  if (key === 'nhl') return `${CAST_BASE.nhl}/#/cast`;
  return null;
}
