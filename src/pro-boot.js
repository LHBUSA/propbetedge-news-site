/* Shared boot for the lean All Access entries (src/pro-entry.js for /pro,
 * src/intl-pro-entry.js for /ja/pro and /ko/pro).
 *
 * These pages are served by Edge Middleware from dedicated shells
 * (dist/_shell/*.html, emitted by vite.pro.config.js from the built index.html),
 * so they no longer download the full newsroom SPA. The entries render the
 * same page the SPA router renders for these routes (src/pages/pro.js,
 * src/pages/intl.js); this module runs the same site-wide layers that touch them:
 * background scene, image healing, share bar, analytics (GA4
 * network_cta_click with placement / page_locale / checkout_locale / via),
 * engagement, preferred source and live-platform links. Article-, homepage-
 * and author-only layers are not loaded; links to other routes are ordinary
 * page loads. Search (data-pbe-search-open, Cmd/Ctrl+K, '/') loads its module
 * on first use.
 *
 * Stylesheets: the SPA bundle's files in the SPA's order (index.html's
 * main.css, then src/main.js's list), minus sheets whose rules match nothing
 * these pages render (scoped to articles, markets, about, founder, editorial
 * standards, research, the homepage closer, games hub and player history:
 * every rule's selector checked against the rendered /pro, ?checkout=success,
 * /ja/pro and /ko/pro DOM, header menus and scene panel included). The search
 * palette's sheets stay: the palette opens on these pages. Removing a sheet
 * cannot reorder the rest, so the cascade for these pages is unchanged;
 * tests/pro-lean-entry.test.mjs pins the list. */
import './styles/main.css';
import './styles/pbe-publication-unify.css';
import './styles/pbe-header-polish.css';
import './styles/background-selector.css';
import './styles/background-selector-overlay-fix.css';
import './styles/pbe-personalization-polish.css';
import './styles/pbe-header-league-group.css';
import './styles/pbe-scene-preview-fix.css';
import './styles/pbe-background-assets.css';
import './styles/pbe-search-reading.css';
import './styles/pbe-header-network-switcher.css';
import './styles/pbe-search-network-upgrade.css';
import './styles/pbe-entity-graph.css';
import './styles/pbe-mobile-cleanup.css';
import './styles/pbe-pro.css';
import './vendor/pbe-locale/pbe-locale.css';
import './styles/pbe-intl.css';
import './styles/pbe-intelligence-cta.css';
import './styles/pbe-preferred-source.css';
import './styles/network-footer.css';
import './styles/pbe-nav-v2.css';
import { initBackgroundSelector } from './background-selector.js';
import { initNflLaunchPriority } from './nfl-launch-priority.js';
import { initSiteEnhancements } from './site-enhancements.js';
import { initStoryMediaBackfill } from './media-backfill.js';
import { initArticleTrustLayer } from './article-trust.js';
import { initAnalytics } from './analytics.js';
import { mountPreferredSource } from './components/preferred-source.js';
import { initEngagementAnalytics } from './engagement-analytics.js';
import { initLivePlatformLaunch } from './live-platform-launch.js';
import { freshRouteRoot } from './route-integrity.js';
import { initLazySearch } from './search-lazy.js';

/** main.js, minus the router: the same layers in the same order, with `render`
 *  (the router's first render for this route) in the router's slot. */
export function boot(render) {
  initBackgroundSelector();
  initNflLaunchPriority();
  initSiteEnhancements();
  initStoryMediaBackfill();
  initArticleTrustLayer();
  initLazySearch();
  initAnalytics();
  mountPreferredSource();
  initEngagementAnalytics();
  render(routeRoot());
  initLivePlatformLaunch();
}

/* What src/router.js does before rendering: a fresh #app, scrolled to the top. */
function routeRoot() {
  const root = freshRouteRoot();
  window.scrollTo({ top: 0, behavior: 'instant' });
  return root;
}
