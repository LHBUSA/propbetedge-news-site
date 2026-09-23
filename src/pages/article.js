/**
 * src/pages/article.js
 * Editorial long-form article — magazine layout with in-content ads
 *
 * v4.0: PropBetEdge content graph
 *       Entity manifest, body entity links, "In this story", entity-aware
 *       related coverage, share controls and article SEO all come from
 *       src/entity-graph/*, the same modules Edge Middleware renders with.
 *       There is no client-only copy of any of that logic to drift against.
 *
 * v3.16: sport-native conversion CTAs at render source
 * v3.15: Media embeds rendered after take callout (MLB.tv + YouTube)
 * v3.14: ESPN-pattern right rail
 */

import { api } from '../api.js';
import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { renderArticleCard, escapeHtml, formatRelative } from '../components/article-card.js';
import { renderRailShell, mountArticleRail } from '../components/right-rail.js';
import { renderNotFound } from './404.js';
import { ad_in_article_after_take, ad_in_article_mid, ad_brand_family, proxyImage } from '../ads-config.js';
import { renderArticleVisuals, mountArticleVisuals } from '../article-visuals.js';

const SPORT_LABELS = { mlb: 'MLB', nfl: 'NFL', nba: 'NBA', nhl: 'NHL' };
const SPORT_FALLBACK = { mlb: '⚾', nfl: '🏈', nba: '🏀', nhl: '🏒' };

// The content graph ships as its own chunk (see src/entity-graph/index.js), so
// pages that never render an article never download the entity dictionary.
let graphPromise = null;
function loadEntityGraph() {
  if (!graphPromise) graphPromise = import('../entity-graph/index.js');
  return graphPromise;
}

export async function renderArticle(root, sport, slug, setMeta) {
  // Skeleton
  root.innerHTML = `
    ${renderHeader()}
    <main>
      <div class="container-narrow article-page">
        <a href="/news/${sport}" class="article-back">← ${SPORT_LABELS[sport] || sport.toUpperCase()}</a>
        <div class="skel skel-line" style="width:30%;height:14px"></div>
        <div class="skel skel-line" style="width:90%;height:54px;margin-top:18px"></div>
        <div class="skel skel-line" style="width:75%;height:54px"></div>
        <div class="skel skel-line" style="width:80%;height:20px;margin-top:18px"></div>
        <div class="skel skel-line" style="width:60%;height:20px"></div>
        <div class="skel skel-card-img" style="margin-top:32px"></div>
      </div>
    </main>
  `;

  // The story payload and the entity graph load together, so resolving
  // entities never adds latency in front of the article itself.
  let resp;
  let graph;
  try {
    [resp, graph] = await Promise.all([api.article(slug), loadEntityGraph()]);
  } catch (e) {
    if (String(e.message).includes('404')) {
      renderNotFound(root);
      return;
    }
    root.querySelector('main').innerHTML = `
      <div class="container-narrow article-page">
        <div class="empty"><h3>Failed to load article</h3><p>${escapeHtml(e.message)}</p></div>
      </div>
    `;
    return;
  }

  const article = resp.article;
  if (!article) { renderNotFound(root); return; }

  const manifest = graph.buildEntityManifest(article);
  const seo = graph.buildArticleSeo(article, manifest);

  if (setMeta) {
    setMeta({
      title: seo.title,
      description: seo.description,
      canonical: seo.canonical,
      ogImage: seo.image.url,
    });
  }
  applySocialMeta(seo);
  applyPrimarySchema(seo);

  const heroImage = article.image_url
    ? `<figure class="article-hero-image">
         <img src="${escapeAttr(proxyImage(article.image_url))}" alt="${escapeAttr(seo.image.alt || article.title)}" class="hero-image-img" width="1200" height="675" onerror="this.classList.add('img-broken')" />
         <div class="img-fallback">${SPORT_FALLBACK[article.sport] || '◆'}</div>
       </figure>`
    : '';

  const articleContext = { sport: article.sport };
  const visualHtml = renderArticleVisuals(article, manifest);
  const bodyHtml = renderBodyWithMidAd(article, articleContext, graph, manifest, seo, visualHtml);

  root.innerHTML = `
    ${renderHeader()}
    <main>
      <div class="article-with-rail">
        <article class="container-narrow article-page fade-in">
          ${renderBreadcrumb(seo.breadcrumbs)}

          <header class="article-hero">
            <div class="article-meta">
              <span class="sport-tag">${escapeHtml(article.sport.toUpperCase())}</span>
              ${article.category && article.category !== 'general'
                ? `<span class="category-tag">${escapeHtml(article.category)}</span>` : ''}
              <span class="date">${formatDate(article.published_at)}</span>
            </div>

            <h1 class="article-title">${escapeHtml(article.title)}</h1>

            ${article.summary
              ? `<p class="article-dek">${escapeHtml(article.summary)}</p>`
              : ''}

            <div class="article-byline">
              <span>By <a href="${escapeAttr(authorHref(article.author))}" class="byline-link"><strong>${escapeHtml(article.author || 'PropBetEdge Editorial Team')}</strong></a></span>
              <span style="color:var(--paper-subtle)">·</span>
              <span>${formatRelative(new Date(article.published_at))}</span>
              ${renderUpdatedStamp(seo)}
            </div>

            ${graph.renderShareBar(seo.canonical, article.title || '')}
          </header>

          <div id="in-this-story-slot">${graph.renderInThisStory(manifest)}</div>

          ${heroImage}

          ${renderTakeCallout(article)}

          ${renderMediaEmbeds(article)}

          ${ad_in_article_after_take(articleContext)}

          ${bodyHtml}

          ${ad_brand_family('end_of_article')}

          ${renderPicksCTA(article)}

          <div id="related-slot"></div>
        </article>

        ${renderRailShell()}
      </div>
    </main>
    ${renderFooter()}
  `;

  graph.mountShareBars(document);

  mountArticleRail({
    currentSlug: article.slug,
    currentSport: article.sport,
  });

  mountArticleVisuals(article, manifest);
  loadRelated(article, manifest, graph);
  attachGameEntity(article, manifest, graph);
}

/**
 * Keep the document's social metadata in step with client-side navigation, so
 * a share from the fifth story a reader opens never carries the first story's
 * card. Same tag set Edge Middleware emits.
 */
function applySocialMeta(seo) {
  for (const [name, content] of [...seo.openGraph, ...seo.twitter]) {
    if (name === 'article:tag') continue; // repeatable — rebuilt below
    const attr = name.startsWith('twitter:') ? 'name' : 'property';
    let el = document.head.querySelector(`meta[${attr}="${name}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, name);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  }

  document.head.querySelectorAll('meta[property="article:tag"]').forEach((el) => el.remove());
  for (const [name, content] of seo.openGraph) {
    if (name !== 'article:tag') continue;
    const el = document.createElement('meta');
    el.setAttribute('property', 'article:tag');
    el.setAttribute('content', content);
    document.head.appendChild(el);
  }
}

/**
 * Exactly one NewsArticle node per page. The server already wrote this element;
 * the client updates it in place instead of appending a second, competing copy.
 */
function applyPrimarySchema(seo) {
  document
    .querySelectorAll('script[type="application/ld+json"][data-managed="jsonld-article"]')
    .forEach((el) => el.remove());

  let script = document.getElementById('pbe-server-primary-schema');
  if (!script) {
    script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'pbe-server-primary-schema';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(seo.jsonLd);
}

function renderBreadcrumb(crumbs) {
  if (!Array.isArray(crumbs) || crumbs.length < 2) return '';
  const items = crumbs.map((crumb, index) => {
    const last = index === crumbs.length - 1;
    const href = crumb.url ? (crumb.url.replace('https://propbetedge.ai', '') || '/') : null;
    if (last || !href) return `<span aria-current="page">${escapeHtml(crumb.name)}</span>`;
    return `<a href="${escapeAttr(href)}">${escapeHtml(crumb.name)}</a>`;
  }).join('<span class="pbe-breadcrumb-sep" aria-hidden="true">›</span>');
  return `<nav class="pbe-breadcrumb" aria-label="Breadcrumb">${items}</nav>`;
}

function renderUpdatedStamp(seo) {
  if (!seo.modifiedTime || !seo.publishedTime || seo.modifiedTime === seo.publishedTime) return '';
  const date = new Date(seo.modifiedTime);
  if (!Number.isFinite(date.getTime())) return '';
  const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `<span style="color:var(--paper-subtle)">·</span>
      <span class="article-updated">Updated <time datetime="${escapeAttr(seo.modifiedTime)}">${escapeHtml(label)}</time></span>`;
}

/**
 * Attach the matchup entity once it resolves. Deliberately after paint: a game
 * chip is worth one extra request, never a delay in front of the story.
 */
async function attachGameEntity(article, manifest, graph) {
  try {
    const enriched = await graph.enrichManifestWithGame(article, manifest, { timeoutMs: 2500 });
    if (!enriched?.games?.length) return;
    const slot = document.getElementById('in-this-story-slot');
    if (!slot) return;
    slot.innerHTML = graph.renderInThisStory(enriched);
  } catch { /* a missing game chip is not a page error */ }
}

// v3.15: Render legal video/social embeds (MLB.tv + YouTube official)
function renderMediaEmbeds(article) {
  const embeds = Array.isArray(article.media_embeds) ? article.media_embeds : [];
  if (!embeds.length) return '';

  const cards = embeds.map((e) => {
    if (e.type === 'youtube') {
      return `
        <div class="media-card media-youtube">
          <div class="media-youtube-frame">
            <iframe
              src="${escapeAttr(e.embedUrl)}"
              title="${escapeAttr(e.title)}"
              loading="lazy"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen
            ></iframe>
          </div>
          <div class="media-meta">
            <span class="media-source">${escapeHtml(e.channelName || 'YouTube')}</span>
            <span class="media-title">${escapeHtml(e.title)}</span>
          </div>
        </div>
      `;
    }
    if (e.type === 'mlbtv') {
      return `
        <a href="${escapeAttr(e.url)}" target="_blank" rel="noopener" class="media-card media-mlbtv">
          <div class="mlbtv-icon">📺</div>
          <div class="mlbtv-text">
            <div class="mlbtv-title">${escapeHtml(e.title)}</div>
            <div class="mlbtv-cta">${escapeHtml(e.cta || 'Watch official highlights')} →</div>
          </div>
        </a>
      `;
    }
    return '';
  }).filter(Boolean).join('');

  if (!cards) return '';

  return `
    <section class="article-media">
      <div class="article-media-header">
        <h3 class="article-media-heading">Watch</h3>
        <span class="article-media-sub">Official highlights & source video</span>
      </div>
      <div class="article-media-grid">${cards}</div>
      <div class="article-media-disclaimer">Videos hosted by official sources (MLB, YouTube). PropBetEdge does not own or distribute the underlying video content.</div>
    </section>
  `;
}

function renderBodyWithMidAd(article, ctx, graph, manifest, seo, visualHtml = '') {
  // Body markup and entity linking both come from the shared graph modules, so
  // this is byte-identical to the markup the crawler already received.
  const source = graph.articleBodyHtml(article);
  const html = source
    ? graph.linkifyArticleHtml(source, manifest, { excludeUrls: [seo.canonical] }).html
    : '';

  if (!html) return '';

  const paragraphs = html.split(/(<\/p>)/);
  let pCount = 0;
  let injectIdx = -1;
  for (let i = 0; i < paragraphs.length; i++) {
    if (paragraphs[i] === '</p>') {
      pCount++;
      if (pCount === 3) {
        injectIdx = i + 1;
        break;
      }
    }
  }

  const totalParagraphs = (html.match(/<\/p>/g) || []).length;
  if (injectIdx === -1 || totalParagraphs < 5) {
    return `<div class="article-body">${html}</div>${visualHtml}`;
  }

  const before = paragraphs.slice(0, injectIdx).join('');
  const after = paragraphs.slice(injectIdx).join('');
  return `
    <div class="article-body">${before}</div>
    ${visualHtml}
    ${ad_in_article_mid(ctx)}
    <div class="article-body">${after}</div>
  `;
}

function isSpeculativeMarketAdvice(value) {
  const text = String(value || '');
  return /\b(?:when (?:the )?line sets|when lines? open|if (?:the )?line (?:sets|opens)|expect(?:ed)?\s+\d|typically\s+\d|project(?:ed|ion)|forecast|should open|likely (?:open|price)|market will likely price|range)\b/i.test(text)
    || /\d+(?:\.\d+)?\s*(?:to|[-–—])\s*\d+(?:\.\d+)?/.test(text);
}

function renderTakeCallout(article) {
  if (!article.take?.summary) {
    return `
      <div class="ai-take-callout" style="opacity:0.5">
        <div class="ai-take-callout-header">
          <div class="ai-take-callout-icon">⚡</div>
          <div class="ai-take-callout-label">PBE Analysis</div>
        </div>
        <p class="ai-take-summary" style="font-size:15px;font-style:normal;font-weight:500">
          Analysis being generated — check back in a few minutes.
        </p>
      </div>
    `;
  }

  const t = article.take;
  const adviceIsScenario = isSpeculativeMarketAdvice(t.advice);
  const tags = [];
  if (Array.isArray(t.players)) {
    for (const p of t.players.slice(0, 4)) tags.push(`<span class="ai-take-tag">${escapeHtml(p)}</span>`);
  }
  if (Array.isArray(t.teams)) {
    for (const team of t.teams.slice(0, 3)) tags.push(`<span class="ai-take-tag">${escapeHtml(team)}</span>`);
  }
  if (Array.isArray(t.prop_types)) {
    for (const pt of t.prop_types.slice(0, 4)) {
      tags.push(`<span class="ai-take-tag">${escapeHtml(formatPropType(pt))}</span>`);
    }
  }

  return `
    <aside class="ai-take-callout">
      <div class="ai-take-callout-header">
        <div class="ai-take-callout-icon">⚡</div>
        <div class="ai-take-callout-label">PBE Analysis</div>
        <div class="ai-take-callout-impact">Impact <strong>${t.impact_score}/5</strong></div>
      </div>
      <p class="ai-take-summary">${escapeHtml(t.summary)}</p>
      ${t.advice ? `
        <div class="ai-take-advice${adviceIsScenario ? ' ai-take-advice--scenario' : ''}">
          <span class="label">${adviceIsScenario ? 'Model Scenario' : 'The Angle'}</span>
          ${escapeHtml(t.advice)}
          ${adviceIsScenario ? '<small class="ai-take-advice-note">Scenario only · not a live market quote.</small>' : ''}
        </div>
      ` : ''}
      ${tags.length ? `<div class="ai-take-tags">${tags.join('')}</div>` : ''}
    </aside>
  `;
}

function renderPicksCTA(article) {
  const sportPicksMap = {
    mlb: {
      url: 'https://mlb.propbetedge.ai/picks',
      label: 'MLB Picks Tonight',
      secondaryUrl: 'https://mlb.propbetedge.ai/askalgo',
      secondaryLabel: 'Ask The Algo',
    },
    nfl: {
      url: 'https://nfl.propbetedge.ai/#picks',
      label: 'NFL Picks This Week',
      secondaryUrl: 'https://nfl.propbetedge.ai/#propboard',
      secondaryLabel: 'See Live Prop Board',
    },
  };
  const cta = sportPicksMap[article.sport];
  if (!cta) return '';

  const personalized = article.take?.players?.length
    ? `Open the live ${article.sport.toUpperCase()} model card to see whether current angles involve ${escapeHtml(article.take.players.slice(0, 2).join(' & '))}.`
    : `Open the live ${article.sport.toUpperCase()} model card for current picks and market context.`;

  return `
    <aside class="picks-cta">
      <div class="picks-cta-eyebrow">⚡ The Same Brain</div>
      <h3 class="picks-cta-headline">Take the story into the live model.</h3>
      <p class="picks-cta-sub">${personalized} Recorded picks are graded against live odds.</p>
      <div class="picks-cta-buttons">
        <a href="${cta.url}" class="btn btn-primary" target="_blank" rel="noopener">${cta.label} →</a>
        <a href="${cta.secondaryUrl}" class="btn btn-ghost" target="_blank" rel="noopener">${cta.secondaryLabel}</a>
      </div>
    </aside>
  `;
}

/**
 * Related coverage, scored against the entity graph rather than "four more
 * stories from this sport". Candidates come from structured entity queries
 * first, with the league feed as a backstop.
 */
async function loadRelated(article, manifest, graph) {
  try {
    const player = (manifest.players || []).find((p) => p.origin !== 'text') || (manifest.players || [])[0];
    const team = (manifest.teams || []).find((t) => t.origin !== 'text') || (manifest.teams || [])[0];

    const pools = await Promise.all([
      player?.name ? api.byPlayerEntity(player.name).catch(() => null) : null,
      team?.abbreviation
        ? api.byTeamEntity(graph.teamQueryAbbreviations(article.sport, team.abbreviation)).catch(() => null)
        : null,
      api.newsBySport(article.sport, 12).catch(() => null),
    ]);

    const seen = new Set([article.slug]);
    const candidates = [];
    for (const pool of pools) {
      for (const row of pool?.articles || []) {
        if (!row?.slug || seen.has(row.slug)) continue;
        seen.add(row.slug);
        candidates.push(row);
      }
    }

    const related = graph.rankRelated(article, manifest, candidates, { limit: 6 });
    const slot = document.getElementById('related-slot');
    if (!slot) return;

    const explore = (related.explore || [])
      .map((link) => `<a href="${escapeAttr(link.href)}" class="pbe-related-explore-link">${escapeHtml(link.label)}</a>`)
      .join('');

    if (!related.items.length) {
      slot.innerHTML = explore
        ? `<nav class="pbe-related-explore" aria-label="More coverage">${explore}</nav>`
        : '';
      return;
    }

    slot.innerHTML = `
      <section class="pbe-related" aria-labelledby="pbe-related-heading">
        <div class="section-heading" style="margin-top:64px">
          <h2 id="pbe-related-heading">${escapeHtml(related.heading)}</h2>
          <a href="/news/${article.sport}" class="more-link">All ${article.sport.toUpperCase()} →</a>
        </div>
        <div class="article-grid fade-stagger">
          ${related.items.map(({ article: a }) => renderArticleCard(a)).join('')}
        </div>
        ${explore ? `<nav class="pbe-related-explore" aria-label="More coverage">${explore}</nav>` : ''}
      </section>
    `;
  } catch (e) { /* silent */ }
}

function authorHref(name) {
  if (!name) return '/authors/propbetedge-editorial-team';
  const slug = String(name).toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
  return `/authors/${slug}`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function formatPropType(p) {
  const map = {
    k_prop: 'Strikeouts',
    hr: 'Home Runs',
    altprop_hits: 'Hits',
    altprop_total_bases: 'Total Bases',
    altprop_doubles: 'Doubles',
    altprop_rbi: 'RBI',
    altprop_runs: 'Runs',
    altprop_walks: 'Walks',
    stolen_bases: 'Stolen Bases',
    team_total: 'Team Total',
    spread: 'Spread',
    moneyline: 'Moneyline',
    first_5_innings: 'First 5 Innings',
    nrfi: 'NRFI',
    passing_yards: 'Passing Yards',
    passing_tds: 'Passing TDs',
    rushing_yards: 'Rushing Yards',
    rushing_tds: 'Rushing TDs',
    receiving_yards: 'Receiving Yards',
    receptions: 'Receptions',
    receiving_tds: 'Receiving TDs',
    anytime_td: 'Anytime TD',
    sacks: 'Sacks',
    points: 'Points',
    rebounds: 'Rebounds',
    assists: 'Assists',
    threes_made: '3PM',
    pra: 'PRA',
    shots_on_goal: 'Shots on Goal',
    goals: 'Goals',
    saves: 'Saves',
  };
  return map[p] || p.replace(/_/g, ' ');
}

function escapeAttr(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
