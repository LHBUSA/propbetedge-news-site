/* PropBetEdge production analytics
 * Tracks SPA page views and the conversion events that matter to the sports funnel.
 * GA4 is loaded in index.html; this module adds virtual navigation + CTA events.
 */

let installed = false;
let lastTrackedUrl = '';

export function initAnalytics() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  patchHistory();
  window.addEventListener('popstate', () => schedulePageView('popstate'));
  window.addEventListener('pbe:analytics-pageview', () => schedulePageView('app'));
  document.addEventListener('click', handleClick, true);
}

function gtagEvent(name, params = {}) {
  if (typeof window.gtag !== 'function') return;
  window.gtag('event', name, params);
}

function schedulePageView(reason) {
  // Article metadata is populated after its API fetch. Give the route enough
  // time to settle so page_title reflects the page the reader actually sees.
  window.setTimeout(() => trackPageView(reason), 350);
}

function trackPageView(reason) {
  const url = window.location.href;
  if (url === lastTrackedUrl) return;
  lastTrackedUrl = url;

  gtagEvent('page_view', {
    page_location: url,
    page_path: window.location.pathname + window.location.search,
    page_title: document.title,
    navigation_type: reason,
  });
}

function patchHistory() {
  for (const method of ['pushState', 'replaceState']) {
    const original = window.history[method];
    if (typeof original !== 'function' || original.__pbeWrapped) continue;

    const wrapped = function (...args) {
      const result = original.apply(this, args);
      schedulePageView(method);
      return result;
    };
    wrapped.__pbeWrapped = true;
    window.history[method] = wrapped;
  }
}

function handleClick(event) {
  const anchor = event.target?.closest?.('a[href]');
  if (!anchor) return;

  const href = anchor.href || anchor.getAttribute('href') || '';
  if (!href) return;

  const ad = anchor.closest?.('[data-ad-slot]');
  if (ad) {
    gtagEvent('house_ad_click', {
      ad_slot: ad.dataset.adSlot || '',
      ad_brand: ad.dataset.adBrand || '',
      sport: ad.dataset.adSport || '',
      link_url: href,
      link_text: cleanText(anchor.textContent),
    });
  }

  if (anchor.classList.contains('footer-cta-btn')) {
    gtagEvent('network_cta_click', {
      placement: 'footer_network',
      link_url: href,
      link_text: cleanText(anchor.textContent),
      destination: destinationFor(href),
    });
  }

  if (anchor.matches('.nav-link.cta')) {
    gtagEvent('network_cta_click', {
      placement: 'header',
      link_url: href,
      link_text: cleanText(anchor.textContent),
      destination: destinationFor(href),
    });
  }

  if (anchor.closest('.picks-cta, .par-cta')) {
    gtagEvent('product_cta_click', {
      placement: anchor.closest('.par-cta') ? 'article_rail' : 'article_end',
      link_url: href,
      link_text: cleanText(anchor.textContent),
      destination: destinationFor(href),
    });
  }

  if (anchor.matches('.article-card, .lead-story, .sidebar-story, .par-headline, .par-note')) {
    gtagEvent('story_click', {
      placement: storyPlacement(anchor),
      link_url: href,
      link_text: cleanText(anchor.querySelector('h1,h2,h3')?.textContent || anchor.textContent),
    });
  }

  try {
    const url = new URL(href, window.location.origin);
    if (url.origin !== window.location.origin) {
      gtagEvent('outbound_click', {
        link_url: url.href,
        link_domain: url.hostname,
        destination: destinationFor(url.href),
        link_text: cleanText(anchor.textContent),
      });
    }
  } catch {}
}

function destinationFor(href) {
  try {
    const host = new URL(href, window.location.origin).hostname.toLowerCase();
    if (host === 'mlb.propbetedge.ai') return 'mlb';
    if (host === 'nfl.propbetedge.ai') return 'nfl';
    if (host === 'nba.propbetedge.ai') return 'nba';
    if (host === 'nhl.propbetedge.ai') return 'nhl';
    if (host === 'propsports.proptechusa.ai') return 'propsports';
    if (host.includes('rapidapi.com')) return 'sports_news_api';
    return host;
  } catch {
    return '';
  }
}

function storyPlacement(anchor) {
  if (anchor.classList.contains('lead-story')) return 'hero';
  if (anchor.classList.contains('sidebar-story')) return 'sidebar';
  if (anchor.classList.contains('par-headline')) return 'article_rail_headline';
  if (anchor.classList.contains('par-note')) return 'article_rail_model_note';
  if (anchor.classList.contains('article-card')) return 'story_grid';
  return 'unknown';
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 180);
}
