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
    href: 'https://mlb.propbetedge.ai',
    cta: 'Open MLB Intelligence →',
    secondaryHref: 'https://mlb.propbetedge.ai/askalgo',
    secondaryCta: 'Ask The Algo',
  },
  nfl: {
    eyebrow: '🏈 PROPBETEDGE NFL · LIVE',
    title: 'Take this story into NFL Intelligence.',
    sub: 'Continue into Model Lab, Market Watch, line simulation, SGP research and the deeper football intelligence layer.',
    href: 'https://nfl.propbetedge.ai/#picks',
    cta: 'NFL Picks This Week →',
    secondaryHref: 'https://nfl.propbetedge.ai/#propboard',
    secondaryCta: 'See Live Prop Board',
  },
  nba: {
    eyebrow: '🏀 PROPBETEDGE NBA · LIVE',
    title: 'Take this story into NBA Intelligence.',
    sub: 'The basketball platform is live now. Explore player research, game context and the product as it continues to sharpen into the season.',
    href: 'https://nba.propbetedge.ai',
    cta: 'Open NBA Intelligence →',
  },
  nhl: {
    eyebrow: '🏒 PROPBETEDGE NHL · LIVE',
    title: 'Take this story into NHL Intelligence.',
    sub: 'The hockey platform is live now. Explore Ice Board, PBE Cast, player research and the product as it improves through preseason.',
    href: 'https://nhl.propbetedge.ai',
    cta: 'Open NHL Intelligence →',
  },
};

let timer = null;

export function initArticleFunnel() {
  schedule();
  window.addEventListener('popstate', schedule);
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(sync, 90);
}

function sync() {
  const match = window.location.pathname.match(ARTICLE_RE);
  if (!match) return;
  const sport = match[1].toLowerCase();
  const campaign = CAMPAIGNS[sport];
  if (!campaign) return;

  syncRightRail(campaign, sport);
  syncArticleEnd(campaign, sport);
}

function syncRightRail(campaign, sport) {
  const card = document.querySelector('#pbe-article-rail .par-cta');
  if (!card || card.dataset.pbeSportFunnel === sport) return;

  card.dataset.pbeSportFunnel = sport;
  card.innerHTML = `
    <div class="par-cta-eyebrow">${campaign.eyebrow}</div>
    <h2 class="par-cta-title">${campaign.title}</h2>
    <p class="par-cta-sub">${campaign.sub}</p>
    <a href="${campaign.href}" class="par-cta-btn"${isExternal(campaign.href) ? ' target="_blank" rel="noopener"' : ''}>
      ${campaign.cta}
    </a>
  `;
}

function syncArticleEnd(campaign, sport) {
  let cta = document.querySelector('.article-page .picks-cta');

  if (!cta) {
    const related = document.querySelector('.article-page #related-slot');
    if (!related) return;
    related.insertAdjacentHTML('beforebegin', '<aside class="picks-cta" data-pbe-created-funnel="1"></aside>');
    cta = document.querySelector('.article-page .picks-cta[data-pbe-created-funnel="1"]');
  }

  if (!cta || cta.dataset.pbeSportFunnel === sport) return;
  cta.dataset.pbeSportFunnel = sport;

  const secondary = campaign.secondaryHref
    ? `<a href="${campaign.secondaryHref}" class="btn btn-ghost" target="_blank" rel="noopener">${campaign.secondaryCta}</a>`
    : '';

  cta.innerHTML = `
    <div class="picks-cta-eyebrow">${campaign.eyebrow}</div>
    <h3 class="picks-cta-headline">${campaign.title}</h3>
    <p class="picks-cta-sub">${campaign.sub}</p>
    <div class="picks-cta-buttons">
      <a href="${campaign.href}" class="btn btn-primary"${isExternal(campaign.href) ? ' target="_blank" rel="noopener"' : ''}>${campaign.cta}</a>
      ${secondary}
    </div>
  `;
}

function isExternal(href) {
  return /^https?:\/\//i.test(String(href || ''));
}
