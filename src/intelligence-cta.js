/**
 * src/intelligence-cta.js
 * News -> Intelligence: the one registry and renderer for every "Open {SPORT}
 * Intelligence" call to action on propbetedge.ai.
 *
 * Pure module (no window/document at import) so middleware.js can put the same
 * links in the server render that crawlers see. Destinations are each product's
 * own declared canonical URL, so no CTA ever lands on a redirect: MLB's root
 * 307s to /sharp-tools and declares that as canonical, so MLB links there.
 *
 * Every rendered CTA anchor carries data-pbe-intel-* attributes; analytics.js
 * turns a click on one into exactly one `intelligence_cta_click` event.
 */

export const INTELLIGENCE_SPORTS = Object.freeze({
  mlb: Object.freeze({
    key: 'mlb',
    label: 'MLB',
    emoji: '⚾',
    href: 'https://mlb.propbetedge.ai/sharp-tools',
    domain: 'mlb.propbetedge.ai',
    line: 'Baseball intelligence beyond the box score.',
    deeper: 'Explore MLB Intelligence',
    newsPath: '/news/mlb',
  }),
  nfl: Object.freeze({
    key: 'nfl',
    label: 'NFL',
    emoji: '🏈',
    href: 'https://nfl.propbetedge.ai/',
    domain: 'nfl.propbetedge.ai',
    line: 'Football intelligence beyond the final score.',
    deeper: 'Go deeper with NFL Intelligence',
    newsPath: '/news/nfl',
  }),
  nhl: Object.freeze({
    key: 'nhl',
    label: 'NHL',
    emoji: '🏒',
    href: 'https://nhl.propbetedge.ai/',
    domain: 'nhl.propbetedge.ai',
    line: 'Hockey intelligence beyond the scoreboard.',
    deeper: 'Go deeper with NHL Intelligence',
    newsPath: '/news/nhl',
  }),
  nba: Object.freeze({
    key: 'nba',
    label: 'NBA',
    emoji: '🏀',
    href: 'https://nba.propbetedge.ai/',
    domain: 'nba.propbetedge.ai',
    line: 'Basketball intelligence beyond the box score.',
    deeper: 'Explore NBA Intelligence',
    newsPath: '/news/nba',
  }),
  wnba: Object.freeze({
    key: 'wnba',
    label: 'WNBA',
    emoji: '🏀',
    href: 'https://wnba.propbetedge.ai/',
    domain: 'wnba.propbetedge.ai',
    line: 'Women’s basketball intelligence beyond the box score.',
    deeper: 'Explore WNBA Intelligence',
    newsPath: 'https://wnba.propbetedge.ai/news',
  }),
  ufc: Object.freeze({
    key: 'ufc',
    label: 'UFC',
    emoji: '🥊',
    href: 'https://ufc.propbetedge.ai/',
    domain: 'ufc.propbetedge.ai',
    line: 'Fight intelligence beyond the result.',
    deeper: 'Explore UFC Intelligence',
    newsPath: 'https://ufc.propbetedge.ai/news',
  }),
  tennis: Object.freeze({
    key: 'tennis',
    label: 'Tennis',
    emoji: '🎾',
    href: 'https://tennis.propbetedge.ai/',
    domain: 'tennis.propbetedge.ai',
    line: 'Tennis intelligence beyond the scoreline.',
    deeper: 'Open Tennis Intelligence',
    newsPath: 'https://tennis.propbetedge.ai/news',
  }),
  soccer: Object.freeze({
    key: 'soccer',
    label: 'Soccer',
    emoji: '⚽',
    href: 'https://soccer.propbetedge.ai/',
    domain: 'soccer.propbetedge.ai',
    line: 'Soccer intelligence beyond the scoreline.',
    deeper: 'Open Soccer Intelligence',
    newsPath: 'https://soccer.propbetedge.ai/news',
  }),
  golf: Object.freeze({
    key: 'golf',
    label: 'Golf',
    emoji: '⛳',
    href: 'https://golf.propbetedge.ai/',
    domain: 'golf.propbetedge.ai',
    line: 'Golf intelligence beyond the leaderboard.',
    deeper: 'Open Golf Intelligence',
    newsPath: 'https://golf.propbetedge.ai/news',
  }),
  f1: Object.freeze({
    key: 'f1',
    label: 'F1',
    emoji: '🏎️',
    href: 'https://f1.propbetedge.ai/',
    domain: 'f1.propbetedge.ai',
    line: 'Formula 1 intelligence beyond the timing screen.',
    deeper: 'Open F1 Intelligence',
    newsPath: 'https://f1.propbetedge.ai/news',
  }),
});

export const INTELLIGENCE_ORDER = Object.freeze(['mlb', 'nfl', 'nba', 'wnba', 'nhl', 'ufc', 'tennis', 'soccer', 'golf', 'f1']);

export function intelligenceFor(sport) {
  return INTELLIGENCE_SPORTS[String(sport || '').toLowerCase()] || null;
}

export function ctaLabel(intel) {
  return `Open ${intel.label.toUpperCase()} Intelligence`;
}

/**
 * Analytics attributes. `placement` names the surface (section_hero, section_nav,
 * section_footer, article_end, article_rail, article_footer, header_switcher,
 * mobile_more, network_row); page type and slug describe where the reader was.
 */
export function ctaAttrs(intel, { placement, pageType, slug = '' }) {
  return [
    `data-pbe-intel-cta="${esc(placement)}"`,
    `data-pbe-intel-sport="${esc(intel.key)}"`,
    `data-pbe-intel-page-type="${esc(pageType)}"`,
    slug ? `data-pbe-intel-slug="${esc(slug)}"` : '',
  ].filter(Boolean).join(' ');
}

/** Hero band directly under a /news/{sport} section header. */
export function renderSectionHeroCta(sport, { pageType = 'sport_index' } = {}) {
  const intel = intelligenceFor(sport);
  if (!intel) return '';
  return `
    <aside class="pbe-intel-cta pbe-intel-cta--hero" aria-label="${esc(intel.label)} Intelligence">
      <div class="pbe-intel-cta-copy">
        <span class="pbe-intel-cta-kicker"><span class="pbe-intel-cta-dot" aria-hidden="true"></span>${esc(intel.label.toUpperCase())} INTELLIGENCE</span>
        <p class="pbe-intel-cta-line">${esc(intel.line)}</p>
      </div>
      <a class="pbe-intel-cta-btn" href="${esc(intel.href)}" ${ctaAttrs(intel, { placement: 'section_hero', pageType })}>
        ${esc(ctaLabel(intel))}<span aria-hidden="true">&nbsp;→</span>
      </a>
    </aside>
  `;
}

/** First-class action at the end of the sport section nav. */
export function renderSectionNavCta(sport, { pageType = 'sport_index' } = {}) {
  const intel = intelligenceFor(sport);
  if (!intel) return '';
  return `<a class="section-link pbe-intel-navlink" href="${esc(intel.href)}" ${ctaAttrs(intel, { placement: 'section_nav', pageType })}>
    <span class="pbe-intel-navlink-full">${esc(intel.label.toUpperCase())} Intelligence</span><span class="pbe-intel-navlink-short">Intelligence</span><span aria-hidden="true">&nbsp;→</span>
  </a>`;
}

/** "More than news." closer at the end of a feed or article. */
export function renderMoreThanNewsCta(sport, { placement, pageType, slug = '' }) {
  const intel = intelligenceFor(sport);
  if (!intel) return '';
  return `
    <aside class="pbe-intel-closer" aria-label="${esc(intel.label)} Intelligence">
      <p><span class="pbe-intel-closer-mono">MORE THAN NEWS.</span> Explore ${esc(intel.label)} Intelligence on <span class="pbe-intel-closer-domain">${esc(intel.domain)}</span>.</p>
      <a class="pbe-intel-cta-btn pbe-intel-cta-btn--ghost" href="${esc(intel.href)}" ${ctaAttrs(intel, { placement, pageType, slug })}>
        ${esc(ctaLabel(intel))}<span aria-hidden="true">&nbsp;→</span>
      </a>
    </aside>
  `;
}

/** All live products, for pages that are not about one sport (/news). */
export function renderNetworkIntelligenceRow({ pageType = 'news_index' } = {}) {
  return `
    <nav class="pbe-intel-row" aria-label="PropBetEdge Intelligence products">
      <span class="pbe-intel-cta-kicker"><span class="pbe-intel-cta-dot" aria-hidden="true"></span>MORE THAN NEWS · INTELLIGENCE</span>
      <div class="pbe-intel-row-links">
        ${INTELLIGENCE_ORDER.map((key) => {
          const intel = INTELLIGENCE_SPORTS[key];
          return `<a href="${esc(intel.href)}" ${ctaAttrs(intel, { placement: 'network_row', pageType })}><span aria-hidden="true">${intel.emoji}</span> ${esc(intel.label)} <span aria-hidden="true">→</span></a>`;
        }).join('')}
      </div>
    </nav>
  `;
}

/** Plain server-render link for middleware SSR (crawler-visible). */
export function renderServerIntelligenceLink(sport) {
  const intel = intelligenceFor(sport);
  if (!intel) return '';
  return `<p class="pbe-ssr-intel"><strong>${esc(intel.label)} Intelligence</strong> — ${esc(intel.line)} <a href="${esc(intel.href)}">${esc(ctaLabel(intel))} →</a></p>`;
}

/** Event payload for one CTA anchor. Exported so tests exercise the real path. */
export function intelligenceClickPayload(anchor) {
  const d = anchor?.dataset || {};
  const intel = intelligenceFor(d.pbeIntelSport);
  if (!intel || !d.pbeIntelCta) return null;
  return {
    sport: intel.key,
    source_page_type: d.pbeIntelPageType || '',
    article_slug: d.pbeIntelSlug || '',
    cta_placement: d.pbeIntelCta,
    destination: anchor.href || anchor.getAttribute?.('href') || intel.href,
  };
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
