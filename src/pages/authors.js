import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { listAuthors } from './author.js';

export function renderAuthorsIndex(root, setMeta) {
  const authors = listAuthors();

  setMeta?.({
    title: 'Editorial Team — PropBetEdge',
    description: 'Meet the PropBetEdge editorial team, research analysts and AI-assisted editorial operation behind our sports news and intelligence coverage.',
    canonical: 'https://propbetedge.ai/authors',
  });

  root.innerHTML = `
    ${renderHeader()}
    <main class="pbe-intelligence-page">
      <div class="container author-page">
        <header class="author-hero pbe-authors-index-hero">
          <div class="author-info">
            <span class="author-role-eyebrow">PROPBETEDGE MASTHEAD</span>
            <h1 class="author-name">Editorial Team</h1>
            <p class="author-title">Human expertise, quantitative research and transparent AI-assisted editorial operations.</p>
          </div>
        </header>

        <section class="author-bio-section">
          <div class="author-bio">
            <p>PropBetEdge publishes sports journalism and sports-intelligence coverage across MLB, NFL, NBA and NHL. Every byline below resolves to a permanent profile with coverage areas, methodology context and a connected article portfolio.</p>
            <p>Our AI-assisted editorial workflow and human-review standards are documented publicly in the <a href="/editorial-standards">Editorial Standards</a>.</p>
          </div>
        </section>

        <section class="author-articles-section">
          <div class="section-heading">
            <h2>Current masthead</h2>
            <span class="section-meta">${authors.length} editorial entities</span>
          </div>
          <div class="pbe-authors-index-grid">
            ${authors.map((author) => `
              <a class="pbe-author-index-card" href="/authors/${escapeAttr(author.slug)}">
                <div class="author-avatar author-avatar-${escapeAttr(author.accent || 'gold')}">${escapeHtml(author.initials || initials(author.name))}</div>
                <div>
                  <span class="author-role-eyebrow">${escapeHtml(author.role)}</span>
                  <h2>${escapeHtml(author.name)}</h2>
                  <p>${escapeHtml(author.title || author.role)}</p>
                  ${author.expertise?.length ? `<ul>${author.expertise.slice(0, 3).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}
                  <span class="pbe-author-index-open">View profile & articles →</span>
                </div>
              </a>
            `).join('')}
          </div>
        </section>
      </div>
      <style>
        .pbe-authors-index-hero{margin-bottom:28px}
        .pbe-authors-index-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}
        .pbe-author-index-card{display:flex;gap:18px;padding:22px;border:1px solid rgba(20,17,13,.12);border-radius:18px;background:rgba(255,255,255,.82);color:inherit;text-decoration:none;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}
        .pbe-author-index-card:hover{transform:translateY(-2px);box-shadow:0 18px 50px rgba(20,17,13,.09);border-color:rgba(212,175,55,.55)}
        .pbe-author-index-card h2{margin:4px 0 8px;font:700 24px/1.1 "Playfair Display",serif}
        .pbe-author-index-card p{margin:0 0 10px;color:var(--muted,#655f57)}
        .pbe-author-index-card ul{margin:10px 0 14px;padding-left:18px;color:var(--muted,#655f57);font-size:13px;line-height:1.5}
        .pbe-author-index-open{font-size:12px;font-weight:800;letter-spacing:.03em;color:#8b6c08}
        @media(max-width:760px){.pbe-authors-index-grid{grid-template-columns:1fr}.pbe-author-index-card{padding:18px}}
      </style>
    </main>
    ${renderFooter()}
  `;
}

function initials(name) {
  return String(name || '').split(/\s+/).map((part) => part[0] || '').slice(0, 2).join('').toUpperCase();
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function escapeAttr(value) {
  return escapeHtml(value);
}
