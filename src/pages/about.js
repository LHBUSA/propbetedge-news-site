/**
 * /about — the company and network explanation. A presentation layer over canonical network truth:
 * src/about-content.js composes family.json, pro-content.js, intelligence-cta.js and the research registry, and
 * this page only lays it out. No sport, product, price or URL is written here. Quiet editorial header; main-site
 * footer. Styles: src/styles/about.css (.ab-*), warm palette only.
 */

import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { organizationSchema, websiteSchema, breadcrumbSchema, injectSchemas } from '../schema.js';
import { aboutModel, ABOUT_META } from '../about-content.js';

const SITE = 'https://propbetedge.ai';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ext = 'target="_blank" rel="noopener"';
const isExt = (h) => /^https?:\/\//.test(h) && !h.startsWith(SITE);

export function aboutHtml(m = aboutModel()) {
  return `
    ${renderHeader({ mode: 'editorial' })}
    <main class="ab">
      <header class="ab-hero">
        <div class="ab-wrap">
          <p class="ab-eyebrow">About PropBetEdge</p>
          <h1 class="ab-title">A connected sports intelligence operating system.</h1>
          <p class="ab-lede">PropBetEdge observes live sports, keeps one canonical state of every game, player and market, runs sport-specific models and DNA systems, freezes official calls before outcomes, and publishes intelligence and journalism connected back to the evidence — across ${m.sportCount} live sports and PropBetEdge Predictions.</p>
          <nav class="ab-actions" aria-label="About actions">
            <a class="ab-btn ab-btn--primary" href="${esc(m.allAccess.href)}">Explore All Access</a>
            <a class="ab-btn" href="/research">How the intelligence is built</a>
            <a class="ab-btn" href="/editorial-standards">Editorial Standards</a>
          </nav>
        </div>
      </header>

      <section class="ab-section ab-architecture" aria-labelledby="ab-arch-h">
        <div class="ab-wrap ab-two">
          <div>
            <h2 id="ab-arch-h" class="ab-h2">How the company fits together</h2>
            <p class="ab-copy">Three layers, one architecture. Customers use PropBetEdge; the data and engineering underneath it are built and run by the same organization.</p>
          </div>
          <ol class="ab-layers">${m.layers.map((l) => `<li><span class="ab-layer-name">${esc(l.name)}</span><span class="ab-layer-role">${esc(l.role)}</span></li>`).join('')}</ol>
        </div>
      </section>

      <section class="ab-section ab-loop" aria-labelledby="ab-loop-h">
        <div class="ab-wrap">
          <h2 id="ab-loop-h" class="ab-h2">The operating loop</h2>
          <ol class="ab-stages">${m.stages.map((s, i) => `<li><span class="ab-stage-n">${String(i + 1).padStart(2, '0')}</span><span class="ab-stage-k">${esc(s.label)}</span><span class="ab-stage-t">${esc(s.title)}</span><span class="ab-stage-b">${esc(s.body)}</span></li>`).join('')}</ol>
          <p class="ab-more"><a href="/research/intelligence-systems">Intelligence systems →</a> <a href="/research/model-governance">Model governance →</a></p>
        </div>
      </section>

      <section class="ab-section ab-network" aria-labelledby="ab-net-h">
        <div class="ab-wrap">
          <h2 id="ab-net-h" class="ab-h2">${m.sportCount} live sports, each with its own intelligence</h2>
          <ul class="ab-sports">${m.sports.map((s) => `<li><a href="${esc(s.url)}" ${ext}><span class="ab-sport-label"><span aria-hidden="true">${esc(s.glyph)}</span> ${esc(s.label)}</span><span class="ab-sport-line">${esc(s.line)}</span></a>${s.newsPath ? `<a class="ab-sport-news" href="${esc(s.newsPath)}"${isExt(s.newsPath) ? ` ${ext}` : ''}>${esc(s.label)} newsroom</a>` : ''}</li>`).join('')}</ul>
          ${m.upcoming.length ? `<p class="ab-upcoming">In development: ${m.upcoming.map((u) => `<strong>${esc(u.label)}</strong> (${esc(u.eta)}) — ${esc(u.line)}`).join(' ')}</p>` : ''}
        </div>
      </section>

      <section class="ab-section ab-products" aria-label="Predictions and All Access">
        <div class="ab-wrap ab-two">
          <a class="ab-product" href="${esc(m.predictions.url)}" ${ext}>
            <span class="ab-product-k">Intelligence product</span>
            <span class="ab-product-name">${esc(m.predictions.name)}</span>
            <span class="ab-product-tag">${esc(m.predictions.tagline)}</span>
            <span class="ab-product-line">${esc(m.predictions.line)}</span>
          </a>
          <a class="ab-product ab-product--access" href="${esc(m.allAccess.href)}">
            <span class="ab-product-k">Membership</span>
            <span class="ab-product-name">All Access <span class="ab-price">${esc(m.allAccess.price)}</span></span>
            <span class="ab-product-line">Every live sport intelligence product plus ${esc(m.predictions.name)}, in one membership. New sports and Pro products join as they launch.</span>
          </a>
        </div>
      </section>

      <section class="ab-section ab-newsroom" aria-labelledby="ab-news-h">
        <div class="ab-wrap ab-two">
          <div>
            <h2 id="ab-news-h" class="ab-h2">An AI-native newsroom with named accountability</h2>
            <p class="ab-copy">Every sport has its own newsroom, connected to the same evidence, entity pages and live products as the intelligence. Named contributors are accountable for their bylines; the PropBetEdge Editorial Team byline identifies disclosed newsroom systems, never a fictitious person.</p>
            <p class="ab-more"><a href="/news">All sports news →</a> <a href="/authors">Editorial Team →</a></p>
          </div>
          <div class="ab-trust">
            <h2 class="ab-kicker">How we keep it honest</h2>
            <ul>${m.trust.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
            <p class="ab-trust-links"><a href="/editorial-standards">Editorial Standards</a> · <a href="/research">Research</a> · <a href="/authors">Editorial Team</a> · <a href="/terms">Terms</a> · <a href="/legal">Legal</a></p>
          </div>
        </div>
      </section>

      <section class="ab-section ab-builders" aria-labelledby="ab-dev-h">
        <div class="ab-wrap ab-two">
          <h2 id="ab-dev-h" class="ab-h2">Build on the platform</h2>
          <p class="ab-copy">The PropSports data platform underneath PropBetEdge is available to developers as documented commercial APIs. <a href="/developers">Explore the APIs →</a></p>
        </div>
      </section>
    </main>
    ${renderFooter({ cta: false })}
  `;
}

export function renderAbout(root, setMeta) {
  setMeta?.({ title: ABOUT_META.title, description: ABOUT_META.description, canonical: `${SITE}/about` });
  injectSchemas([
    organizationSchema(),
    websiteSchema(),
    breadcrumbSchema([{ name: 'Home', url: '/' }, { name: 'About PropBetEdge' }]),
    {
      '@context': 'https://schema.org',
      '@type': 'AboutPage',
      '@id': `${SITE}/about#page`,
      url: `${SITE}/about`,
      name: 'About PropBetEdge',
      description: ABOUT_META.description,
      mainEntity: { '@id': `${SITE}/#organization` },
      isPartOf: { '@id': `${SITE}/#website` },
      inLanguage: 'en-US',
    },
  ], 'jsonld-about');
  root.innerHTML = aboutHtml();
}
