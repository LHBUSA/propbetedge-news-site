/**
 * src/pages/editorial-standards.js
 * Editorial Standards page — covers all 5 policy areas Google's
 * NewsMediaOrganization schema rewards:
 *   - publishingPrinciples
 *   - ethicsPolicy
 *   - diversityPolicy
 *   - actionableFeedbackPolicy
 *   - correctionsPolicy
 *
 * Strong E-E-A-T signal. Direct trust statement to readers AND Google.
 */

import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import {
  organizationSchema, websiteSchema, breadcrumbSchema, injectSchemas,
} from '../schema.js';

export async function renderEditorialStandards(root, setMeta) {
  if (setMeta) {
    setMeta({
      title: 'Editorial Standards — PropBetEdge',
      description: 'PropBetEdge\'s editorial standards: how we cover sports, disclose AI assistance, handle corrections, and uphold accuracy in prop-bet analysis.',
      canonical: 'https://propbetedge.ai/editorial-standards',
    });
  }

  injectSchemas([
    organizationSchema(),
    websiteSchema(),
    breadcrumbSchema([
      { name: 'Home', url: '/' },
      { name: 'Editorial Standards' },
    ]),
    // WebPage schema specifically for this policy doc
    {
      '@context': 'https://schema.org',
      '@type': 'AboutPage',
      '@id': 'https://propbetedge.ai/editorial-standards#aboutpage',
      url: 'https://propbetedge.ai/editorial-standards',
      name: 'Editorial Standards',
      description: 'How PropBetEdge produces, reviews, corrects, and stands behind every article we publish.',
      inLanguage: 'en-US',
      isPartOf: { '@id': 'https://propbetedge.ai/#website' },
      datePublished: '2026-04-29',
      dateModified: new Date().toISOString().slice(0, 10),
    },
  ], 'jsonld-editorial');

  root.innerHTML = `
    ${renderHeader()}
    <main>
      <div class="container editorial-standards-page">

        <header class="editorial-hero">
          <span class="editorial-eyebrow">Editorial</span>
          <h1>Editorial Standards</h1>
          <p class="editorial-subtitle">
            How PropBetEdge produces, reviews, and stands behind every article we publish.
          </p>
          <p class="editorial-meta">Last updated: May 7, 2026</p>
        </header>

        <section class="editorial-section">
          <h2 id="mission">Our Mission</h2>
          <p>
            PropBetEdge is an AI-native sports newsroom and prop-bet intelligence platform.
            We cover MLB, NFL, NBA, and NHL with a single goal: surface the systematic edges
            that move prop markets faster and more accurately than traditional sports media.
            We do this with a hybrid editorial model — human strategy and judgment combined
            with proprietary AI infrastructure that we built ourselves.
          </p>
          <p>
            We believe transparency is a competitive advantage. The reader should always know
            who wrote what, how it was produced, and what we'd do differently if we got it wrong.
          </p>
        </section>

        <section class="editorial-section" id="publishing-principles">
          <h2>Publishing Principles</h2>
          <p>
            Every article published on PropBetEdge meets these standards:
          </p>
          <ul class="editorial-list">
            <li><strong>Source verification.</strong> We fetch and verify against the original reporting before drafting any analysis. We don't republish, we don't paraphrase without attribution, and we link back to source where applicable.</li>
            <li><strong>Prop-bet relevance.</strong> Articles are filtered for prop-bet impact. We don't publish recap content for the sake of volume.</li>
            <li><strong>Fact-first, opinion second.</strong> Statistical claims are verifiable. Our editorial takes are clearly labeled as analysis, not fact.</li>
            <li><strong>No undisclosed conflicts.</strong> Affiliate links to sportsbooks (DraftKings, FanDuel, etc.) are clearly disclosed. We don't pretend to be neutral when we have skin in the game.</li>
            <li><strong>Real bylines.</strong> Articles are bylined by their actual author — human (Justin Erickson, Donneal Green, Eric Esters, Ty Whitney, Erik Schwartz) or our editorial system (PropBetEdge Editorial Team).</li>
          </ul>
        </section>

        <section class="editorial-section" id="ai-disclosure">
          <h2>AI Assistance Disclosure</h2>
          <p>
            PropBetEdge uses AI as a core part of our editorial workflow. We disclose this openly
            because we believe readers deserve to know how their information is produced.
          </p>
          <p>
            <strong>Articles bylined "PropBetEdge Editorial Team"</strong> are produced by our editorial
            pipeline — a hybrid system combining real-time source-fetching, AI-assisted drafting
            with structured editorial frameworks, and human review on the strategic angles.
          </p>
          <p>
            <strong>Articles bylined under a human author</strong> (Justin Erickson, Donneal Green, Eric
            Esters, Ty Whitney, Erik Schwartz) reflect that author's direct work and editorial
            judgment. AI tools may be used for research, fact-checking, or drafting assistance,
            but the final analysis, picks, and betting angles are the author's own.
          </p>
          <p>
            We don't believe AI assistance is something to hide. We believe it's something to do
            <em>well</em> — with rigor, transparency, and human accountability.
          </p>
        </section>

        <section class="editorial-section" id="ethics">
          <h2>Ethics &amp; Independence</h2>
          <ul class="editorial-list">
            <li>We do not accept payment for editorial coverage. Picks are not pay-for-placement.</li>
            <li>Sportsbook affiliate relationships are disclosed in any article that links to a sportsbook.</li>
            <li>We do not publish picks based on inside information from team or league sources.</li>
            <li>We track and report our hit rates publicly. When we're cold, we say so. When we're hot, we don't pretend it's skill alone.</li>
            <li>We will never recommend a bet we wouldn't take ourselves at the same price.</li>
          </ul>
        </section>

        <section class="editorial-section" id="corrections">
          <h2>Corrections Policy</h2>
          <p>
            When we get something wrong, we correct it openly and quickly.
          </p>
          <ul class="editorial-list">
            <li><strong>Factual errors</strong> (player stats, dates, scores, names) are corrected within the article and noted at the bottom with the date of correction.</li>
            <li><strong>Significant errors</strong> that materially change a pick or analysis are flagged at the top of the article in a clearly labeled correction notice.</li>
            <li><strong>Pick results</strong> are graded honestly — if a pick loses, it loses. We don't quietly delete cold weeks.</li>
            <li><strong>Reader-submitted corrections</strong> are reviewed within 24 hours. Email <a href="mailto:editorial@propbetedge.ai">editorial@propbetedge.ai</a> with the article URL and the issue.</li>
          </ul>
        </section>

        <section class="editorial-section" id="feedback">
          <h2>Reader Feedback &amp; Accountability</h2>
          <p>
            We want to hear from you when we get it right and especially when we get it wrong.
          </p>
          <ul class="editorial-list">
            <li><strong>Email:</strong> <a href="mailto:editorial@propbetedge.ai">editorial@propbetedge.ai</a> for editorial feedback, corrections, or tips.</li>
            <li><strong>Discord:</strong> Join our community to discuss picks, debate angles, and call us out in real time.</li>
            <li><strong>X / Twitter:</strong> <a href="https://x.com/propbetedgeai" target="_blank" rel="noopener">@propbetedgeai</a> for public discussion.</li>
            <li><strong>Reddit:</strong> <a href="https://www.reddit.com/r/PropBetEdge/" target="_blank" rel="noopener">r/PropBetEdge</a> for longer-form community conversation.</li>
          </ul>
          <p>
            We read everything. We don't promise to act on every suggestion, but we promise to
            consider it seriously.
          </p>
        </section>

        <section class="editorial-section" id="diversity">
          <h2>Diversity &amp; Coverage Inclusivity</h2>
          <p>
            PropBetEdge covers all four major sports (MLB, NFL, NBA, NHL) across the full
            league — not just the marquee teams or markets. We make a deliberate effort to
            cover underdog markets, smaller-market teams, and less-followed players because
            that's where prop-market edges most often emerge.
          </p>
          <p>
            Our editorial team is committed to equal coverage of women's professional leagues
            (WNBA, NWSL) as those markets become more deeply integrated into mainstream
            prop-bet offerings. We will publicly disclose when our coverage scope expands.
          </p>
          <p>
            We hire and partner with contributors of all backgrounds. Our team's prop-bet
            analysis is driven by data and discipline, not gatekeeping or insider access.
          </p>
        </section>

        <section class="editorial-section" id="responsible-betting">
          <h2>Responsible Betting</h2>
          <p>
            Sports betting can be entertaining when approached responsibly. It can also be
            harmful. PropBetEdge is committed to being honest about both.
          </p>
          <ul class="editorial-list">
            <li>Never bet money you can't afford to lose.</li>
            <li>Bankroll management matters more than picks. A 55% winning bettor with bad bankroll discipline still loses.</li>
            <li>Past performance does not guarantee future results — yours or ours.</li>
            <li>If gambling is causing you problems, call <strong>1-800-GAMBLER</strong> or visit <a href="https://www.ncpgambling.org/" target="_blank" rel="noopener">ncpgambling.org</a>. Help is free, confidential, and works.</li>
          </ul>
          <p class="editorial-21plus">
            Sports betting requires you to be 21+ and located in a jurisdiction where it is legal.
            PropBetEdge content is for informational and entertainment purposes only.
          </p>
        </section>

        <section class="editorial-section" id="contact">
          <h2>Contact &amp; Ownership</h2>
          <p>
            PropBetEdge is operated by <strong>PropTechUSA.ai</strong>, founded and owned by
            <a href="/authors/justin-erickson">Justin Erickson</a>. PropTechUSA.ai also operates
            PropData (property records API), IntelligentHomeBuying.com, IntelligentLandlord.com,
            and IntelligentSTR.com.
          </p>
          <p>
            <strong>Editorial inquiries:</strong> <a href="mailto:editorial@propbetedge.ai">editorial@propbetedge.ai</a><br>
            <strong>Business inquiries:</strong> <a href="mailto:hello@propbetedge.ai">hello@propbetedge.ai</a><br>
            <strong>Press:</strong> <a href="mailto:press@propbetedge.ai">press@propbetedge.ai</a>
          </p>
        </section>

        <footer class="editorial-footer-note">
          <p>
            These standards are living. We update them as our editorial operation evolves,
            and we date every change. Last updated: May 7, 2026.
          </p>
        </footer>

      </div>
    </main>
    ${renderFooter()}
  `;
}
