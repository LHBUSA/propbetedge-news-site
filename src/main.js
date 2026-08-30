import './styles/story-image-integrity.css';
import { initSiteEnhancements } from './site-enhancements.js';
import { initStoryMediaBackfill } from './media-backfill.js';
import { initAnalytics } from './analytics.js';
import { initRouter } from './router.js';

initSiteEnhancements();
initStoryMediaBackfill();
initAnalytics();
initRouter();
