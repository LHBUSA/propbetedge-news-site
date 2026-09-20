import { renderPlayerHistory } from './player-history.js';
export function renderNhlPlayerPage(root, playerId, setMeta) {
  return renderPlayerHistory(root, 'nhl', playerId, setMeta);
}
