/**
 * /developers — the PropTechUSA sports API platform. Catalog: src/network/public-apis.js (public, sellable APIs
 * only; internal Workers are never listed). Trust-center visual system (.es-*) + src/styles/research.css.
 */

import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { PUBLIC_APIS, API_CONTACT } from '../network/public-apis.js';
import { organizationSchema, websiteSchema, breadcrumbSchema, injectSchemas } from '../schema.js';

const SITE = 'https://propbetedge.ai';
export const DEVELOPERS_META = Object.freeze({
  title: 'Developers — PropBetEdge sports data & intelligence APIs',
  description: 'Build on the data platform underneath PropBetEdge: the PropSports API, the UFC Intelligence API and the PropBetEdge Sports News API — documentation, coverage and access.',
});
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ext = 'target="_blank" rel="noopener"';

function apiHtml(api) {
  return `<article class="dv-api" id="${esc(api.key)}">
    <h2 class="dv-api-name">${esc(api.name)}</h2>
    <p class="dv-api-sum">${esc(api.summary)}</p>
    ${api.coverage ? `<p class="dv-label">Coverage</p><ul class="dv-coverage">${api.coverage.map(([l, h]) => `<li><a href="${esc(h)}" ${ext}>${esc(l)}</a></li>`).join('')}</ul>` : ''}
    <p class="dv-access"><span class="dv-label">Access</span> ${esc(api.access)}</p>
    <p class="dv-links">
      <a class="dv-btn dv-btn--primary" href="${esc(api.href)}" ${ext}>Open ${esc(api.footerLabel)}</a>
      ${api.docs && api.docs !== api.href ? `<a class="dv-btn" href="${esc(api.docs)}" ${ext}>Documentation</a>` : ''}
      ${api.reference ? `<a class="dv-btn" href="${esc(api.reference)}" ${ext}>Sample requests &amp; responses</a>` : ''}
      ${api.pricing ? `<a class="dv-btn" href="${esc(api.pricing)}" ${ext}>Plans</a>` : ''}
    </p>
  </article>`;
}

export function developersHtml() {
  return `
    ${renderHeader({ mode: 'editorial' })}
    <main class="es dv">
      <header class="es-hero">
        <div class="container es-hero-inner">
          <p class="es-eyebrow">DEVELOPERS</p>
          <h1 class="es-title">Build on the platform underneath PropBetEdge</h1>
          <p class="es-lede">The same sports data and intelligence infrastructure that powers the PropBetEdge network is available to developers as documented, commercial APIs.</p>
          <div class="es-hero-foot">
            <p class="es-updated">PropTechUSA.ai · PropSports infrastructure</p>
            <nav class="es-actions" aria-label="Developer actions">
              <a href="#catalog">API catalog</a>
              <a href="${esc(PUBLIC_APIS[0].docs)}" ${ext}>Documentation</a>
              <a href="mailto:${API_CONTACT}">Talk to sales</a>
            </nav>
          </div>
        </div>
      </header>

      <div class="container dv-body">
        <section class="dv-catalog" id="catalog" aria-label="API catalog">${PUBLIC_APIS.map(apiHtml).join('')}</section>

        <section class="dv-how" aria-labelledby="dv-how-h">
          <h2 id="dv-how-h" class="dv-h2">How the platform works</h2>
          <ul class="dv-points">
            <li><strong>Canonical data.</strong> Games, players, teams and events resolve to one canonical state, the same state PropBetEdge products read.</li>
            <li><strong>Provenance.</strong> Data carries its source and capture time; missing values stay missing instead of being invented.</li>
            <li><strong>Intelligence, not just scores.</strong> Player and game intelligence, model outputs and historical context sit alongside live state.</li>
            <li><strong>Production use.</strong> Documented routes, API keys and published plans.</li>
          </ul>
          <p class="es-links"><a href="/research/data-provenance">Data provenance</a> · <a href="/research/intelligence-systems">Intelligence systems</a> · <a href="/research">Research</a></p>
        </section>

        <section class="dv-contact" aria-labelledby="dv-contact-h">
          <h2 id="dv-contact-h" class="dv-h2">Get access</h2>
          <p>Choose a plan on the PropSports portal, subscribe to the Sports News API on RapidAPI, or contact <a href="mailto:${API_CONTACT}">${API_CONTACT}</a> for the UFC Intelligence API, volume or custom coverage.</p>
        </section>
      </div>
    </main>
    ${renderFooter({ cta: false })}
  `;
}

export function renderDevelopers(root, setMeta) {
  setMeta?.({ title: DEVELOPERS_META.title, description: DEVELOPERS_META.description, canonical: `${SITE}/developers` });
  injectSchemas([
    organizationSchema(),
    websiteSchema(),
    breadcrumbSchema([{ name: 'Home', url: '/' }, { name: 'Developers' }]),
    { '@context': 'https://schema.org', '@type': 'WebPage', '@id': `${SITE}/developers#webpage`, url: `${SITE}/developers`, name: DEVELOPERS_META.title, description: DEVELOPERS_META.description, inLanguage: 'en-US', isPartOf: { '@id': `${SITE}/#website` }, publisher: { '@id': `${SITE}/#organization` } },
  ], 'jsonld-developers');
  root.innerHTML = developersHtml();
}
