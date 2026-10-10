/* Lean entry for /ja/pro and /ko/pro (Global #67), served by Edge Middleware
 * with dist/_shell/intl-pro.html instead of the full newsroom SPA. Renders
 * exactly what src/router.js renders for these routes. See src/pro-boot.js. */
import { boot } from './pro-boot.js';
import { renderIntlPage } from './pages/intl.js';
import { intlRoute, documentLang } from './global/intl-pages.js';
import { setMeta } from './route-meta.js';

boot((root) => {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  const intl = intlRoute(path);
  // Only the localized All Access pages are served with this shell.
  if (!intl || intl.kind !== 'pro') { window.location.replace('/pro'); return; }
  const lang = documentLang(path);
  if (lang !== (document.documentElement.lang || 'en')) document.documentElement.lang = lang;
  renderIntlPage(root, intl, setMeta);
});
