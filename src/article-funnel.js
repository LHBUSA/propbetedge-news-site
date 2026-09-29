/* PropBetEdge article funnel alignment
 * Keeps every article conversion surface matched to the sport being read.
 * This is intentionally a late DOM authority so legacy article/right-rail
 * renderers cannot send readers into the wrong product by accident.
 */

const ARTICLE_RE = /^\/news\/(mlb|nfl|nba|nhl)\/[^/]+\/?$/i;
const CAMPAIGNS = {
  mlb: {
    eyebrow: '⚾ PROPBETEDGE MLB · LIVE',
    title: 'Take this story into MLB Intelligence.',
    sub: 'Move from the headline into live game context, player research, model analysis and prop intelligence.',
    secondaryHref: 'https://mlb.propbetedge.ai/askalgo',
    secondaryCta: 'Ask The Algo',
  },
  nfl: {
    eyebrow: '🏈 PROPBETEDGE NFL · LIVE',
    title: 'Take this story into NFL Intelligence.',
    sub: 'Continue into Model Lab, Market Watch, line simulation, SGP research and the deeper football intelligence layer.',
    secondaryHref: 'https://nfl.propbetedge.ai/#picks',
    secondaryCta: 'NFL Picks This Week',
  },
  nba: {
    eyebrow: '🏀 PROPBETEDGE NBA · LIVE',
    title: 'Take this story into NBA Intelligence.',
    sub: 'The basketball platform is live now. Explore player research, game context and the product as it continues to sharpen into the season.',
  },
  nhl: {
    eyebrow: '🏒 PROPBETEDGE NHL · LIVE',
    title: 'Take this story into NHL Intelligence.',
    sub: 'The hockey platform is live now. Explore Ice Board, PBE Cast, player research and the product as it improves through preseason.',
  },
};

import { intelligenceFor, ctaAttrs, ctaLabel, renderMoreThanNewsCta } from './intelligence-cta.js';

let timer = null;

export function initArticleFunnel() {
  schedule();
  window.addEventListener('popstate', schedule);
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
}

// Throttle, not debounce: the live score strip mutates the DOM every few
// hundred ms, so a debounce that resets on each mutation never fires and the
// article CTAs were silently never rendered.
function schedule() {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    sync();
  }, 90);
}

function sync() {
  const match = window.location.pathname.match(ARTICLE_RE);
  if (!match) return;
  const sport = match[1].toLowerCase();
  const campaign = CAMPAIGNS[sport];
  if (!campaign) return;

  const slug = decodeURIComponent(window.location.pathname.split('/').filter(Boolean)[2] || '');
  syncRightRail(campaign, sport, slug);
  syncArticleCloser(sport, slug);
}

// Primary button for a campaign: the sport's canonical Intelligence URL, same
// tab, tagged so analytics emits intelligence_cta_click.
function primaryButton(sport, slug, placement, className) {
  const intel = intelligenceFor(sport);
  return `<a href="${intel.href}" class="${className}" ${ctaAttrs(intel, { placement, pageType: 'article', slug })}>${ctaLabel(intel)} →</a>`;
}

// "More than news." closer after related coverage — the last thing on the page.
function syncArticleCloser(sport, slug) {
  const related = document.querySelector('.article-page #related-slot');
  if (!related) return;
  const existing = document.querySelector('.article-page .pbe-intel-closer');
  if (existing?.dataset.pbeSportFunnel === `${sport}:${slug}`) return;
  existing?.remove();
  related.insertAdjacentHTML('afterend', renderMoreThanNewsCta(sport, { placement: 'article_footer', pageType: 'article', slug }));
  const closer = document.querySelector('.article-page .pbe-intel-closer');
  if (closer) closer.dataset.pbeSportFunnel = `${sport}:${slug}`;
}

function syncRightRail(campaign, sport, slug) {
  const card = document.querySelector('#pbe-article-rail .par-cta');
  if (!card || card.dataset.pbeSportFunnel === `${sport}:${slug}`) return;

  card.dataset.pbeSportFunnel = `${sport}:${slug}`;
  card.innerHTML = `
    <div class="par-cta-eyebrow">${campaign.eyebrow}</div>
    <h2 class="par-cta-title">${campaign.title}</h2>
    <p class="par-cta-sub">${campaign.sub}</p>
    ${primaryButton(sport, slug, 'article_rail', 'par-cta-btn')}
  `;
}


