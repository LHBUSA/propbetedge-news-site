/**
 * src/pages/article.js
 * Editorial long-form article — magazine layout with in-content ads
 *
 * v3.14: 🆕 Added ESPN-pattern right rail (Top Headlines + Model Notes + soft CTA)
 *        on desktop ≥1100px. Single column on mobile/tablet. Zero new API endpoints —
 *        rail filters api.homepage() client-side using existing take.advice field.
 */

import { api } from '../api.js';
import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { renderArticleCard, escapeHtml, formatRelative } from '../components/article-card.js';
import { renderRailShell, mountArticleRail } from '../components/right-rail.js';
import { renderNotFound } from './404.js';
import { ad_in_article_after_take, ad_in_article_mid, ad_brand_family, proxyImage } from '../ads-config.js';
import {
  organizationSchema, websiteSchema, breadcrumbSchema,
  newsArticleSchema, injectSchemas,
} from '../schema.js';

const SPORT_LABELS = { mlb: 'MLB', nfl: 'NFL', nba: 'NBA', nhl: 'NHL' };
const SPORT_FALLBACK = { mlb: '⚾', nfl: '🏈', nba: '🏀', nhl: '🏒' };

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

  let resp;
  try {
    resp = await api.article(slug);
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

  if (setMeta) {
    setMeta({
      title: `${article.title} — PropBetEdge`,
      description: article.take?.summary || article.summary || `Latest ${article.sport.toUpperCase()} news with AI prop-bet impact analysis.`,
      canonical: article.url || `https://propbetedge.ai/news/${article.sport}/${article.slug}`,
      ogImage: article.image_url || null,
    });
  }

  // 🆕 v3.9.6: Rich schema injection — article + breadcrumbs + org + website
  const sportLabel = sport.toUpperCase();
  injectSchemas([
    organizationSchema(),
    websiteSchema(),
    newsArticleSchema(article, sport, slug),
    breadcrumbSchema([
      { name: 'Home', url: '/' },
      { name: `${sportLabel} News`, url: `/news/${sport}` },
      { name: article.title },
    ]),
  ], 'jsonld-article');

  const heroImage = article.image_url
    ? `<figure class="article-hero-image">
         <img src="${escapeAttr(proxyImage(article.image_url))}" alt="${escapeAttr(article.title)}" class="hero-image-img" onerror="this.classList.add('img-broken')" />
         <div class="img-fallback">${SPORT_FALLBACK[article.sport] || '◆'}</div>
       </figure>`
    : '';

  const articleContext = { sport: article.sport };
  const bodyHtml = renderBodyWithMidAd(article, articleContext);

  root.innerHTML = `
    ${renderHeader()}
    <main>
      <div class="article-with-rail">
        <article class="container-narrow article-page fade-in">
          <a href="/news/${article.sport}" class="article-back">← ${SPORT_LABELS[article.sport] || article.sport.toUpperCase()}</a>

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
            </div>
          </header>

          ${heroImage}

          ${renderTakeCallout(article)}

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

  // Mount the rail — fetches in background, swaps skeletons for live content
  mountArticleRail({
    currentSlug: article.slug,
    currentSport: article.sport,
  });

  loadRelated(article);
}

/**
 * Splits the article body and injects a mid-article ad after the 3rd paragraph.
 * Falls back to no ad if body is too short.
 */
function renderBodyWithMidAd(article, ctx) {
  const html = article.body_html
    ? article.body_html
    : article.body
    ? renderBodyMarkdown(article.body)
    : article.source_url
    ? `<p>${article.summary ? escapeHtml(article.summary) : 'No summary available.'}</p>
       <p><a href="${escapeAttr(article.source_url)}" target="_blank" rel="noopener nofollow">Read the full story at ${escapeHtml(extractDomain(article.source_url))} →</a></p>`
    : '';

  if (!html) return '';

  // Split body into paragraphs
  const paragraphs = html.split(/(<\/p>)/);
  // Find the index after the 3rd </p>
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

  // If body has fewer than 5 paragraphs, skip the mid-ad to avoid stuffing
  const totalParagraphs = (html.match(/<\/p>/g) || []).length;
  if (injectIdx === -1 || totalParagraphs < 5) {
    return `<div class="article-body">${html}</div>`;
  }

  const before = paragraphs.slice(0, injectIdx).join('');
  const after = paragraphs.slice(injectIdx).join('');
  return `
    <div class="article-body">${before}</div>
    ${ad_in_article_mid(ctx)}
    <div class="article-body">${after}</div>
  `;
}

function renderTakeCallout(article) {
  if (!article.take?.summary) {
    return `
      <div class="ai-take-callout" style="opacity:0.5">
        <div class="ai-take-callout-header">
          <div class="ai-take-callout-icon">⚡</div>
          <div class="ai-take-callout-label">Prop-Bet Take</div>
        </div>
        <p class="ai-take-summary" style="font-size:15px;font-style:normal;font-weight:500">
          AI analysis being generated — check back in a few minutes.
        </p>
      </div>
    `;
  }

  const t = article.take;
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
        <div class="ai-take-callout-label">Bettor's Edge · AI Analysis</div>
        <div class="ai-take-callout-impact">Impact <strong>${t.impact_score}/5</strong></div>
      </div>
      <p class="ai-take-summary">${escapeHtml(t.summary)}</p>
      ${t.advice ? `
        <div class="ai-take-advice">
          <span class="label">The Angle</span>
          ${escapeHtml(t.advice)}
        </div>
      ` : ''}
      ${tags.length ? `<div class="ai-take-tags">${tags.join('')}</div>` : ''}
    </aside>
  `;
}

function renderPicksCTA(article) {
  const sportPicksMap = {
    mlb: { url: 'https://mlb.propbetedge.ai/picks', label: 'MLB Picks Tonight' },
    nfl: { url: 'https://nfl.propbetedge.ai',       label: 'NFL Picks This Week' },
  };
  const cta = sportPicksMap[article.sport];
  if (!cta) return '';

  const personalized = article.take?.players?.length
    ? `Tonight's ${article.sport.toUpperCase()} model card includes angles on ${escapeHtml(article.take.players.slice(0, 2).join(' & '))}.`
    : `See how this story affects tonight's ${article.sport.toUpperCase()} picks.`;

  return `
    <aside class="picks-cta">
      <div class="picks-cta-eyebrow">⚡ The Same Brain</div>
      <h3 class="picks-cta-headline">Bet smarter on tonight's slate.</h3>
      <p class="picks-cta-sub">${personalized} The same AI behind this take grades model picks against live odds, 24/7.</p>
      <div class="picks-cta-buttons">
        <a href="${cta.url}" class="btn btn-primary" target="_blank" rel="noopener">${cta.label} →</a>
        <a href="https://mlb.propbetedge.ai/askalgo" class="btn btn-ghost" target="_blank" rel="noopener">Ask The Algo</a>
      </div>
    </aside>
  `;
}

async function loadRelated(article) {
  try {
    const data = await api.newsBySport(article.sport, 4);
    const related = (data.articles || [])
      .filter((a) => a.slug !== article.slug)
      .slice(0, 3);
    if (!related.length) return;
    const slot = document.getElementById('related-slot');
    if (!slot) return;
    slot.innerHTML = `
      <div class="section-heading" style="margin-top:64px">
        <h2>More ${article.sport.toUpperCase()}</h2>
        <a href="/news/${article.sport}" class="more-link">All ${article.sport.toUpperCase()} →</a>
      </div>
      <div class="article-grid fade-stagger">
        ${related.map((a) => renderArticleCard(a)).join('')}
      </div>
    `;
  } catch (e) { /* silent */ }
}

// Convert any author name to its profile URL
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

function extractDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return url; }
}

function formatPropType(p) {
  const map = {
    k_prop: 'Strikeouts',
    hr: 'Home Runs',
    altprop_hits: 'Hits',
    altprop_total_bases: 'Total Bases',
    altprop_doubles: 'Doubles',
    altprop_rbi: 'RBI',
    team_total: 'Team Total',
    spread: 'Spread',
    moneyline: 'Moneyline',
  };
  return map[p] || p.replace(/_/g, ' ');
}

function escapeAttr(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function renderBodyMarkdown(md) {
  if (!md) return '';
  let h = String(md).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  h = h.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  h = h.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');
  h = h.replace(/`([^`]+)`/g, '<code>$1</code>');
  h = h.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  h = h.replace(/^- (.+)$/gm, '<li>$1</li>');
  h = h.replace(/(<li>[\s\S]+?<\/li>)/g, (m) => `<ul>${m}</ul>`);
  h = h.replace(/<\/ul>\s*<ul>/g, '');
  h = h.split(/\n\n+/).map((p) => {
    if (/^<(h\d|ul|ol|blockquote|pre)/i.test(p.trim())) return p;
    if (!p.trim()) return '';
    return `<p>${p.replace(/\n/g, '<br>')}</p>`;
  }).join('\n');
  return h;
}
