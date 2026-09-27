import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { organizationSchema, websiteSchema, breadcrumbSchema, injectSchemas } from '../schema.js';

const SITE = 'https://propbetedge.ai';

const SPORTS = [
  { key: 'mlb', label: 'MLB', icon: '⚾', href: 'https://mlb.propbetedge.ai/sharp-tools', line: 'Models, props, player intelligence and the MLB PBEcast experience.' },
  { key: 'nfl', label: 'NFL', icon: '🏈', href: 'https://nfl.propbetedge.ai/', line: 'Game intelligence, player context, Touchdown Targets and live football analysis.' },
  { key: 'nba', label: 'NBA', icon: '🏀', href: 'https://nba.propbetedge.ai/', line: 'Basketball intelligence, player analytics and model-driven game context.' },
  { key: 'wnba', label: 'WNBA', icon: '🏀', href: 'https://wnba.propbetedge.ai/', line: 'WinBA, player impact, live game intelligence and WNBA-specific analytics.' },
  { key: 'nhl', label: 'NHL', icon: '🏒', href: 'https://nhl.propbetedge.ai/', line: 'Hockey intelligence, shot context, PBEcast and game-level analysis.' },
  { key: 'ufc', label: 'UFC', icon: '🥊', href: 'https://ufc.propbetedge.ai/', line: 'Fight intelligence, matchup context, model calls and accountable records.' },
  { key: 'tennis', label: 'Tennis', icon: '🎾', href: 'https://tennis.propbetedge.ai/', line: 'Men’s and women’s tennis intelligence, Tennis DNA, rankings and match history.' },
];

export function renderAbout(root, setMeta) {
  setMeta?.({
    title: 'About PropBetEdge — The Sports Intelligence Network',
    description: 'PropBetEdge is a multi-sport intelligence network combining data, models, live analysis, player intelligence, public records, and original sports journalism.',
    canonical: `${SITE}/about`,
  });

  injectSchemas([
    organizationSchema(),
    websiteSchema(),
    breadcrumbSchema([
      { name: 'Home', url: '/' },
      { name: 'About PropBetEdge' },
    ]),
    {
      '@context': 'https://schema.org',
      '@type': 'AboutPage',
      '@id': `${SITE}/about#page`,
      url: `${SITE}/about`,
      name: 'About PropBetEdge',
      description: 'PropBetEdge is a multi-sport intelligence network combining data, models, live analysis, player intelligence, public records, and original sports journalism.',
      mainEntity: { '@id': `${SITE}/#organization` },
      isPartOf: { '@id': `${SITE}/#website` },
      inLanguage: 'en-US',
    },
  ], 'jsonld-about');

  root.innerHTML = `
    ${renderHeader()}
    <main class="about-v2">
      <div class="container">

        <section class="about-hero" aria-labelledby="about-title">
          <div class="about-hero-copy">
            <span class="about-kicker"><span class="about-live-dot" aria-hidden="true"></span>THE SPORTS INTELLIGENCE NETWORK</span>
            <h1 id="about-title">Sports are deeper than the scoreboard.</h1>
            <p class="about-dek">
              PropBetEdge connects live sports data, proprietary analytics, player intelligence, model output,
              permanent records and original journalism into one network built to explain <em>what is happening, why it matters, and what the data sees next.</em>
            </p>
            <div class="about-actions">
              <a class="about-btn about-btn-primary" href="/pro">Explore All Access <span aria-hidden="true">→</span></a>
              <a class="about-btn about-btn-ghost" href="/news">Read the newsroom <span aria-hidden="true">→</span></a>
            </div>
          </div>

          <aside class="about-manifesto" aria-label="PropBetEdge principles">
            <span class="about-manifesto-label">BUILT DIFFERENT</span>
            <p>We do not want to be another picks page with a few stats attached.</p>
            <p>We build sport-specific intelligence products, keep model records public where models are live, and connect the news back to the data underneath it.</p>
            <div class="about-manifesto-rule"></div>
            <strong>News is the entry point. Intelligence is the product.</strong>
          </aside>
        </section>

        <section class="about-proof" aria-label="Network snapshot">
          <div><strong>7</strong><span>live sport verticals</span></div>
          <div><strong>1</strong><span>connected intelligence network</span></div>
          <div><strong>$29</strong><span>All Access · monthly</span></div>
          <div><strong>Public</strong><span>records where models are live</span></div>
        </section>

        <section class="about-split">
          <div>
            <span class="about-section-kicker">WHAT WE ARE BUILDING</span>
            <h2>A sports intelligence layer, not a skin on top of scores.</h2>
          </div>
          <div class="about-copy">
            <p>
              Each PropBetEdge sport is allowed to become its own product. Baseball does not need to look like football.
              Tennis should not be forced into a basketball template. Fighting, hockey and women’s basketball each deserve their own
              data model, analytical language and live experience.
            </p>
            <p>
              That is why the network includes products such as PBEcast, WinBA, Tennis DNA, sport-specific model outputs,
              track records and player intelligence instead of one generic dashboard copied across every league.
            </p>
          </div>
        </section>

        <section class="about-network" aria-labelledby="network-title">
          <header class="about-section-head">
            <div>
              <span class="about-section-kicker">THE NETWORK</span>
              <h2 id="network-title">One brand. Seven live sports. Different intelligence for each one.</h2>
            </div>
            <a href="/pro">See All Access →</a>
          </header>
          <div class="about-sport-grid">
            ${SPORTS.map((sport) => `
              <a class="about-sport-card about-sport-${sport.key}" href="${sport.href}">
                <span class="about-sport-icon" aria-hidden="true">${sport.icon}</span>
                <span class="about-sport-meta">PROPBETEDGE · ${sport.label}</span>
                <strong>${sport.label} Intelligence</strong>
                <p>${sport.line}</p>
                <span class="about-sport-open">Open ${sport.label} <span aria-hidden="true">→</span></span>
              </a>
            `).join('')}
          </div>
        </section>

        <section class="about-system" aria-labelledby="system-title">
          <header class="about-section-head">
            <div>
              <span class="about-section-kicker">HOW IT WORKS</span>
              <h2 id="system-title">The intelligence has a spine.</h2>
            </div>
          </header>
          <div class="about-system-grid">
            <article>
              <span>01</span>
              <h3>Own the evidence</h3>
              <p>Ingest, normalize and preserve the underlying sports facts so the product is built on durable data instead of disposable page calls.</p>
            </article>
            <article>
              <span>02</span>
              <h3>Build sport-native intelligence</h3>
              <p>Turn the data into metrics, models, player profiles, live context and visual systems designed for that sport rather than a generic template.</p>
            </article>
            <article>
              <span>03</span>
              <h3>Publish with context</h3>
              <p>Use original journalism and permanent entity pages to explain the story, then connect readers directly into the deeper intelligence behind it.</p>
            </article>
            <article>
              <span>04</span>
              <h3>Keep the record</h3>
              <p>Where a model is live, lock the call before the event, grade it after the result and preserve the record instead of rewriting history.</p>
            </article>
          </div>
        </section>

        <section class="about-accountability">
          <div class="about-accountability-copy">
            <span class="about-section-kicker">ACCOUNTABILITY BY DESIGN</span>
            <h2>Research, prediction and journalism are not the same thing.</h2>
            <p>
              PropBetEdge separates experimental work from live product claims. A metric can be useful before a model is ready.
              A model can be in validation before it deserves a public recommendation. Missing data is shown as missing instead of silently becoming zero.
            </p>
            <p>
              Our editorial workflow combines automation with source checks, evidence gates and public standards.
              That same philosophy runs through the intelligence products: preserve provenance, label uncertainty and keep the record.
            </p>
            <div class="about-inline-links">
              <a href="/editorial-standards">Editorial Standards →</a>
              <a href="/authors">Editorial Team →</a>
            </div>
          </div>
          <div class="about-accountability-stack" aria-label="Accountability principles">
            <div><span>01</span><strong>Evidence before narrative</strong></div>
            <div><span>02</span><strong>Research labeled as research</strong></div>
            <div><span>03</span><strong>Missing data stays missing</strong></div>
            <div><span>04</span><strong>Track records stay permanent</strong></div>
          </div>
        </section>

        <section class="about-news" aria-labelledby="about-news-title">
          <div class="about-news-shell">
            <div class="about-news-brand" aria-hidden="true">
              <div class="about-news-brand-frame">
                <span class="about-news-brand-edge about-news-brand-edge--tl"></span>
                <span class="about-news-brand-edge about-news-brand-edge--br"></span>
                <img
                  src="/logo/pbe-full-400.png"
                  srcset="/logo/pbe-full-200.png 200w, /logo/pbe-full-400.png 400w, /logo/pbe-full-600.png 600w"
                  sizes="(max-width: 760px) 190px, 260px"
                  alt=""
                  class="about-news-logo"
                  width="600"
                  height="600"
                  loading="lazy"
                  decoding="async"
                >
                <span class="about-news-brand-line">NEWS <i>•</i> DATA <i>•</i> INTELLIGENCE</span>
              </div>
            </div>

            <div class="about-news-copy">
              <span class="about-section-kicker about-news-kicker"><span aria-hidden="true"></span>NEWS <i>•</i> INTELLIGENCE</span>
              <h2 id="about-news-title">The <em>newsroom</em> is the top of the funnel — not a detached blog.</h2>
              <p>
                A PropBetEdge story should lead somewhere useful: a player, a team, a game, a model, a PBEcast,
                a leaderboard or a deeper sport-specific product. The goal is to make every story an entry point into the intelligence graph.
              </p>
              <div class="about-news-action-row">
                <a class="about-news-cta" href="/news">Explore PropBetEdge News <span aria-hidden="true">→</span></a>
                <span class="about-news-proofline">Original reporting <i>•</i> data-linked stories <i>•</i> evidence-gated publishing</span>
              </div>
            </div>
          </div>
        </section>

        <section class="about-parent">
          <div>
            <span class="about-section-kicker">BUILT BY PROPTECHUSA.AI</span>
            <h2>One engineering organization behind the network.</h2>
          </div>
          <div class="about-copy">
            <p>
              <strong>PropBetEdge is owned, built and operated by PropTechUSA.ai.</strong> The newsroom, models, sports-data pipelines,
              automation, APIs and technical infrastructure are developed inside the broader PropTechUSA.ai technology ecosystem.
            </p>
            <p>
              PropTechUSA.ai also operates <a href="https://propdata.proptechusa.ai" target="_blank" rel="noopener">PropData</a>,
              its property-intelligence infrastructure, and <a href="https://propsports.proptechusa.ai" target="_blank" rel="noopener">PropSports</a>,
              the sports-data infrastructure behind parts of the PropBetEdge network.
            </p>
          </div>
        </section>

        <section class="about-final-cta">
          <span class="about-section-kicker">GO DEEPER</span>
          <h2>Follow the story. Open the data. Test the model. Keep the record.</h2>
          <p>That is the idea behind PropBetEdge.</p>
          <div class="about-actions">
            <a class="about-btn about-btn-primary" href="/pro">PropBetEdge All Access <span aria-hidden="true">→</span></a>
            <a class="about-btn about-btn-ghost" href="/news">Latest intelligence <span aria-hidden="true">→</span></a>
          </div>
        </section>

        <section class="about-contact" id="contact">
          <div>
            <span class="about-section-kicker">CONTACT</span>
            <h2>Talk to PropBetEdge.</h2>
          </div>
          <div class="about-contact-grid">
            <a href="mailto:editorial@proptechusa.ai"><span>Editorial</span><strong>editorial@proptechusa.ai</strong></a>
            <a href="mailto:hello@proptechusa.ai"><span>Business</span><strong>hello@proptechusa.ai</strong></a>
            <a href="mailto:press@proptechusa.ai"><span>Press</span><strong>press@proptechusa.ai</strong></a>
          </div>
        </section>

      </div>
    </main>
    ${renderFooter()}
  `;
}
