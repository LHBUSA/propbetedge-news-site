/**
 * /research and /research/* — PropBetEdge Research. Content: src/research/registry.js (the one registry).
 * Uses the trust-center system of Editorial Standards (src/styles/editorial-standards.css, .es-*) plus
 * src/styles/research.css, so standards, research and developers read as one institutional surface.
 * Quiet editorial header; main-site footer.
 */

import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { RESEARCH_PAGES, RESEARCH_NOT_PUBLISHED, RESEARCH_UPDATED, researchPage, researchSubpages } from '../research/registry.js';
import { organizationSchema, websiteSchema, breadcrumbSchema, injectSchemas } from '../schema.js';

const SITE = 'https://propbetedge.ai';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function sectionHtml(sec, i) {
  const body = sec.steps
    ? `<ol class="rs-loop">${sec.steps.map(([k, v]) => `<li><span class="rs-loop-k">${esc(k)}</span><span>${esc(v)}</span></li>`).join('')}</ol>`
    : sec.body.map((p) => `<p>${esc(p)}</p>`).join('');
  return `<section class="es-sec" id="${esc(sec.id)}" aria-labelledby="h-${esc(sec.id)}"><h2 id="h-${esc(sec.id)}"><span class="es-n">${String(i + 1).padStart(2, '0')}</span>${esc(sec.h)}</h2>${body}</section>`;
}

export function researchHtml(page) {
  const subs = researchSubpages();
  const isIndex = !page.slug;
  const eyebrow = isIndex ? 'RESEARCH' : `<a href="/research">Research</a> <span aria-hidden="true">›</span> ${esc(page.label)}`;
  return `
    ${renderHeader({ mode: 'editorial' })}
    <main class="es rs">
      <header class="es-hero">
        <div class="container es-hero-inner">
          <p class="es-eyebrow">${eyebrow}</p>
          <h1 class="es-title">${esc(page.title)}</h1>
          <p class="es-lede">${esc(page.lede)}</p>
          <div class="es-hero-foot">
            <p class="es-updated">Last updated · <time datetime="${RESEARCH_UPDATED.iso}">${RESEARCH_UPDATED.label}</time></p>
            <nav class="es-actions" aria-label="Research actions">
              <a href="/editorial-standards">Editorial Standards</a>
              <a href="/developers">Developers</a>
            </nav>
          </div>
        </div>
      </header>

      <div class="container es-layout">
        <nav class="es-toc" aria-label="Research">
          <p class="es-toc-k">Research</p>
          <ol>${RESEARCH_PAGES.map((p) => `<li><a href="${p.path}"${p.path === page.path ? ' aria-current="page"' : ''}>${esc(p.label)}</a></li>`).join('')}</ol>
        </nav>
        <div class="es-doc">
          ${page.sections.map(sectionHtml).join('')}
          ${isIndex ? `<section class="es-sec" id="areas" aria-labelledby="h-areas"><h2 id="h-areas"><span class="es-n">${String(page.sections.length + 1).padStart(2, '0')}</span>Research areas</h2>
            <ul class="rs-cards">${subs.map((p) => `<li><a href="${p.path}"><span class="rs-card-t">${esc(p.label)}</span><span class="rs-card-d">${esc(p.description)}</span><span class="rs-card-go" aria-hidden="true">→</span></a></li>`).join('')}</ul></section>` : ''}
          <section class="es-sec rs-scope" id="scope" aria-labelledby="h-scope">
            <h2 id="h-scope"><span class="es-n">—</span>What we do not publish</h2>
            <p>These pages explain how the research process works. They intentionally leave out:</p>
            <ul class="es-list">${RESEARCH_NOT_PUBLISHED.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
          </section>
          ${isIndex ? '' : `<p class="es-links"><a href="/research">← All research</a> · ${subs.filter((p) => p.path !== page.path).map((p) => `<a href="${p.path}">${esc(p.label)}</a>`).join(' · ')}</p>`}
        </div>
      </div>
    </main>
    ${renderFooter({ cta: false })}
  `;
}

export function renderResearch(root, path, setMeta) {
  const page = researchPage(path);
  if (!page) return false;
  setMeta?.({ title: `${page.title} — PropBetEdge Research`, description: page.description, canonical: `${SITE}${page.path}` });
  injectSchemas([
    organizationSchema(),
    websiteSchema(),
    breadcrumbSchema(page.slug ? [{ name: 'Home', url: '/' }, { name: 'Research', url: '/research' }, { name: page.label }] : [{ name: 'Home', url: '/' }, { name: 'Research' }]),
    { '@context': 'https://schema.org', '@type': 'WebPage', '@id': `${SITE}${page.path}#webpage`, url: `${SITE}${page.path}`, name: page.title, description: page.description, inLanguage: 'en-US', isPartOf: { '@id': `${SITE}/#website` }, publisher: { '@id': `${SITE}/#organization` }, dateModified: RESEARCH_UPDATED.iso },
  ], 'jsonld-research');
  root.innerHTML = researchHtml(page);
  return true;
}
