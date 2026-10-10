/* Lean entry for /pro (PropBetEdge All Access), served by Edge Middleware with
 * dist/_shell/pro.html instead of the full newsroom SPA. Renders exactly what
 * src/router.js renders for /pro. See src/pro-boot.js. */
import { boot } from './pro-boot.js';
import { renderPro } from './pages/pro.js';
import { setMeta } from './route-meta.js';

boot((root) => {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  // Only /pro is served with this shell (e.g. not the shell file opened directly).
  if (path !== '/pro') { window.location.replace('/pro'); return; }
  renderPro(root, setMeta);
});
