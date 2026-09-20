import { renderPlayerHistory } from './player-history.js';
export function renderNbaPlayerPage(root, playerId, setMeta) {
  return renderPlayerHistory(root, 'nba', playerId, setMeta);
}
