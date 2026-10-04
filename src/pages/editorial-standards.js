/**
 * PropBetEdge Editorial Standards
 *
 * Public policy for sourcing, authorship, AI/automation, corrections,
 * conflicts, models, records and responsible betting.
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
    description: 'How PropBetEdge sources, produces, labels, corrects and preserves reporting, founder-led analysis, AI-assisted newsroom work and model output.',
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
      description: 'How PropBetEdge sources, produces, labels, corrects and preserves reporting, founder-led analysis, AI-assisted newsroom work and model output.',
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
          <span class="editorial-eyebrow">TRUST · EDITORIAL OPERATING STANDARD</span>
          <h1>Editorial Standards</h1>
          <p class="editorial-subtitle">
            Evidence before fluency. Accountability without pretending AI is absent. Permanent records instead of hindsight.
          </p>
          <p class="editorial-meta">Effective and last updated: ${UPDATED_LABEL}</p>
        </header>

        <section class="editorial-section">
          <h2 id="mission">What PropBetEdge is now</h2>
          <p>
            PropBetEdge is not a conventional sports blog with an analytics widget attached. It is a connected sports-intelligence network with an original newsroom, live products, APIs, data systems, proprietary analytical layers and public model records. The network spans MLB, NFL, NBA, WNBA, NHL, UFC, Tennis, Soccer, Golf and F1.
          </p>
          <p>
            Editorial work can begin with a game, a transaction, a model movement, a source packet, a live product signal or a founder-led thesis. Whatever the starting point, publication must preserve the boundary between <strong>what happened</strong>, <strong>what a source says</strong>, <strong>what PropBetEdge calculates</strong> and <strong>what we conclude</strong>.
          </p>
          <div class="editorial-policy-callout">
            <strong>The standard:</strong> polished language is not evidence. A model output is not a reported fact. A source link is not permission to overstate the source. If the evidence cannot carry a claim, the claim does not ship.
          </div>
        </section>

        <section class="editorial-section" id="operating-model">
          <h2>Our editorial operating model</h2>
          <p>
            PropBetEdge is AI-native and systems-driven by design. Automation may discover source material, extract structured facts, assemble evidence packets, compare data, draft language, run consistency checks, test numeric claims, enforce publication gates and prepare updates. Human contributors may work inside those same systems rather than outside them.
          </p>
          <p>
            We do not use “human reviewed” as a blanket marketing claim. Some work receives direct named-human authorship and judgment. Some work is produced by an operational newsroom pipeline. Some surfaces are deterministic data or model products rather than journalism at all. The byline, labeling and surrounding product context should tell the reader which is which.
          </p>
          <ul class="editorial-list">
            <li><strong>Evidence is upstream of prose.</strong> When a workflow uses a frozen source packet, evidence ledger or versioned data snapshot, the published claims must remain inside that evidence boundary.</li>
            <li><strong>Validation can be automated.</strong> Numeric, entity, duplicate, freshness, source and model-state checks may be enforced in software. Passing automation does not convert inference into fact.</li>
            <li><strong>Fail closed when required evidence is missing.</strong> A held article is better than a fluent unsupported one.</li>
            <li><strong>Live state is not archival truth.</strong> Scores, lineups, prices and market states can change. A live panel may update while the historical claims in a published story remain tied to their original evidence and timestamps.</li>
          </ul>
        </section>

        <section class="editorial-section" id="publishing-principles">
          <h2>Publishing principles</h2>
          <ul class="editorial-list">
            <li><strong>Primary evidence first.</strong> When an official league, team, athlete, tournament, regulator, public record or other primary source can establish a fact, we prefer it over a secondary retelling.</li>
            <li><strong>Attribution stays attached.</strong> Material facts derived from outside reporting should be attributed or linked where appropriate. We do not present another publisher's original reporting as our own reporting.</li>
            <li><strong>Fact, analysis, model output and promotion are different things.</strong> We label and write them differently. Observed facts should be verifiable; analysis is interpretation; model outputs are derived estimates; house promotion is not source evidence.</li>
            <li><strong>No invented precision.</strong> Missing, stale, conflicting or unavailable data remains missing, stale, conflicting or unavailable.</li>
            <li><strong>No hindsight publishing.</strong> We do not silently rewrite a past call after the result is known or replace the historical state with a later, more favorable one.</li>
            <li><strong>Reader value over volume.</strong> A story should add verified context, analysis, intelligence or a useful connection to the underlying sport or product.</li>
          </ul>
        </section>

        <section class="editorial-section" id="sources">
          <h2>Source hierarchy, provenance &amp; verification</h2>
          <p>Source quality depends on the claim. Our preferred order is primary or official evidence, then high-quality direct reporting, then additional secondary context. Multiple sources may be necessary when no single source establishes the full claim.</p>
          <ul class="editorial-list">
            <li><strong>Identity and status:</strong> official rosters, organizations, governing bodies, commissions and other authoritative records take priority.</li>
            <li><strong>Scores, schedules and game state:</strong> sport-native or official data is preferred, with provider state, timestamps and freshness treated as part of the evidence.</li>
            <li><strong>Breaking news:</strong> we distinguish what a source actually reported from what PropBetEdge infers from it.</li>
            <li><strong>Statistics and model inputs:</strong> values must come from a defined data path. A PropBetEdge-derived metric is not presented as an official league statistic.</li>
            <li><strong>Conflicts:</strong> when credible sources disagree, we represent the uncertainty or wait. We do not silently select the version that best fits an angle.</li>
            <li><strong>Rights and access:</strong> technical availability is not the same as permission. Our data and editorial systems are expected to respect source-access rules, licensing boundaries and documented provenance.</li>
          </ul>
        </section>

        <section class="editorial-section" id="byline-system">
          <h2>Our byline system</h2>
          <p>PropBetEdge uses bylines to describe accountability, not to create the appearance of a traditional newsroom workflow that did not occur.</p>
          <ul class="editorial-list">
            <li><strong>Named human byline:</strong> a real person owns the thesis, analysis and conclusions published under that name. AI or automation may be used extensively in the process.</li>
            <li><strong>Operational newsroom byline:</strong> <a href="/authors/propbetedge-editorial-team">PropBetEdge Editorial Team</a> identifies a newsroom system and editorial process when a story cannot honestly be attributed to one named person. It is an organizational byline, not a fictitious human.</li>
            <li><strong>Product/model output:</strong> live scores, model probabilities, Player DNA, market states and other deterministic product outputs are not turned into a human byline merely because they appear next to editorial content.</li>
          </ul>
          <p>Every current byline has a permanent profile on the <a href="/authors">Editorial Team</a> page. A named person is represented as a person. An operational byline is represented as an organization.</p>
        </section>

        <section class="editorial-section" id="founder-led">
          <h2>Founder-led analysis: Justin Erickson</h2>
          <p>
            <a href="/authors/justin-erickson">Justin Erickson</a> is the founder and CEO of PropTechUSA.ai and the founder and chief architect of PropBetEdge. His PropBetEdge byline is reserved primarily for work where sports analysis, product architecture and operating judgment intersect — including model and methodology explainers, market structure, data provenance, product decisions, cross-sport analysis and coverage where the system behind a conclusion matters as much as the headline.
          </p>
          <p>
            A Justin Erickson byline means he owns the thesis, materially directs or shapes the analysis, and stands behind the published judgment. It does <strong>not</strong> mean every sentence was manually typed by him, and we do not hide the use of AI. AI may participate deeply in research organization, source comparison, data and code review, structured analysis, drafting and revision.
          </p>
          <p>
            Founder status does not exempt an article from sourcing, corrections or disclosure. It increases the accountability attached to the byline: product claims, model claims and editorial conclusions published under his name are expected to survive the same evidence standard applied elsewhere on the network.
          </p>
        </section>

        <section class="editorial-section" id="ai-disclosure">
          <h2>AI &amp; automation disclosure</h2>
          <p>
            AI is part of PropBetEdge's operating infrastructure, not a hidden ghostwriter category. The relevant disclosure is who or what is accountable for the work and whether its claims can be traced to evidence.
          </p>
          <p>
            Named human bylines — including <a href="/authors/justin-erickson">Justin Erickson</a>, <a href="/authors/erik-schwartz">Erik Schwartz</a> and <a href="/authors/ty-whitney">Ty Whitney</a> — identify the person accountable for the published thesis and conclusions. AI tools may assist at any stage of the workflow.
          </p>
          <p>
            The <strong><a href="/authors/propbetedge-editorial-team">PropBetEdge Editorial Team</a></strong> is an operational newsroom byline. That workflow may include source discovery, structured extraction, AI-assisted drafting, deterministic checks, publication gates and targeted human intervention. We do <strong>not</strong> claim that a human manually writes or reviews every sentence carrying that byline.
          </p>
        </section>

        <section class="editorial-section" id="model-output">
          <h2>Models, picks &amp; market intelligence</h2>
          <ul class="editorial-list">
            <li><strong>Models are probabilistic.</strong> A probability, projection, confidence score, Player DNA metric or algorithmic pick is an estimate produced under a defined method — not a guarantee.</li>
            <li><strong>Model state matters.</strong> Research, shadow, validated, official and production states are not interchangeable. Where a product exposes a state, editorial language should respect it.</li>
            <li><strong>Official calls and editorial ideas are not interchangeable.</strong> A featured player, editorial angle, research output or shadow result must not be retroactively presented as an official model pick.</li>
            <li><strong>Results stay with the call.</strong> Where PropBetEdge maintains a public or product track record, losses remain visible and historical outcomes are not backfilled to improve the record.</li>
            <li><strong>Market data is time-sensitive.</strong> Prices, odds and prediction-market states can move rapidly. Time of observation matters; a later price is not evidence of what was available at the original decision point.</li>
            <li><strong>Market price and model probability are separate unless a disclosed methodology says otherwise.</strong> A market benchmark should not be silently laundered into an independent-model claim.</li>
          </ul>
        </section>

        <section class="editorial-section" id="corrections">
          <h2>Corrections, updates &amp; record preservation</h2>
          <p>We correct factual mistakes. We do not use corrections as permission to erase an inconvenient historical record.</p>
          <ul class="editorial-list">
            <li><strong>Minor factual corrections</strong> may be repaired in place and should be noted when the change is meaningful to a reader's understanding.</li>
            <li><strong>Material corrections</strong> — including errors that change the thesis, a pick, a model interpretation or a consequential factual claim — should receive a visible correction or update notice.</li>
            <li><strong>Publication timestamps</strong> should not be moved simply because a story was corrected. The original publication event remains part of the record.</li>
            <li><strong>Model and pick history</strong> should not be rewritten after outcomes are known. Data or grading corrections should be traceable.</li>
            <li><strong>Live modules may change without rewriting the article.</strong> A current score, market or live-data module can update in place while the story's historical evidence remains preserved.</li>
            <li><strong>Reader corrections:</strong> send the article URL, exact claim at issue and supporting evidence to <a href="mailto:editorial@proptechusa.ai">editorial@proptechusa.ai</a>.</li>
          </ul>
        </section>

        <section class="editorial-section" id="ethics">
          <h2>Independence, conflicts &amp; commercial separation</h2>
          <ul class="editorial-list">
            <li>We do not accept payment in exchange for favorable editorial coverage or a favorable pick.</li>
            <li>Advertising, sponsorships and affiliate relationships must not be disguised as independent editorial judgment.</li>
            <li>Commercial relationships do not authorize a sponsor to rewrite editorial conclusions.</li>
            <li>PropBetEdge's own products may be linked from editorial pages, but house promotion must remain distinguishable from source evidence.</li>
            <li>Access to internal products, models or company systems does not permit an author to present an internal hypothesis as an externally verified fact.</li>
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
            PropBetEdge covers men's and women's sports and is designed around sport-specific intelligence rather than market size alone. Editorial priority should be driven by significance, evidence and reader value — not by whether a team, athlete or league is already receiving the most attention elsewhere.
          </p>
          <p>
            We do not manufacture a diversity claim by forcing equal story counts across unequal news cycles. We do expect consistent standards of accuracy, respect and evidence regardless of athlete, team, league, country or audience.
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
            PropBetEdge is operated by Local Home Buyers LLC d/b/a PropTechUSA.ai. PropBetEdge's newsroom, sports-intelligence products, data systems, APIs, models and automation operate inside the broader PropTechUSA.ai technology organization.
          </p>
          <p>
            The shared operating environment is intentional: journalism, live data, model governance, product behavior and source provenance can inform one another. That integration does not remove the obligation to distinguish sourced fact, analysis, model output and promotion.
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
