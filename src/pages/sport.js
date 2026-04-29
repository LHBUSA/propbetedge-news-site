/**
 * src/pages/sport.js
 * Sport-section landing — like a magazine section front
 */

import { api } from '../api.js';
import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { renderArticleCard, renderSidebarStory, escapeHtml, formatRelative } from '../components/article-card.js';
import { proxyImage } from '../ads-config.js';
import {
  organizationSchema, websiteSchema, breadcrumbSchema,
  collectionPageSchema, injectSchemas,
} from '../schema.js';

const SPORT_FALLBACK = { mlb: '⚾', nfl: '🏈', nba: '🏀', nhl: '🏒' };
const SPORT_TAGLINES = {
  mlb: 'Strikeouts, home runs, hits, total bases — all the angles for tonight\'s diamond.',
  nfl: 'Yards, touchdowns, anytime scorers — the Sunday slate broken down.',
  nba: 'Points, assists, rebounds, threes — every angle on the hardwood.',
  nhl: 'Shots on goal, goals, saves — the ice-level edge.',
};
const SECTIONS = ['mlb', 'nfl', 'nba', 'nhl'];

export async function renderSport(root, sport) {
  const tagline = SPORT_TAGLINES[sport] || '';

  root.innerHTML = `
    ${renderHeader()}
    <main>
      <div class="section-bar">
        <div class="container section-bar-inner">
          <a href="/news" class="section-link">All News</a>
          ${SECTIONS.map((s) => `
            <a href="/news/${s}" class="section-link ${s === sport ? 'active' : ''}">${s.toUpperCase()}</a>
          `).join('')}
        </div>
      </div>

      <div class="container" style="padding-top:40px">
        <div style="border-bottom:2px solid var(--gold);padding-bottom:18px;margin-bottom:32px">
          <div class="kicker kicker-gold" style="margin-bottom:8px">${escapeHtml(sport.toUpperCase())} · The Section</div>
          <h1 class="serif" style="font-family:var(--font-serif);font-size:clamp(36px,5vw,52px);font-weight:900;letter-spacing:-0.025em;margin:0 0 10px;line-height:1.05">${escapeHtml(sport.toUpperCase())} News & Notes</h1>
          <p style="font-family:var(--font-serif);font-style:italic;font-size:18px;color:var(--paper-dim);max-width:680px;margin:0">${escapeHtml(tagline)}</p>
        </div>

        <div id="lead-slot">${cardSkeleton(1, true)}</div>
        <div id="rest-slot">${cardSkeleton(8)}</div>
      </div>
    </main>
    ${renderFooter()}
  `;

  const data = await api.newsBySport(sport, 40).catch(() => ({ articles: [] }));
  const articles = data.articles || [];
  const sportLabel = sport.toUpperCase();

  // 🆕 v3.9.6: Schema for sport landing pages
  injectSchemas([
    organizationSchema(),
    websiteSchema(),
    collectionPageSchema({
      url: `/news/${sport}`,
      name: `${sportLabel} News — PropBetEdge`,
      description: `Latest ${sportLabel} news with AI prop-bet impact analysis.`,
      articles,
    }),
    breadcrumbSchema([
      { name: 'Home', url: '/' },
      { name: 'News', url: '/news' },
      { name: `${sportLabel} News` },
    ]),
  ], 'jsonld-sport');

  if (!articles.length) {
    document.getElementById('lead-slot').innerHTML = '';
    document.getElementById('rest-slot').innerHTML = `
      <div class="empty" style="margin-top:32px">
        <h3>No ${sport.toUpperCase()} articles yet</h3>
        <p>The news engine pulls every 30 minutes — check back shortly.</p>
      </div>
    `;
    return;
  }

  // Lead = first article (or one with image preferred)
  const lead = pickLead(articles);
  const rest = articles.filter((a) => a.id !== lead.id);

  document.getElementById('lead-slot').innerHTML = `
    <div class="lead-grid" style="margin-bottom:48px">
      ${renderLeadStory(lead, sport)}
      <aside class="lead-sidebar">
        <div class="sidebar-header">More ${sport.toUpperCase()}</div>
        ${rest.slice(0, 4).map(renderSidebarStory).join('')}
      </aside>
    </div>
  `;

  const remaining = rest.slice(4);
  document.getElementById('rest-slot').innerHTML = remaining.length ? `
    <div class="section-heading">
      <h2>More Stories</h2>
    </div>
    <div class="article-grid fade-stagger">
      ${remaining.map((a) => renderArticleCard(a)).join('')}
    </div>
  ` : '';
}

function pickLead(articles) {
  const withImage = articles.filter((a) => a.image_url);
  if (withImage.length) {
    return withImage.sort((a, b) => (b.take?.impact_score || 0) - (a.take?.impact_score || 0))[0];
  }
  return articles[0];
}

function renderLeadStory(article, sport) {
  const url = article.url || `/news/${article.sport}/${article.slug}`;
  const date = new Date(article.published_at);
  const dek = article.take?.summary || article.summary;
  const imgBlock = article.image_url
    ? `<div class="lead-image">
         <img src="${escapeAttr(proxyImage(article.image_url))}" alt="${escapeAttr(article.title)}" class="hero-image-img" onerror="this.classList.add('img-broken')" />
         <div class="img-fallback">${SPORT_FALLBACK[sport] || '◆'}</div>
       </div>`
    : `<div class="lead-image"><div class="img-fallback">${SPORT_FALLBACK[sport] || '◆'}</div></div>`;

  return `
    <a href="${escapeAttr(url)}" class="lead-story fade-in">
      ${imgBlock}
      <div class="lead-meta">
        <span class="sport-tag">${escapeHtml(sport.toUpperCase())}</span>
        <span class="dot">·</span>
        <span class="timestamp">${formatRelative(date)}</span>
      </div>
      <h2 class="lead-headline">${escapeHtml(article.title)}</h2>
      ${dek ? `<p class="lead-dek">${escapeHtml(dek)}</p>` : ''}
    </a>
  `;
}

function cardSkeleton(n, large = false) {
  let out = large ? '<div class="lead-grid" style="margin-bottom:48px"><div>' : '<div class="article-grid">';
  for (let i = 0; i < n; i++) {
    out += `
      <div class="skel-card">
        <div class="skel skel-card-img"></div>
        <div class="skel skel-line" style="width:30%;height:10px"></div>
        <div class="skel skel-line" style="width:90%;height:24px;margin-top:8px"></div>
      </div>
    `;
  }
  out += large ? '</div><div></div></div>' : '</div>';
  return out;
}

function escapeAttr(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
