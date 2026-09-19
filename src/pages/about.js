import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { organizationSchema, websiteSchema, breadcrumbSchema, injectSchemas } from '../schema.js';

const SITE = 'https://propbetedge.ai';

export function renderAbout(root, setMeta) {
  setMeta?.({
    title: 'About PropBetEdge — Sports News & Intelligence',
    description: 'About PropBetEdge: ownership, editorial operation, sports-intelligence network, standards, and contact information.',
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
      description: 'Ownership, editorial operation, sports-intelligence network, standards, and contact information for PropBetEdge.',
      mainEntity: { '@id': `${SITE}/#organization` },
      isPartOf: { '@id': `${SITE}/#website` },
      inLanguage: 'en-US',
    },
  ], 'jsonld-about');

  root.innerHTML = `
    ${renderHeader()}
    <main>
      <div class="container editorial-standards-page">
        <header class="editorial-hero">
          <span class="editorial-eyebrow">Publisher</span>
          <h1>About PropBetEdge</h1>
          <p class="editorial-subtitle">
            Sports journalism, permanent sports entities, and intelligence products built inside the PropTechUSA.ai technology ecosystem.
          </p>
        </header>

        <section class="editorial-section">
          <h2>Ownership &amp; Operation</h2>
          <p>
            <strong>PropBetEdge is owned, built, and operated by PropTechUSA.ai.</strong>
            It is part of the broader PropTechUSA.ai product and infrastructure ecosystem rather than a standalone media project.
          </p>
          <p>
            PropBetEdge's newsroom, sports intelligence products, APIs, models, automation, and technical infrastructure are developed and operated within that larger organization.
            Editorial independence governs what we publish; ownership, engineering, infrastructure, and business operations remain with PropTechUSA.ai.
          </p>
        </section>

        <section class="editorial-section">
          <h2>What We Publish</h2>
          <p>
            The main PropBetEdge publication covers MLB, NFL, NBA, and NHL news and analysis while connecting stories to permanent player, team, game, standings, and statistical-intelligence pages.
          </p>
          <p>
            The wider PropBetEdge network also includes dedicated MLB, NFL, NBA, WNBA, NHL, and UFC product sites. Those products are connected properties in the same network, not separate publisher identities.
          </p>
          <ul>
            <li><a href="https://mlb.propbetedge.ai/" target="_blank" rel="noopener"><strong>PropBetEdge MLB</strong></a></li>
            <li><a href="https://nfl.propbetedge.ai/" target="_blank" rel="noopener"><strong>PropBetEdge NFL</strong></a></li>
            <li><a href="https://nba.propbetedge.ai/" target="_blank" rel="noopener"><strong>PropBetEdge NBA</strong></a></li>
            <li><a href="https://wnba.propbetedge.ai/" target="_blank" rel="noopener"><strong>PropBetEdge WNBA</strong></a></li>
            <li><a href="https://nhl.propbetedge.ai/" target="_blank" rel="noopener"><strong>PropBetEdge NHL</strong></a></li>
            <li><a href="https://ufc.propbetedge.ai/" target="_blank" rel="noopener"><strong>PropBetEdge UFC</strong></a></li>
          </ul>
        </section>

        <section class="editorial-section">
          <h2>Editorial Operation</h2>
          <p>
            PropBetEdge uses a hybrid human-and-AI editorial workflow. Our public standards document how source verification, AI assistance, human review, corrections, feedback, ethics, and coverage inclusivity are handled.
          </p>
          <p>
            <a href="/authors"><strong>Meet the editorial team →</strong></a><br>
            <a href="/editorial-standards"><strong>Read our Editorial Standards →</strong></a>
          </p>
        </section>

        <section class="editorial-section">
          <h2>Parent Technology Ecosystem</h2>
          <p>
            PropTechUSA.ai also operates <a href="https://propdata.proptechusa.ai" target="_blank" rel="noopener"><strong>PropData</strong></a>, its property intelligence and real-estate data infrastructure platform, and
            <a href="https://propsports.proptechusa.ai" target="_blank" rel="noopener"><strong>PropSports</strong></a>, its sports data and API infrastructure.
          </p>
        </section>

        <section class="editorial-section" id="contact">
          <h2>Contact</h2>
          <p>
            <strong>Editorial inquiries:</strong> <a href="mailto:editorial@proptechusa.ai">editorial@proptechusa.ai</a><br>
            <strong>Business inquiries:</strong> <a href="mailto:hello@proptechusa.ai">hello@proptechusa.ai</a><br>
            <strong>Press:</strong> <a href="mailto:press@proptechusa.ai">press@proptechusa.ai</a>
          </p>
        </section>
      </div>
    </main>
    ${renderFooter()}
  `;
}
