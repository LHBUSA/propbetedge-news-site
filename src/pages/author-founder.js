/**
 * src/pages/author-founder.js
 * Founder / technical-operator profile, selected by an explicit registry field (profileVariant: 'founder'), never by
 * slug. Every word comes from the canonical registry (src/editorial/authors-registry.js) or the live author feed —
 * no counts, metrics or claims that need re-verifying. Other bylines keep the standard profile in pages/author.js.
 *
 * Styles: src/styles/founder-profile.css (imported in main.js).
 * Order: hero → what I build → operating principles → accountability → expertise → latest work → across the network.
 * Schema (ProfilePage → Person) is injected by renderAuthor, unchanged.
 */

import { api } from '../api.js';
import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { escapeHtml, escapeAttr } from '../components/article-card.js';
import { proxyImage } from '../ads-config.js';

const FILTER_SPORTS = ['mlb', 'nfl', 'nhl'];
const isExternal = (href) => /^https?:\/\//.test(href);
const linkAttrs = (href) => (isExternal(href) ? ' target="_blank" rel="noopener"' : '');

export function founderProfileHtml(slug, author) {
  const f = author.founder;
  return `
    ${renderHeader()}
    <main class="fdr" data-profile-variant="founder">
      <header class="fdr-hero">
        <div class="container fdr-hero-inner">
          <div class="fdr-mark" aria-hidden="true"><span>${escapeHtml(author.initials)}</span></div>
          <div class="fdr-hero-copy">
            <p class="fdr-eyebrow">${escapeHtml(f.eyebrow)}</p>
            <h1 class="fdr-name">${escapeHtml(author.name)}</h1>
            <p class="fdr-title">${escapeHtml(author.title)}</p>
            <p class="fdr-positioning">${escapeHtml(f.positioning)}</p>
            <ul class="fdr-facts">${f.facts.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul>
            <div class="fdr-actions">
              <a class="fdr-btn fdr-btn--primary" href="#latest-work">Latest work</a>
              <a class="fdr-btn" href="/editorial-standards">Editorial standards</a>
              <a class="fdr-btn" href="/about">PropBetEdge network</a>
            </div>
          </div>
        </div>
      </header>

      <div class="container fdr-body">
        <section class="fdr-section" aria-labelledby="fdr-build">
          <h2 id="fdr-build" class="fdr-h2"><span>01</span> What I build</h2>
          <div class="fdr-pillars">
            ${f.pillars.map((p) => `<article class="fdr-pillar"><h3>${escapeHtml(p.title)}</h3><p>${escapeHtml(p.body)}</p></article>`).join('')}
          </div>
        </section>

        <section class="fdr-section" aria-labelledby="fdr-principles">
          <h2 id="fdr-principles" class="fdr-h2"><span>02</span> Operating principles</h2>
          <ol class="fdr-principles">
            ${f.principles.map((p, i) => `<li><span class="fdr-pn">${String(i + 1).padStart(2, '0')}</span><div><h3>${escapeHtml(p.title)}</h3><p>${escapeHtml(p.body)}</p></div></li>`).join('')}
          </ol>
        </section>

        <section class="fdr-section fdr-split" aria-label="Accountability and expertise">
          <aside class="fdr-trust" aria-labelledby="fdr-trust-h">
            <p class="fdr-trust-k" id="fdr-trust-h">Named human byline</p>
            <p class="fdr-trust-body">${escapeHtml(author.accountability)}</p>
            <a class="fdr-link" href="/editorial-standards">Read Editorial Standards →</a>
          </aside>
          <div class="fdr-expertise">
            <h2 class="fdr-h2"><span>03</span> Expertise</h2>
            <ul class="fdr-cap">${author.expertise.map((e) => `<li>${escapeHtml(e)}</li>`).join('')}</ul>
          </div>
        </section>

        <section class="fdr-section" id="latest-work" aria-labelledby="fdr-work">
          <div class="fdr-work-head">
            <h2 id="fdr-work" class="fdr-h2"><span>04</span> Latest work</h2>
            <div class="fdr-filters" role="group" aria-label="Filter by sport" hidden></div>
          </div>
          <div class="fdr-work" id="fdr-work-list" aria-live="polite">${workSkeleton()}</div>
        </section>

        <section class="fdr-section fdr-network" aria-labelledby="fdr-net">
          <h2 id="fdr-net" class="fdr-h2"><span>05</span> Across the network</h2>
          <ul class="fdr-net">${f.network.map((n) => `<li><a href="${escapeAttr(n.href)}"${linkAttrs(n.href)}>${escapeHtml(n.label)} <span aria-hidden="true">→</span></a></li>`).join('')}</ul>
        </section>
      </div>
    </main>
    ${renderFooter({ cta: false })}
  `;
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
  list.innerHTML = workHtml(articles);
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
const meta = (a) => `<p class="fdr-meta"><span class="fdr-sport">${escapeHtml(sportKey(a).toUpperCase())}</span><time datetime="${escapeAttr(a.published_at || '')}">${escapeHtml(fmtDate(a.published_at))}</time>${impact(a)}</p>`;

export function workHtml(articles) {
  const [lead, ...rest] = articles;
  const img = lead.image_url
    ? `<div class="fdr-lead-img"><img src="${escapeAttr(proxyImage(lead.image_url))}" alt="${escapeAttr(lead.title)}" width="1200" height="675" loading="lazy" decoding="async" onerror="this.classList.add('img-broken')" /></div>`
    : '';
  const leadHtml = `<a class="fdr-lead" href="${escapeAttr(urlOf(lead))}" data-bucket="${bucket(lead)}">${img}<div class="fdr-lead-copy">${meta(lead)}<h3>${escapeHtml(lead.title)}</h3>${lead.summary ? `<p class="fdr-dek">${escapeHtml(lead.summary)}</p>` : ''}</div></a>`;
  const grid = rest.length
    ? `<div class="fdr-grid">${rest.map((a) => `<a class="fdr-card" href="${escapeAttr(urlOf(a))}" data-bucket="${bucket(a)}">${meta(a)}<h3>${escapeHtml(a.title)}</h3>${a.summary ? `<p class="fdr-dek">${escapeHtml(a.summary)}</p>` : ''}</a>`).join('')}</div>`
    : '';
  return leadHtml + grid;
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
