import './styles/story-image-integrity.css';
import './styles/pbe-publication-unify.css';
import { initSiteEnhancements } from './site-enhancements.js';
import { initStoryMediaBackfill } from './media-backfill.js';
import { initArticleTrustLayer } from './article-trust.js';
import { initArticleFunnel } from './article-funnel.js';
import { initAnalytics } from './analytics.js';
import { initRouter } from './router.js';

initSiteEnhancements();
initStoryMediaBackfill();
initArticleTrustLayer();
initArticleFunnel();
initAnalytics();
initRouter();
