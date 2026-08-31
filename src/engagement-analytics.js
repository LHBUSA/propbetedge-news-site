let articleKey = '';
let reached = new Set();
let timers = [];
let installed = false;

export function initEngagementAnalytics() {
  if (installed) return;
  installed = true;
  window.addEventListener('scroll', handleScroll, { passive: true });
  window.addEventListener('popstate', resetArticleSession);
  window.addEventListener('pbe:team-follow-changed', (event) => {
    send('team_follow_changed', {
      sport: event.detail?.sport || '',
      team: event.detail?.team || '',
      page_path: window.location.pathname,
    });
  });
  document.addEventListener('click', handleIntelligenceClick, true);
  new MutationObserver(resetIfRouteChanged).observe(document.documentElement, { childList: true, subtree: true });
  resetArticleSession();
}

function currentArticle() {
  const match = window.location.pathname.match(/^\/news\/(mlb|nfl|nba|nhl)\/([^/]+)\/?$/i);
  return match ? { sport: match[1].toLowerCase(), slug: decodeURIComponent(match[2]) } : null;
}

function resetIfRouteChanged() {
  const article = currentArticle();
  const key = article ? `${article.sport}:${article.slug}` : '';
  if (key !== articleKey) resetArticleSession();
}

function resetArticleSession() {
  timers.forEach(clearTimeout);
  timers = [];
  reached = new Set();
  const article = currentArticle();
  articleKey = article ? `${article.sport}:${article.slug}` : '';
  if (!article) return;

  timers.push(setTimeout(() => sendDwell(30), 30000));
  timers.push(setTimeout(() => sendDwell(60), 60000));
  timers.push(setTimeout(() => sendDwell(120), 120000));
  setTimeout(handleScroll, 500);
}

function sendDwell(seconds) {
  const article = currentArticle();
  if (!article || document.hidden || `${article.sport}:${article.slug}` !== articleKey) return;
  send('article_engaged_time', {
    sport: article.sport,
    article_slug: article.slug,
    seconds,
  });
}

function handleScroll() {
  const article = currentArticle();
  const page = document.querySelector('.article-page');
  if (!article || !page) return;
  const rect = page.getBoundingClientRect();
  const pageTop = window.scrollY + rect.top;
  const pageHeight = Math.max(page.scrollHeight, rect.height, 1);
  const viewed = Math.max(0, Math.min(pageHeight, window.scrollY + window.innerHeight - pageTop));
  const percent = Math.round((viewed / pageHeight) * 100);

  for (const threshold of [25, 50, 75, 100]) {
    if (percent >= threshold && !reached.has(threshold)) {
      reached.add(threshold);
      send('article_scroll_depth', {
        sport: article.sport,
        article_slug: article.slug,
        percent: threshold,
      });
    }
  }
}

function handleIntelligenceClick(event) {
  const anchor = event.target?.closest?.('a[href]');
  if (!anchor) return;

  let surface = '';
  if (anchor.closest('.pbe-impact-graph')) surface = 'impact_graph';
  else if (anchor.closest('#pbe-my-edge')) surface = 'my_edge';
  else if (anchor.classList.contains('pbe-standings-row')) surface = 'standings';
  else if (anchor.classList.contains('pbe-team-game')) surface = 'team_schedule';
  else if (anchor.closest('.pbe-team-model-card')) surface = 'team_model_card';
  if (!surface) return;

  send('intelligence_click', {
    surface,
    link_url: anchor.href || anchor.getAttribute('href') || '',
    link_text: clean(anchor.textContent),
    page_path: window.location.pathname,
  });
}

function send(name, params) {
  if (typeof window.gtag !== 'function') return;
  window.gtag('event', name, params);
}

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 160);
}
