/*
 * NFL launch priority layer
 *
 * Football is the next major PropBetEdge product launch. This keeps generic
 * network surfaces NFL-first without breaking sport-aware conversion on MLB,
 * NBA or NHL pages. It is intentionally isolated so launch messaging can be
 * adjusted later without touching the underlying ad / article systems.
 */

const NFL_URL = 'https://nfl.propbetedge.ai';
const NFL_TRACKED = 'https://nfl.propbetedge.ai/?utm_source=propbetedge&utm_medium=house_ad&utm_campaign=nfl_launch_priority';

let timer = null;
let observer = null;

export function initNflLaunchPriority() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  schedule();
  window.addEventListener('popstate', schedule);

  observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(sync, 60);
}

function sync() {
  const sport = sportFromPath(window.location.pathname);

  // Generic network surfaces should lead with the next major launch.
  // Sport-specific surfaces retain their own product context.
  if (!sport) {
    syncGenericHeader();
    syncGenericNetworkAds();
  }

  syncFooterPriority();
  syncGamesPriority();
}

function syncGenericHeader() {
  const cta = document.querySelector('.masthead .nav-link.cta');
  if (cta && cta.dataset.pbeNflPriority !== '1') {
    cta.dataset.pbeNflPriority = '1';
    cta.href = NFL_TRACKED;
    cta.target = '_blank';
    cta.rel = 'noopener';
    cta.textContent = 'NFL Intelligence →';
  }

  const banner = document.querySelector('.ad-banner');
  if (!banner || banner.dataset.pbeNflPriority === '1') return;

  banner.dataset.pbeNflPriority = '1';
  banner.href = NFL_TRACKED;
  banner.target = '_blank';
  banner.rel = 'noopener sponsored';

  const eyebrow = banner.querySelector('.ad-banner-eyebrow');
  const headline = banner.querySelector('.ad-banner-headline');
  const bannerCta = banner.querySelector('.ad-banner-cta');

  if (eyebrow) eyebrow.textContent = '🏈 PROPBETEDGE NFL · NEXT UP';
  if (headline) headline.textContent = 'Football is the next major PropBetEdge launch — built for deeper game and prop intelligence.';
  if (bannerCta) bannerCta.textContent = 'Open NFL Intelligence →';
}

function syncGenericNetworkAds() {
  document.querySelectorAll('.ad-brand-family[data-ad-sport="network"][data-ad-brand="propbetedge_network"]').forEach((ad) => {
    if (ad.dataset.pbeNflPriority === '1') return;
    ad.dataset.pbeNflPriority = '1';
    ad.href = NFL_TRACKED;

    const eyebrow = ad.querySelector('.ad-block-eyebrow');
    const headline = ad.querySelector('.ad-block-headline');
    const sub = ad.querySelector('.ad-block-sub');
    const cta = ad.querySelector('.ad-block-cta');

    if (eyebrow) eyebrow.textContent = '🏈 PROPBETEDGE NFL · NEXT UP';
    if (headline) headline.textContent = 'Football intelligence is the next major PropBetEdge launch.';
    if (sub) sub.textContent = 'Model Lab, Market Watch, line simulation, SGP research and live game context — connected inside one football intelligence layer.';
    if (cta) cta.textContent = 'Open NFL Intelligence →';
  });
}

function syncFooterPriority() {
  const footerCta = document.querySelector('.footer-cta');
  if (footerCta) {
    const eyebrow = footerCta.querySelector('.footer-cta-eyebrow');
    const headline = footerCta.querySelector('.footer-cta-headline');
    const sub = footerCta.querySelector('.footer-cta-sub');
    const buttons = footerCta.querySelector('.footer-cta-buttons');
    const nfl = buttons?.querySelector('.footer-cta-btn-nfl');
    const mlb = buttons?.querySelector('.footer-cta-btn-mlb');

    if (eyebrow) eyebrow.textContent = '🏈 NFL INTELLIGENCE · NEXT MAJOR LAUNCH';
    if (headline) headline.textContent = 'Football is the next major play.';
    if (sub) sub.textContent = 'Go from NFL headlines into Model Lab, Market Watch, simulation, SGP research and deeper football intelligence. MLB remains live behind it.';

    if (nfl) {
      nfl.href = NFL_TRACKED;
      const label = nfl.querySelector('span:last-child');
      if (label) label.textContent = 'NFL · Next Up';
      if (buttons && buttons.firstElementChild !== nfl) buttons.insertBefore(nfl, buttons.firstElementChild);
    }

    if (mlb) {
      const label = mlb.querySelector('span:last-child');
      if (label) label.textContent = 'MLB · Live';
    }
  }

  const sportsColumn = [...document.querySelectorAll('.footer-col')].find((col) =>
    col.querySelector('h4')?.textContent?.includes('Sports Intelligence')
  );

  if (sportsColumn) {
    const links = [...sportsColumn.querySelectorAll('a')];
    const nflLink = links.find((link) => /NFL Intelligence/i.test(link.textContent || ''));
    const mlbLink = links.find((link) => /MLB Intelligence/i.test(link.textContent || ''));

    if (nflLink) {
      nflLink.href = NFL_URL;
      nflLink.target = '_blank';
      nflLink.rel = 'noopener';
      nflLink.innerHTML = 'NFL Intelligence <span class="footer-badge">Next Up</span>';
      const heading = sportsColumn.querySelector('h4');
      if (heading?.nextSibling !== nflLink) sportsColumn.insertBefore(nflLink, heading?.nextSibling || sportsColumn.firstChild);
    }

    if (mlbLink) {
      mlbLink.innerHTML = 'MLB Intelligence <span class="footer-badge">Live</span>';
    }
  }
}

function syncGamesPriority() {
  const grid = document.querySelector('.gh5-network-grid');
  if (!grid) return;

  const nfl = grid.querySelector('.gh5-network-card.nfl');
  const mlb = grid.querySelector('.gh5-network-card.mlb');

  if (nfl) {
    nfl.href = NFL_URL;
    const kicker = nfl.querySelector('span');
    const title = nfl.querySelector('strong');
    const copy = nfl.querySelector('p');
    const cta = nfl.querySelector('b');

    if (kicker) kicker.textContent = '🏈 NFL · NEXT MAJOR LAUNCH';
    if (title) title.textContent = 'NFL Intelligence';
    if (copy) copy.textContent = 'Model Lab, Market Watch, line simulation, SGP research and deeper football intelligence.';
    if (cta) cta.textContent = 'Open NFL →';

    if (grid.firstElementChild !== nfl) grid.insertBefore(nfl, grid.firstElementChild);
  }

  if (mlb) {
    const kicker = mlb.querySelector('span');
    if (kicker) kicker.textContent = '⚾ MLB · LIVE NOW';
  }
}

function sportFromPath(pathname) {
  const match = String(pathname || '').match(/\/(?:news|games|leaders)\/(mlb|nfl|nba|nhl)(?:\/|$)/i);
  return match?.[1]?.toLowerCase() || null;
}
