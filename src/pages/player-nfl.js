import { renderPlayerHistory } from './player-history.js';
export function renderNflPlayerPage(root, playerId, setMeta) {
  return renderPlayerHistory(root, 'nfl', playerId, setMeta);
}
