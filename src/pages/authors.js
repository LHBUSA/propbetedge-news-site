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
            <p class="author-title">Named contributors, explicit accountability, and an operational AI-assisted byline that is never presented as a person.</p>
          </div>
        </header>

        <section class="pbe-masthead-intro">
          <p>PropBetEdge separates named human authors from the operational newsroom byline. Named contributors have permanent profiles, defined coverage areas and explicit accountability. The PropBetEdge Editorial Team is disclosed as an organizational byline for newsroom systems and automation — not as a fictitious person.</p>
          <p>Founder-led work is explicit too. A Justin Erickson byline means Justin owns the thesis, materially directs or shapes the analysis and stands behind the published judgment; it does not claim that AI was absent or that every sentence was manually typed.</p>
          <p>Our sourcing, AI-use, corrections, conflicts, model-language and publication-integrity rules are documented publicly in the <a href="/editorial-standards">Editorial Standards</a>.</p>
        </section>

        <section class="author-articles-section pbe-masthead-section">
          <div class="section-heading">
            <h2>Named contributors</h2>
            <span class="section-meta">${authors.length} current profiles</span>
          </div>
          <div class="pbe-authors-index-grid">
            ${authors.map((author) => `
              <a class="pbe-author-index-card" href="/authors/${escapeAttr(author.slug)}">
                <div class="author-avatar author-avatar-${escapeAttr(author.accent || 'gold')}">${escapeHtml(author.initials || initials(author.name))}</div>
                <div>
                  <span class="author-role-eyebrow">${escapeHtml(author.bylineLabel || author.role)}</span>
                  <h2>${escapeHtml(author.name)}</h2>
                  <p>${escapeHtml(author.summary || author.title || author.role)}</p>
                  ${author.expertise?.length ? `<ul>${author.expertise.slice(0, 3).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}
                  <span class="pbe-author-index-open">View profile &amp; articles →</span>
                </div>
              </a>
            `).join('')}
          </div>
        </section>

        <section class="author-articles-section pbe-masthead-section">
          <div class="section-heading">
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

        <aside class="pbe-masthead-rule">
          <strong>Byline rule</strong>
          <p>A named person means a named person. An operational byline means newsroom systems and editorial process. We do not manufacture human identities for automated work.</p>
        </aside>
      </div>

      <style>
        .pbe-authors-index-hero{margin-bottom:28px}
        .pbe-masthead-intro{max-width:850px;margin:0 0 42px;font-size:17px;line-height:1.7;color:var(--paper-dim)}
        .pbe-masthead-intro p{margin:0 0 14px}.pbe-masthead-intro a{color:var(--gold)}
        .pbe-masthead-section{margin-top:36px}
        .pbe-authors-index-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}
        .pbe-authors-index-grid--ops{grid-template-columns:1fr}
        .pbe-author-index-card{display:flex;gap:18px;padding:22px;border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.035);color:inherit;text-decoration:none;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}
        .pbe-author-index-card--ops{background:linear-gradient(135deg,rgba(212,175,55,.08),rgba(255,255,255,.035))}
        .pbe-author-index-card:hover{transform:translateY(-2px);box-shadow:0 18px 50px rgba(0,0,0,.18);border-color:rgba(212,175,55,.55)}
        .pbe-author-index-card h2{margin:4px 0 8px;font:700 24px/1.1 "Playfair Display",serif;color:var(--paper)}
        .pbe-author-index-card p{margin:0 0 10px;color:var(--paper-dim);line-height:1.55}
        .pbe-author-index-card ul{margin:10px 0 14px;padding-left:18px;color:var(--paper-dim);font-size:13px;line-height:1.5}
        .pbe-author-index-open{font-size:12px;font-weight:800;letter-spacing:.03em;color:var(--gold)}
        .pbe-masthead-rule{margin-top:36px;padding:18px 20px;border-left:3px solid var(--gold);background:rgba(212,175,55,.06);border-radius:0 10px 10px 0}
        .pbe-masthead-rule strong{font-family:var(--font-mono);font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold)}
        .pbe-masthead-rule p{margin:7px 0 0;color:var(--paper-dim);line-height:1.6}
        @media(max-width:760px){.pbe-authors-index-grid{grid-template-columns:1fr}.pbe-author-index-card{padding:18px}.pbe-masthead-intro{font-size:16px}}
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
