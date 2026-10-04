/**
 * PropBetEdge Editorial Standards
 *
 * Public policy for sourcing, authorship, AI/automation, corrections,
 * conflicts, model language, records and responsible betting.
 */

import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { renderHomeCloser } from '../components/home-closer.js';
import '../styles/home-closer.css';
import { PROPBETEDGE_X_URL, PROPBETEDGE_X_HANDLE } from '../social.js';
import {
  organizationSchema, websiteSchema, breadcrumbSchema, injectSchemas,
} from '../schema.js';

const UPDATED_ISO = '2026-10-04';
const UPDATED_LABEL = 'October 4, 2026';

export async function renderEditorialStandards(root, setMeta) {
  setMeta?.({
    title: 'Editorial Standards — PropBetEdge',
    description: 'How PropBetEdge sources, produces, labels, corrects and preserves sports journalism, analysis, model output and AI-assisted newsroom work.',
    canonical: 'https://propbetedge.ai/editorial-standards',
  });

  injectSchemas([
    organizationSchema(),
    websiteSchema(),
    breadcrumbSchema([
      { name: 'Home', url: '/' },
      { name: 'Editorial Standards' },
    ]),
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': 'https://propbetedge.ai/editorial-standards#webpage',
      url: 'https://propbetedge.ai/editorial-standards',
      name: 'Editorial Standards',
      description: 'How PropBetEdge sources, produces, labels, corrects and preserves sports journalism, analysis, model output and AI-assisted newsroom work.',
      inLanguage: 'en-US',
      isPartOf: { '@id': 'https://propbetedge.ai/#website' },
      publisher: { '@id': 'https://propbetedge.ai/#organization' },
      datePublished: '2026-04-29',
      dateModified: UPDATED_ISO,
    },
  ], 'jsonld-editorial');

  root.innerHTML = `
    ${renderHeader()}
    <main>
      <div class="container editorial-standards-page">

        <header class="editorial-hero">
          <span class="editorial-eyebrow">TRUST · EDITORIAL</span>
          <h1>Editorial Standards</h1>
          <p class="editorial-subtitle">
            Evidence before fluency. Clear bylines. Visible corrections. Models treated as probabilities, not promises.
          </p>
          <p class="editorial-meta">Effective and last updated: ${UPDATED_LABEL}</p>
        </header>

        <section class="editorial-section">
          <h2 id="mission">Our editorial promise</h2>
          <p>
            PropBetEdge is a sports-intelligence network with an original newsroom. The network spans MLB, NFL, NBA, WNBA, NHL, UFC, Tennis, Soccer, Golf and F1, with sport-native products, data systems and editorial surfaces connected under one brand.
          </p>
          <p>
            Our job is not to manufacture certainty or publish volume for its own sake. Our job is to tell readers what is known, where it came from, what is inference or model output, what remains uncertain, and what changed when a published claim needs correction.
          </p>
          <div class="editorial-policy-callout">
            <strong>The standard:</strong> a polished sentence is not evidence. A model score is not a fact. A source link is not permission to misstate what the source says. If the evidence does not support a specific claim, the claim should not ship.
          </div>
        </section>

        <section class="editorial-section" id="publishing-principles">
          <h2>Publishing principles</h2>
          <ul class="editorial-list">
            <li><strong>Primary evidence first.</strong> When an official league, team, athlete, tournament, regulator, public record or other primary source can establish a fact, we prefer it over a secondary retelling.</li>
            <li><strong>Attribution stays attached.</strong> Material facts derived from outside reporting should be attributed or linked where appropriate. We do not present another publisher's original reporting as our own reporting.</li>
            <li><strong>Fact, analysis and model output are different things.</strong> We label and write them differently. Observed facts should be verifiable; analysis is our interpretation; model outputs are derived estimates with uncertainty.</li>
            <li><strong>No invented precision.</strong> Missing, stale, conflicting or unavailable data remains missing, stale, conflicting or unavailable. We do not fill a hole because a number would make the story read better.</li>
            <li><strong>Publication history matters.</strong> We do not quietly rewrite a past call after the result is known. Corrections can amend a story; they do not erase the fact that an earlier version existed.</li>
            <li><strong>Reader value over content volume.</strong> A story should add verified context, analysis, intelligence or useful connection to the underlying sport — not exist simply to increase page count.</li>
          </ul>
        </section>

        <section class="editorial-section" id="sources">
          <h2>Source hierarchy &amp; verification</h2>
          <p>Source quality depends on the claim. Our preferred order is primary or official evidence, then high-quality direct reporting, then additional secondary context. We may use multiple sources when one source cannot establish the full claim.</p>
          <ul class="editorial-list">
            <li><strong>Identity and status:</strong> official rosters, organizations, governing bodies and other authoritative records take priority.</li>
            <li><strong>Scores, schedules and game state:</strong> sport-native or official data is preferred, with provider state and timestamps treated as part of the evidence.</li>
            <li><strong>Breaking news:</strong> we distinguish what a source actually reported from what PropBetEdge infers from it.</li>
            <li><strong>Statistics and model inputs:</strong> values should come from a defined data path. A derived metric must not be presented as an official league statistic.</li>
            <li><strong>Conflicts:</strong> when credible sources disagree, we do not silently choose the version that best fits an angle. The uncertainty should be represented or publication should wait.</li>
          </ul>
        </section>

        <section class="editorial-section" id="ai-disclosure">
          <h2>AI, automation &amp; authorship disclosure</h2>
          <p>
            PropBetEdge uses AI and automation throughout its newsroom and product infrastructure. We disclose that because the useful question is not whether software touched a story; it is whether the resulting claims are sourced, reviewable and honestly attributed.
          </p>
          <p>
            <strong>Named human bylines</strong> — including <a href="/authors/justin-erickson">Justin Erickson</a>, <a href="/authors/erik-schwartz">Erik Schwartz</a> and <a href="/authors/ty-whitney">Ty Whitney</a> — identify the person accountable for the published analysis and conclusions under that name. AI tools may assist research, organization, checking or drafting.
          </p>
          <p>
            <strong><a href="/authors/propbetedge-editorial-team">PropBetEdge Editorial Team</a></strong> is an operational newsroom byline, not a fictitious person. It is used when a story is produced through newsroom systems and cannot honestly be attributed to one named human author. That workflow may include source discovery, structured extraction, AI-assisted drafting, automated checks, publication gates and editorial intervention. We do <strong>not</strong> claim that a human manually writes or reviews every sentence carrying the operational byline.
          </p>
          <p>
            Automation does not lower the factual standard. Unsupported specifics should be withheld, model output should not be laundered into reported fact, and a system should fail closed when required evidence is unavailable.
          </p>
        </section>

        <section class="editorial-section" id="bylines">
          <h2>Byline integrity</h2>
          <p>Every current byline has a permanent profile on the <a href="/authors">Editorial Team</a> page. Named people are represented as people. The PropBetEdge Editorial Team is represented as an organizational editorial operation. We do not create fictional human identities to make automated work appear human-authored.</p>
          <p>If a contributor relationship changes, archival journalism is not automatically deleted. Where reattribution is necessary, the canonical URL and original publication history should remain intact rather than turning an authorship change into a silent rewrite of the archive.</p>
        </section>

        <section class="editorial-section" id="model-output">
          <h2>Models, picks &amp; market intelligence</h2>
          <ul class="editorial-list">
            <li><strong>Models are probabilistic.</strong> A probability, projection, confidence score, Player DNA metric or algorithmic pick is an estimate produced under a defined method — not a guarantee.</li>
            <li><strong>Official calls and editorial ideas are not interchangeable.</strong> When a product distinguishes an official model pick from a featured player, editorial showcase, research output or shadow result, we preserve that distinction.</li>
            <li><strong>Results stay with the call.</strong> Where PropBetEdge maintains a public or product track record, losses remain visible and historical outcomes are not backfilled to create a better-looking record.</li>
            <li><strong>Market data is time-sensitive.</strong> Prices, odds and prediction-market states can move rapidly. Time of observation matters, and a later price should not be presented as though it were available when an earlier call was made.</li>
          </ul>
        </section>

        <section class="editorial-section" id="corrections">
          <h2>Corrections, updates &amp; record preservation</h2>
          <p>We correct factual mistakes. We do not use corrections as permission to erase an inconvenient historical record.</p>
          <ul class="editorial-list">
            <li><strong>Minor factual corrections</strong> may be repaired in place and should be noted when the change is meaningful to a reader's understanding.</li>
            <li><strong>Material corrections</strong> — including errors that change the thesis, a pick, a model interpretation or a consequential factual claim — should receive a visible correction or update notice.</li>
            <li><strong>Publication timestamps</strong> should not be moved simply because a story was corrected. The original publication event remains part of the record.</li>
            <li><strong>Model and pick history</strong> should not be rewritten after outcomes are known. Corrections to data or grading should be traceable rather than silently replacing the past.</li>
            <li><strong>Reader corrections:</strong> send the article URL, the exact claim at issue and supporting evidence to <a href="mailto:editorial@proptechusa.ai">editorial@proptechusa.ai</a>.</li>
          </ul>
        </section>

        <section class="editorial-section" id="ethics">
          <h2>Independence, conflicts &amp; commercial separation</h2>
          <ul class="editorial-list">
            <li>We do not accept payment in exchange for favorable editorial coverage or a favorable pick.</li>
            <li>Advertising, sponsorships and affiliate relationships must not be disguised as independent editorial judgment.</li>
            <li>Commercial relationships do not authorize a sponsor to rewrite editorial conclusions.</li>
            <li>PropBetEdge's own products may be linked from editorial pages, but house promotion should be identifiable as product promotion rather than source evidence.</li>
            <li>Third-party league, team, athlete, sportsbook and market names remain the property of their respective owners; reference does not imply endorsement or affiliation.</li>
          </ul>
        </section>

        <section class="editorial-section" id="feedback">
          <h2>Accountability &amp; reader feedback</h2>
          <p>Readers should be able to challenge our work with the same evidence standard we expect internally.</p>
          <ul class="editorial-list">
            <li><strong>Editorial and corrections:</strong> <a href="mailto:editorial@proptechusa.ai">editorial@proptechusa.ai</a></li>
            <li><strong>Support:</strong> <a href="mailto:support@proptechusa.ai">support@proptechusa.ai</a></li>
            <li><strong>Press:</strong> <a href="mailto:press@proptechusa.ai">press@proptechusa.ai</a></li>
            <li><strong>X:</strong> <a href="${PROPBETEDGE_X_URL}" target="_blank" rel="noopener noreferrer">${PROPBETEDGE_X_HANDLE}</a></li>
            <li><strong>Bluesky:</strong> <a href="https://bsky.app/profile/propbetedge.bsky.social" target="_blank" rel="noopener noreferrer">@propbetedge.bsky.social</a></li>
          </ul>
        </section>

        <section class="editorial-section" id="coverage">
          <h2>Coverage &amp; representation</h2>
          <p>
            The PropBetEdge network covers men's and women's sports and is designed around sport-specific intelligence rather than market size alone. Editorial priority should be driven by significance, evidence and reader value — not by whether a team, athlete or league is already receiving the most attention elsewhere.
          </p>
          <p>
            We do not manufacture a diversity claim by forcing equal story counts across unequal news cycles. We do expect consistent standards of accuracy, respect and evidence regardless of the athlete, team, league, country or audience being covered.
          </p>
        </section>

        <section class="editorial-section" id="responsible-betting">
          <h2>Responsible betting</h2>
          <p>PropBetEdge is a sports intelligence and entertainment service, not a sportsbook. Wagering involves risk and no article, model, probability or pick guarantees an outcome or profit.</p>
          <ul class="editorial-list">
            <li>Never wager money you cannot afford to lose.</li>
            <li>Do not chase losses or treat a model streak as certainty.</li>
            <li>Past performance does not guarantee future results.</li>
            <li>You are responsible for complying with the age and location rules that apply where you are.</li>
            <li>If gambling is causing harm or feels difficult to control, stop wagering and seek help. In the United States, call or text <strong>1-800-GAMBLER</strong>.</li>
          </ul>
        </section>

        <section class="editorial-section" id="ownership">
          <h2>Ownership &amp; editorial responsibility</h2>
          <p>
            PropBetEdge is operated by Local Home Buyers LLC d/b/a PropTechUSA.ai. PropBetEdge's newsroom, sports-intelligence products, data systems, APIs, models and automation operate within the broader PropTechUSA.ai technology organization.
          </p>
          <p>
            Editorial standards govern what PropBetEdge publishes. Product ownership and infrastructure do not change the obligation to distinguish sourced fact, analysis, model output and promotion.
          </p>
          <p>
            See <a href="/about">About PropBetEdge</a>, <a href="/authors">Editorial Team</a>, <a href="/legal">Legal</a> and <a href="/terms">Terms of Service</a> for the connected trust and company layer.
          </p>
        </section>

        <footer class="editorial-footer-note">
          <p>These standards are living. Material changes are dated. Last updated: ${UPDATED_LABEL}.</p>
        </footer>
      </div>

      <style>
        .editorial-policy-callout{margin:24px 0 4px;padding:18px 20px;border-left:3px solid var(--gold);background:rgba(212,175,55,.07);border-radius:0 10px 10px 0;line-height:1.65}
      </style>
    </main>
    ${renderHomeCloser()}
    ${renderFooter({ cta: false })}
  `;
}
