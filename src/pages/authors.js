import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { listNamedAuthors, listOperationalBylines } from '../editorial/authors-registry.js';
import { renderHomeCloser } from '../components/home-closer.js';
import '../styles/home-closer.css';

export function renderAuthorsIndex(root, setMeta) {
  const authors = listNamedAuthors();
  const operational = listOperationalBylines();

  setMeta?.({
    title: 'Editorial Team — PropBetEdge',
    description: 'Meet the named PropBetEdge contributors and the disclosed operational newsroom byline behind our sports journalism and intelligence coverage.',
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
            <p class="author-title">Named contributors, clear accountability, and an operational AI-assisted byline that is never presented as a person.</p>
          </div>
        </header>

        <section class="author-bio-section">
          <div class="author-bio">
            <p>PropBetEdge separates named human authors from the operational newsroom byline. Named contributors have permanent profiles, defined coverage areas and explicit accountability. The PropBetEdge Editorial Team is disclosed as an organizational byline for newsroom systems and automation — not as a fictitious person.</p>
            <p>Our sourcing, AI-use, corrections, conflicts, model-language and publication-integrity rules are documented publicly in the <a href="/editorial-standards">Editorial Standards</a>.</p>
          </div>

          <div class="section-heading pbe-operational-heading">
            <h2>Operational bylines</h2>
            <span class="section-meta">Disclosed newsroom systems</span>
          </div>
          <div class="pbe-authors-index-grid pbe-authors-index-grid--ops">
            ${operational.map((author) => `
              <a class="pbe-author-index-card pbe-author-index-card--ops" href="/authors/${escapeAttr(author.slug)}">
                <div class="author-avatar author-avatar-${escapeAttr(author.accent || 'algo')}">${escapeHtml(author.initials || initials(author.name))}</div>
                <div>
                  <span class="author-role-eyebrow">${escapeHtml(author.bylineLabel || author.role)}</span>
                  <h2>${escapeHtml(author.name)}</h2>
                  <p>${escapeHtml(author.summary || author.title || author.role)}</p>
                  <span class="pbe-author-index-open">Read how this byline works →</span>
                </div>
              </a>
            `).join('')}
          </div>
        </section>

        <section class="author-articles-section">
          <div class="section-heading">
            <h2>Current masthead</h2>
            <span class="section-meta">${authors.length} named contributors</span>
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
        .pbe-authors-index-hero{margin-bottom:28px}.pbe-operational-heading{margin-top:34px}.pbe-authors-index-grid--ops{grid-template-columns:1fr}.pbe-author-index-card--ops{background:linear-gradient(135deg,rgba(212,175,55,.08),rgba(255,255,255,.82))}
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
    ${renderHomeCloser()}
    ${renderFooter({ cta: false })}
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
