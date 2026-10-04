/**
 * src/pages/author.js
 * Author profile page — bio, role, latest articles
 *
 * Routes: /authors/justin-erickson
 *         /authors/erik-schwartz
 *         /authors/ty-whitney
 *         /authors/propbetedge-editorial-team
 *
 * Strong E-E-A-T signal for Google: real authors with role, bio, and article portfolio.
 * Each profile is a structured Person entity that links back to NewsArticle author fields.
 */

import { api } from '../api.js';
import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { renderArticleCard, escapeHtml, escapeAttr } from '../components/article-card.js';
import { getAuthorBySlug as getEditorialAuthor, listAuthors as listEditorialAuthors, authorSlug as editorialAuthorSlug } from '../editorial/authors-registry.js';
import { renderHomeCloser } from '../components/home-closer.js';
import '../styles/home-closer.css';
import { renderNotFound } from './404.js';
import {
  organizationSchema, websiteSchema, breadcrumbSchema,
  profilePageSchema, injectSchemas,
} from '../schema.js';

// ─── Author registry ────────────────────────────────────────────────────
// Single source of truth for each author's identity. Slug → full profile.
const AUTHORS = Object.fromEntries(listEditorialAuthors().map(({ slug, ...profile }) => [slug, profile]));

// Convert a name like "Justin Erickson" → "justin-erickson"
export function authorSlug(name) {
  return editorialAuthorSlug(name);
}

export function getAuthorBySlug(slug) {
  return getEditorialAuthor(slug);
}

export function listAuthors() {
  return listEditorialAuthors();
}

export async function renderAuthor(root, slug, setMeta) {
  const author = AUTHORS[slug];
  if (!author) {
    renderNotFound(root);
    return;
  }

  if (setMeta) {
    setMeta({
      title: `${author.name} — ${author.role} · PropBetEdge`,
      description: stripHtml(author.bio).slice(0, 160),
      canonical: `https://propbetedge.ai/authors/${slug}`,
    });
  }

  // Inject Person JSON-LD for E-E-A-T signal
  // 🆕 v3.9.6: Rich schema — ProfilePage wrapping Person + breadcrumbs + org + website
  injectSchemas([
    organizationSchema(),
    websiteSchema(),
    profilePageSchema(slug, author),
    breadcrumbSchema([
      { name: 'Home', url: '/' },
      { name: 'Editorial Team', url: '/authors' },
      { name: author.name },
    ]),
  ], 'jsonld-author');

  // Skeleton
  root.innerHTML = `
    ${renderHeader()}
    <main>
      <div class="container author-page">
        <header class="author-hero">
          <div class="author-avatar author-avatar-${author.accent}">${author.initials}</div>
          <div class="author-info">
            <span class="author-role-eyebrow">${escapeHtml(author.role)}</span>
            <h1 class="author-name">${escapeHtml(author.name)}</h1>
            <p class="author-title">${escapeHtml(author.title)}</p>
          </div>
        </header>

        <section class="author-bio-section">
          <div class="author-bio">${formatBioParagraphs(author.bio)}<div class="author-accountability"><span>BYLINE ACCOUNTABILITY</span><p>${escapeHtml(author.accountability || "")}</p></div></div>
          <aside class="author-sidebar">
            ${author.credentials && author.credentials.length ? `
              <div class="author-credentials">
                <span class="author-sidebar-label">Credentials</span>
                <ul class="author-credentials-list">
                  ${author.credentials.map((c) => `<li>${escapeHtml(c)}</li>`).join('')}
                </ul>
              </div>
            ` : ''}
            ${author.expertise && author.expertise.length ? `
              <div class="author-expertise">
                <span class="author-sidebar-label">Coverage areas</span>
                <ul class="author-expertise-list">
                  ${author.expertise.map((e) => `<li>${escapeHtml(e)}</li>`).join('')}
                </ul>
              </div>
            ` : ''}
            ${author.location ? `
              <div class="author-meta-row">
                <span class="author-meta-label">Based in</span>
                <span class="author-meta-value">${escapeHtml(author.location)}</span>
              </div>
            ` : ''}
            ${author.twitter ? `
              <div class="author-social">
                <a href="${escapeAttr(author.twitter)}" target="_blank" rel="noopener">𝕏 Follow on X</a>
              </div>
            ` : ''}
          </aside>
        </section>

        <section class="author-articles-section">
          <div class="section-heading">
            <h2>Latest articles by ${escapeHtml(author.name)}</h2>
            <span class="section-meta" id="article-count">Loading…</span>
          </div>
          <div id="author-articles-grid" class="article-grid uniform-grid fade-stagger">${cardSkeleton(6)}</div>
        </section>
      </div>
    </main>
    ${renderHomeCloser()}
    ${renderFooter({ cta: false })}
  `;

  // Fetch articles by this author
  let resp;
  try {
    resp = await api.byAuthor(author.name, 24);
  } catch (e) {
    document.getElementById('author-articles-grid').innerHTML = `
      <div class="empty" style="grid-column:1/-1">
        <h3>Couldn't load articles</h3>
        <p>${escapeHtml(e.message)}</p>
      </div>
    `;
    return;
  }

  const articles = resp.articles || [];
  const total = resp.total || 0;
  const countEl = document.getElementById('article-count');
  if (countEl) {
    countEl.textContent = total === 0 ? 'No articles yet' : `${total} ${total === 1 ? 'article' : 'articles'} published`;
  }

  const grid = document.getElementById('author-articles-grid');
  if (!articles.length) {
    grid.innerHTML = `
      <div class="empty" style="grid-column:1/-1">
        <h3>No articles yet</h3>
        <p>${escapeHtml(author.name)}'s articles will appear here as they're published.</p>
      </div>
    `;
  } else {
    grid.innerHTML = articles.map((a) => renderArticleCard(a)).join('');
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────
function stripHtml(s) {
  return String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

// Split bio by double-newline into <p> tags. Bio HTML is trusted (we control it).
function formatBioParagraphs(bio) {
  if (!bio) return '';
  return bio
    .split(/\n\s*\n/)
    .map((para) => para.trim())
    .filter(Boolean)
    .map((para) => `<p>${para}</p>`)
    .join('\n');
}

function cardSkeleton(n) {
  let out = '';
  for (let i = 0; i < n; i++) {
    out += `
      <div class="skel-card">
        <div class="skel skel-card-img"></div>
        <div class="skel skel-line" style="width:25%;height:10px"></div>
        <div class="skel skel-line" style="width:90%;height:22px;margin-top:8px"></div>
        <div class="skel skel-line" style="width:75%;height:22px"></div>
      </div>
    `;
  }
  return out;
}
