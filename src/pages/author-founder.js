/**
 * src/pages/author-founder.js
 * Founder / editorial authority profile, selected by an explicit registry field (profileVariant: 'founder'),
 * never by slug. Composed for 100% browser zoom, not a full-page screenshot (owner 2026-10-04):
 *
 *   hero            identity (portrait, name once, the two titles, 2-sentence bio, actions) | What I work on
 *   About Justin    concise biography, full biography on demand
 *   accountability  one horizontal band: named-human byline + evidence/model-record standard
 *   Latest work     the visual centre: featured story + six recent with imagery, full list on demand
 *   network         compact closing rail
 *
 * Quiet editorial header (no score strip / campaign / fight-week rail). Every word comes from the canonical
 * registry (src/editorial/authors-registry.js) or the live author feed; no invented credentials or counts.
 * Styles: src/styles/founder-profile.css (imported in main.js). Schema (ProfilePage -> Person) is injected by
 * renderAuthor, unchanged.
 */

import { api } from '../api.js';
import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { escapeHtml, escapeAttr } from '../components/article-card.js';
import { proxyImage } from '../ads-config.js';

const FILTER_SPORTS = ['mlb', 'nfl', 'nhl'];
const RECENT = 6;
const isExternal = (href) => /^https?:\/\//.test(href);
const linkAttrs = (href) => (isExternal(href) ? ' target="_blank" rel="noopener"' : '');
const paragraphs = (bio) => String(bio || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

export function founderProfileHtml(slug, author) {
  const f = author.founder;
  const titles = String(author.title || '').split(' · ').filter(Boolean);
  const bio = paragraphs(author.bio);
  const aboutLead = bio.slice(0, 2);
  const aboutRest = bio.slice(2);
  return `
    ${renderHeader({ mode: 'editorial' })}
    <main class="fdr" data-profile-variant="founder">
      <header class="fdr-hero">
        <div class="fdr-wrap fdr-hero-inner">
          <div class="fdr-identity">
            ${founderPortrait(author)}
            <div class="fdr-identity-copy">
              <h1 class="fdr-name">${escapeHtml(author.name)}</h1>
              <ul class="fdr-titles">${titles.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>
            </div>
            <p class="fdr-lede">${escapeHtml(f.positioning)} ${escapeHtml(f.heroBio || author.summary)}</p>
            <nav class="fdr-actions" aria-label="Profile links">
              <a class="fdr-btn fdr-btn--primary" href="#latest-work">Latest work</a>
              <a class="fdr-btn" href="/editorial-standards">Editorial Standards</a>
              <a class="fdr-btn" href="/about">PropBetEdge</a>
              <a class="fdr-btn" href="https://proptechusa.ai" target="_blank" rel="noopener">PropTechUSA.ai</a>
            </nav>
          </div>
          <section class="fdr-domains" aria-labelledby="fdr-domains-h">
            <h2 id="fdr-domains-h" class="fdr-label">What I work on</h2>
            <ul>${(f.areas || []).map((a) => `<li>${escapeHtml(a)}</li>`).join('')}</ul>
          </section>
        </div>
      </header>

      <section class="fdr-section fdr-about" aria-labelledby="fdr-about-h">
        <div class="fdr-wrap">
          <h2 id="fdr-about-h" class="fdr-h2">About Justin</h2>
          <div class="fdr-bio">${aboutLead.map((p) => `<p>${escapeHtml(p)}</p>`).join('')}</div>
          ${aboutRest.length ? `<details class="fdr-more"><summary>Read the full biography</summary><div class="fdr-bio">${aboutRest.map((p) => `<p>${escapeHtml(p)}</p>`).join('')}</div></details>` : ''}
        </div>
      </section>

      <section class="fdr-section fdr-accountability" aria-labelledby="fdr-acc-h">
        <div class="fdr-wrap fdr-acc-inner">
          <h2 id="fdr-acc-h" class="fdr-h2">Editorial &amp; model accountability</h2>
          <div class="fdr-acc-copy">
            <p>${escapeHtml(author.accountability)}</p>
            <a class="fdr-link" href="/editorial-standards">Read Editorial Standards →</a>
          </div>
        </div>
      </section>

      <section class="fdr-section fdr-work-band" id="latest-work" aria-labelledby="fdr-work-h">
        <div class="fdr-wrap">
          <div class="fdr-work-head">
            <h2 id="fdr-work-h" class="fdr-h2">Latest work</h2>
            <div class="fdr-filters" role="group" aria-label="Filter by sport" hidden></div>
          </div>
          <div class="fdr-work" id="fdr-work-list" aria-live="polite">${workSkeleton()}</div>
        </div>
      </section>

      <section class="fdr-section fdr-network" aria-labelledby="fdr-net-h">
        <div class="fdr-wrap">
          <h2 id="fdr-net-h" class="fdr-label">Elsewhere in the network</h2>
          <ul class="fdr-net">${f.network.map((n) => `<li><a href="${escapeAttr(n.href)}"${linkAttrs(n.href)}>${escapeHtml(n.label)} <span aria-hidden="true">→</span></a></li>`).join('')}</ul>
        </div>
      </section>
    </main>
    ${renderFooter({ cta: false })}
  `;
}

// The real portrait when the registry has one (owner-supplied, self-hosted); the initials mark otherwise.
function founderPortrait(author) {
  const set = author.imageSet;
  if (!author.image || !set) return `<div class="fdr-mark" aria-hidden="true"><span>${escapeHtml(author.initials)}</span></div>`;
  const srcset = (list) => list.map((u, i) => `${escapeAttr(u)} ${i ? 960 : 480}w`).join(', ');
  const sizes = '(max-width: 760px) 120px, 240px';
  return `<figure class="fdr-mark fdr-mark--photo"><picture>
            <source type="image/webp" srcset="${srcset(set.webp)}" sizes="${sizes}" />
            <img src="${escapeAttr(set.jpg[0])}" srcset="${srcset(set.jpg)}" sizes="${sizes}" alt="${escapeAttr(author.name)}" width="${author.imageWidth || 960}" height="${author.imageHeight || 960}" decoding="async" fetchpriority="high" />
          </picture></figure>`;
}

export async function renderFounderProfile(root, slug, author) {
  root.innerHTML = founderProfileHtml(slug, author);
  const list = document.getElementById('fdr-work-list');
  let resp;
  try {
    resp = await api.byAuthor(author.name, 24);
  } catch {
    if (list) list.innerHTML = '<p class="fdr-empty">Latest work could not be loaded right now.</p>';
    return;
  }
  const articles = (resp?.articles || []).filter((a) => a && a.title && a.slug);
  if (!list) return;
  if (!articles.length) {
    list.innerHTML = '<p class="fdr-empty">New work appears here as it is published.</p>';
    return;
  }
  list.innerHTML = workHtml(articles, author.name);
  mountFilters(root, articles);
}

// ── Latest work ─────────────────────────────────────────────────────────
const fmtDate = (iso) => {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
};
const sportKey = (a) => String(a.sport || '').toLowerCase();
const bucket = (a) => (FILTER_SPORTS.includes(sportKey(a)) ? sportKey(a) : 'other');
// Impact badge only where the article actually carries one (same >= 3 rule as the newsroom cards).
const impact = (a) => {
  const s = Number(a.take?.impact_score);
  return Number.isFinite(s) && s >= 3 ? `<span class="fdr-impact${s >= 4 ? ' fdr-impact--high' : ''}">Impact ${s}/5</span>` : '';
};
const urlOf = (a) => a.url || `/news/${sportKey(a)}/${a.slug}`;
const meta = (a) => `<p class="fdr-meta-line"><span class="fdr-sport">${escapeHtml(sportKey(a).toUpperCase())}</span><time datetime="${escapeAttr(a.published_at || '')}">${escapeHtml(fmtDate(a.published_at))}</time>${impact(a)}</p>`;
const img = (a, w, h, cls) => (a.image_url
  ? `<div class="${cls}"><img src="${escapeAttr(proxyImage(a.image_url))}" alt="${escapeAttr(a.title)}" width="${w}" height="${h}" loading="lazy" decoding="async" onerror="this.classList.add('img-broken')" /></div>`
  : '');

export function workHtml(articles, authorName = '') {
  const [lead, ...rest] = articles;
  const recent = rest.slice(0, RECENT);
  const older = rest.slice(RECENT);
  const leadHtml = `<a class="fdr-lead" href="${escapeAttr(urlOf(lead))}" data-bucket="${bucket(lead)}">${img(lead, 1200, 675, 'fdr-lead-img')}<div class="fdr-lead-copy">${meta(lead)}<h3>${escapeHtml(lead.title)}</h3>${lead.summary ? `<p class="fdr-dek">${escapeHtml(lead.summary)}</p>` : ''}</div></a>`;
  const grid = recent.length
    ? `<div class="fdr-grid">${recent.map((a) => `<a class="fdr-card" href="${escapeAttr(urlOf(a))}" data-bucket="${bucket(a)}">${img(a, 640, 360, 'fdr-card-img')}${meta(a)}<h3>${escapeHtml(a.title)}</h3>${a.summary ? `<p class="fdr-dek">${escapeHtml(a.summary)}</p>` : ''}</a>`).join('')}</div>`
    : '';
  const all = older.length
    ? `<details class="fdr-all"><summary>View all work by ${escapeHtml(authorName)}</summary><ul class="fdr-list">${older.map((a) => `<li data-bucket="${bucket(a)}"><a href="${escapeAttr(urlOf(a))}">${meta(a)}<span class="fdr-list-title">${escapeHtml(a.title)}</span></a></li>`).join('')}</ul></details>`
    : '';
  return leadHtml + grid + all;
}

/** Filters only for buckets the feed actually contains; with fewer than two buckets there is nothing to filter. */
export function filterBuckets(articles) {
  const present = new Set(articles.map(bucket));
  return ['all', ...FILTER_SPORTS.filter((s) => present.has(s)), ...(present.has('other') ? ['other'] : [])];
}

function mountFilters(root, articles) {
  const bar = root.querySelector('.fdr-filters');
  const buckets = filterBuckets(articles);
  if (!bar || buckets.length < 3) return;
  bar.innerHTML = buckets.map((b) => `<button type="button" data-filter="${b}" aria-pressed="${b === 'all'}">${b === 'all' ? 'All' : b === 'other' ? 'Other' : b.toUpperCase()}</button>`).join('');
  bar.hidden = false;
  bar.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-filter]');
    if (!btn) return;
    const f = btn.dataset.filter;
    for (const b of bar.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b === btn));
    for (const el of root.querySelectorAll('#fdr-work-list [data-bucket]')) el.hidden = f !== 'all' && el.dataset.bucket !== f;
  });
}

function workSkeleton() {
  return '<div class="fdr-lead fdr-skel" aria-hidden="true"></div><div class="fdr-grid">' + '<div class="fdr-card fdr-skel" aria-hidden="true"></div>'.repeat(3) + '</div>';
}
