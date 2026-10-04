/**
 * PropBetEdge Editorial Standards — public trust center (V2, 2026-10-04).
 *
 * The rules the system must obey: what we publish -> where facts come from -> how AI is used -> how models are
 * treated -> what gets blocked -> how corrections work -> who is accountable. /authors is who is accountable;
 * /authors/justin-erickson is who built and operates the system; this page is the rules.
 *
 * Policy text is preserved from V1 wherever it already said the right thing; V2 is structure, hierarchy and a few
 * explicit additions (publication gates, the AI workflow, the four kinds of information, the model-state legend).
 * Crawler copy: middleware.js buildServerEditorialStandardsHtml. Styles: src/styles/editorial-standards.css.
 */

import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { PROPBETEDGE_X_URL, PROPBETEDGE_X_HANDLE } from '../social.js';
import { listNamedAuthors, listOperationalBylines, authorSlug } from '../editorial/authors-registry.js';
import {
  organizationSchema, websiteSchema, breadcrumbSchema, injectSchemas,
} from '../schema.js';

const UPDATED_ISO = '2026-10-04';
const UPDATED_LABEL = 'October 4, 2026';
const CORRECTIONS_EMAIL = 'editorial@proptechusa.ai';

export const STANDARDS_TOC = Object.freeze([
  ['standard', 'Our standard'],
  ['sources', 'Sources'],
  ['ai', 'AI & automation'],
  ['bylines', 'Bylines'],
  ['models', 'Models & markets'],
  ['gates', 'Publication gates'],
  ['corrections', 'Corrections'],
  ['independence', 'Independence'],
  ['responsible-betting', 'Responsible betting'],
  ['accountability', 'Accountability'],
]);

// Canonical public model-state vocabulary (PropBetEdge Predictions engine registry). Sport products use their own
// labels (e.g. NFL "validation signal" vs "official pick"); this legend never reclassifies any model.
export const MODEL_STATES = Object.freeze(['MONITORING', 'SHADOW', 'RESEARCH', 'VALIDATED', 'OFFICIAL']);

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function editorialStandardsHtml() {
  const named = listNamedAuthors();
  const desks = listOperationalBylines();
  return `
    ${renderHeader({ mode: 'editorial' })}
    <main class="es">
      <header class="es-hero">
        <div class="container es-hero-inner">
          <p class="es-eyebrow">TRUST · EDITORIAL</p>
          <h1 class="es-title">Editorial Standards</h1>
          <p class="es-lede"><strong>Evidence before fluency.</strong> Every reported fact, model output and editorial conclusion should be traceable to what supported it at publication time.</p>
          <p class="es-pillars">Clear bylines · sourced facts · explicit uncertainty · visible corrections · permanent model records</p>
          <div class="es-hero-foot">
            <p class="es-updated">Last updated · <time datetime="${UPDATED_ISO}">${UPDATED_LABEL}</time></p>
            <nav class="es-actions" aria-label="Editorial actions">
              <a href="/authors">Meet the editorial team</a>
              <a href="#corrections">Report a correction</a>
              <a href="https://predictions.propbetedge.ai/methodology" target="_blank" rel="noopener">Read methodology</a>
            </nav>
          </div>
        </div>
      </header>

      <div class="container es-layout">
        <nav class="es-toc" aria-label="On this page">
          <p class="es-toc-k">On this page</p>
          <ol>${STANDARDS_TOC.map(([id, label]) => `<li><a href="#${id}">${esc(label)}</a></li>`).join('')}</ol>
        </nav>

        <div class="es-doc">

          <section class="es-sec" id="standard" aria-labelledby="h-standard">
            <h2 id="h-standard"><span class="es-n">01</span>Our standard</h2>
            <p>PropBetEdge is a sports-intelligence network with an original newsroom. The network spans MLB, NFL, NBA, WNBA, NHL, UFC, Tennis, Soccer, Golf and F1, with sport-native products, data systems and editorial surfaces connected under one brand.</p>
            <p>Our job is not to manufacture certainty or publish volume for its own sake. Our job is to tell readers what is known, where it came from, what is inference or model output, what remains uncertain, and what changed when a published claim needs correction.</p>
            <ol class="es-principles">
              <li><h3>Evidence before fluency</h3><p>A polished sentence is not evidence. A model score is not a fact. A source link is not permission to misstate what the source says. If the evidence does not support a specific claim, the claim should not ship.</p></li>
              <li><h3>No invented precision</h3><p>Missing, stale, conflicting or unavailable data remains missing, stale, conflicting or unavailable. We do not fill a hole because a number would make the story read better.</p></li>
              <li><h3>Separate fact from inference</h3><p>Fact, analysis and model output are different things. We label and write them differently. Observed facts should be verifiable; analysis is our interpretation; model outputs are derived estimates with uncertainty.</p></li>
              <li><h3>Preserve the record</h3><p>Publication history matters. We do not quietly rewrite a past call after the result is known. Corrections can amend a story; they do not erase the fact that an earlier version existed.</p></li>
            </ol>
            <ul class="es-list">
              <li><strong>Primary evidence first.</strong> When an official league, team, athlete, tournament, regulator, public record or other primary source can establish a fact, we prefer it over a secondary retelling.</li>
              <li><strong>Attribution stays attached.</strong> Material facts derived from outside reporting should be attributed or linked where appropriate. We do not present another publisher's original reporting as our own reporting.</li>
              <li><strong>Reader value over content volume.</strong> A story should add verified context, analysis, intelligence or useful connection to the underlying sport — not exist simply to increase page count.</li>
            </ul>
          </section>

          <section class="es-sec" id="sources" aria-labelledby="h-sources">
            <h2 id="h-sources"><span class="es-n">02</span>Source hierarchy &amp; verification</h2>
            <p>Source quality depends on the claim. Our preferred order is primary or official evidence, then high-quality direct reporting, then additional secondary context. We may use multiple sources when one source cannot establish the full claim — this is an order of preference, not a requirement that every story use every kind of source.</p>
            <ol class="es-ladder" aria-label="Source preference, strongest first">
              <li><span class="es-step">01</span><div><h3>Primary / official</h3><p>Leagues, teams, athletes, governing bodies, tournaments, regulators and public records.</p></div></li>
              <li><span class="es-step">02</span><div><h3>Direct reporting</h3><p>Credible first-hand reporting where primary evidence is unavailable — with what the source reported kept separate from what we infer.</p></div></li>
              <li><span class="es-step">03</span><div><h3>Structured providers</h3><p>Sports and data feeds, with the provider, its state and the timestamp treated as part of the evidence.</p></div></li>
              <li><span class="es-step">04</span><div><h3>Secondary context</h3><p>Used with attribution; never transformed into original reporting.</p></div></li>
            </ol>
            <p class="es-rule"><strong>Conflicting sources</strong> → represent the uncertainty or <strong>hold publication</strong>. When credible sources disagree, we do not silently choose the version that best fits an angle.</p>
            <ul class="es-list">
              <li><strong>Identity and status:</strong> official rosters, organizations, governing bodies and other authoritative records take priority.</li>
              <li><strong>Scores, schedules and game state:</strong> sport-native or official data is preferred, with provider state and timestamps treated as part of the evidence.</li>
              <li><strong>Statistics and model inputs:</strong> values should come from a defined data path. A derived metric must not be presented as an official league statistic.</li>
            </ul>
          </section>

          <section class="es-sec" id="ai" aria-labelledby="h-ai">
            <h2 id="h-ai"><span class="es-n">03</span>AI, automation &amp; authorship disclosure</h2>
            <p>PropBetEdge uses AI and automation throughout its newsroom and product infrastructure. We disclose that because the useful question is not whether software touched a story; it is whether the resulting claims are sourced, reviewable and honestly attributed.</p>
            <ol class="es-flow" aria-label="Newsroom workflow">
              <li>Source</li><li>Structured evidence</li><li>AI / editorial draft</li><li>Fact + quality gates</li><li><span>Publish</span> / <span>Hold</span></li>
            </ol>
            <p class="es-note">Workflows vary by product and story class; not every story passes through every stage in the same way.</p>
            <div class="es-two">
              <div><h3>AI may assist</h3><ul class="es-list es-list--tight"><li>Discovery</li><li>Organization</li><li>Extraction</li><li>Drafting</li><li>Checking</li></ul></div>
              <div><h3>AI cannot make unsupported facts true</h3><ul class="es-list es-list--tight es-list--no"><li>Unsupported names</li><li>Unsupported numbers</li><li>Invented quotes</li><li>Unsupported injuries</li><li>Invented precision</li></ul></div>
            </div>
            <p>Automation does not lower the factual standard. Unsupported specifics should be withheld, model output should not be laundered into reported fact, and a system should fail closed when required evidence is unavailable. <strong>If required evidence is missing, the expected behavior is to hold — not to fill in the blank.</strong></p>
            <p>We do not use “human reviewed” as a blanket marketing claim. Some work receives direct named-human authorship and judgment; some work is produced by the operational newsroom; some surfaces are deterministic data or model products rather than journalism. The label and byline should tell the reader which is which.</p>
            <p>Live state and archival claims are not the same thing. Scores, lineups, prices and market states can update in a live module while the historical claims in a published story remain tied to the evidence and timestamps available at publication time.</p>
          </section>

          <section class="es-sec" id="bylines" aria-labelledby="h-bylines">
            <h2 id="h-bylines"><span class="es-n">04</span>Byline integrity</h2>
            <div class="es-two es-bylines">
              <div class="es-byline">
                <p class="es-k">Named human</p>
                <ul class="es-names">${named.map((a) => `<li><a href="/authors/${esc(a.slug || authorSlug(a.name))}">${esc(a.name)}</a></li>`).join('')}</ul>
                <p>The named person is accountable for the thesis, analysis and conclusions published under that name. AI tools may participate throughout research, organization, source comparison, data or code review, drafting and revision. A named byline is a statement of accountable judgment — not a claim that every sentence was manually typed.</p>
              </div>
              <div class="es-byline es-byline--org">
                <p class="es-k">Operational newsroom</p>
                <ul class="es-names">${desks.map((a) => `<li><a href="/authors/${esc(a.slug || authorSlug(a.name))}">${esc(a.name)}</a></li>`).join('')}</ul>
                <p>PropBetEdge Editorial Team is an operational newsroom byline, not a fictitious person. It is used when a story is produced through newsroom systems and cannot honestly be attributed to one named human author. That workflow may include source discovery, structured extraction, AI-assisted drafting, automated checks, publication gates and editorial intervention. We do <strong>not</strong> claim that a human manually writes or reviews every sentence carrying the operational byline.</p>
              </div>
            </div>
            <p>Every current byline has a permanent profile on the <a href="/authors">Editorial Team</a> page. Named people are represented as people. The PropBetEdge Editorial Team is represented as an organizational editorial operation. We do not create fictional human identities to make automated work appear human-authored.</p>
            <div class="es-founder-rule">
              <p class="es-k">Founder-led analysis · Justin Erickson</p>
              <p><a href="/authors/justin-erickson">Justin Erickson</a> is the founder and CEO of PropTechUSA.ai and the founder and chief architect of PropBetEdge. His byline is reserved primarily for work where sports analysis, product architecture and operating judgment intersect — including model and methodology explainers, market structure, data provenance, product decisions and cross-sport analysis.</p>
              <p>A Justin Erickson byline means he owns the thesis, materially directs or shapes the analysis, and stands behind the published judgment. AI may assist deeply; the byline does <strong>not</strong> mean every sentence was manually typed by him.</p>
            </div>
            <p>If a contributor relationship changes, archival journalism is not automatically deleted. Where reattribution is necessary, the canonical URL and original publication history should remain intact rather than turning an authorship change into a silent rewrite of the archive.</p>
          </section>

          <section class="es-sec" id="models" aria-labelledby="h-models">
            <h2 id="h-models"><span class="es-n">05</span>Models, picks &amp; market intelligence</h2>
            <dl class="es-kinds">
              <div><dt>Observed fact</dt><dd>Score, lineup, injury report, venue data.</dd></div>
              <div><dt>Derived PBE metric</dt><dd>Probability, projection, Player DNA, model score.</dd></div>
              <div><dt>Editorial analysis</dt><dd>Interpretation based on evidence.</dd></div>
              <div><dt>Market observation</dt><dd>A price or odds observed from a venue at a specific time.</dd></div>
            </dl>
            <p class="es-rule"><strong>Markets do not become model truth simply because they disagree with PBE</strong> — and a model does not become fact because a market agrees with it.</p>
            <ul class="es-list">
              <li><strong>Models are probabilistic.</strong> A probability, projection, confidence score, Player DNA metric or algorithmic pick is an estimate produced under a defined method — not a guarantee.</li>
              <li><strong>Official calls and editorial ideas are not interchangeable.</strong> When a product distinguishes an official model pick from a featured player, editorial showcase, research output or shadow result, we preserve that distinction.</li>
              <li><strong>Results stay with the call.</strong> Where PropBetEdge maintains a public or product track record, losses remain visible and historical outcomes are not backfilled to create a better-looking record.</li>
              <li><strong>Market data is time-sensitive.</strong> Prices, odds and prediction-market states can move rapidly. Time of observation matters, and a later price should not be presented as though it were available when an earlier call was made.</li>
              <li><strong>Model state matters.</strong> Research, shadow, validated, official and production states are not interchangeable. Editorial language must respect the model's actual state at the time of the claim.</li>
              <li><strong>Market price and model probability are separate unless a disclosed methodology says otherwise.</strong> A benchmark or consensus price should not be silently laundered into an independent-model claim.</li>
            </ul>
            <div class="es-states">
              <p class="es-k">Model state</p>
              <ol class="es-state-rail">${MODEL_STATES.map((s) => `<li>${s}</li>`).join('')}</ol>
              <p>A model's state describes evidence maturity and publication status; it is not a confidence adjective. These are the public states used by <a href="https://predictions.propbetedge.ai/" target="_blank" rel="noopener">PropBetEdge Predictions</a>; each sport product labels its own model state, and not every sport has an official model.</p>
            </div>
            <p class="es-links"><a href="/odds/history">Track Record</a> · <a href="https://predictions.propbetedge.ai/methodology" target="_blank" rel="noopener">Methodology</a> · <a href="https://predictions.propbetedge.ai/" target="_blank" rel="noopener">Predictions</a></p>
          </section>

          <section class="es-sec" id="gates" aria-labelledby="h-gates">
            <h2 id="h-gates"><span class="es-n">06</span>What prevents a story from publishing</h2>
            <p>Publication may be withheld when required evidence or an integrity check fails. Examples of what can stop a story:</p>
            <ul class="es-list es-list--grid">
              <li>An unsupported person or team identity</li>
              <li>A number the evidence does not support</li>
              <li>An unsupported record claim</li>
              <li>An unsupported competition or standings claim</li>
              <li>An incomplete or conflicting source state</li>
              <li>Too little verified material for a story</li>
            </ul>
            <p class="es-rule"><strong>When evidence and prose disagree, evidence wins.</strong> A held story is preferable to a confident false story.</p>
          </section>

          <section class="es-sec" id="corrections" aria-labelledby="h-corrections">
            <h2 id="h-corrections"><span class="es-n">07</span>Corrections, updates &amp; record preservation</h2>
            <p>We correct factual mistakes. We do not use corrections as permission to erase an inconvenient historical record.</p>
            <dl class="es-kinds es-kinds--steps">
              <div><dt>Minor correction</dt><dd>Minor factual corrections may be repaired in place and should be noted when the change is meaningful to a reader's understanding.</dd></div>
              <div><dt>Material correction</dt><dd>Material corrections — including errors that change the thesis, a pick, a model interpretation or a consequential factual claim — should receive a visible correction or update notice.</dd></div>
              <div><dt>Model / pick grading</dt><dd>Model and pick history should not be rewritten after outcomes are known. Corrections to data or grading should be traceable rather than silently replacing the past.</dd></div>
              <div><dt>Original publication time</dt><dd>Publication timestamps should not be moved simply because a story was corrected. The original publication event remains part of the record.</dd></div>
              <div><dt>Live modules</dt><dd>A current score, market or live-data module may update in place while the story's historical evidence and decision-time context remain preserved.</dd></div>
            </dl>
            <p class="es-rule"><strong>Correction is not deletion of history.</strong></p>
            <div class="es-report">
              <h3>Report an issue</h3>
              <p>Send the article URL, the exact claim at issue and supporting evidence to <a href="mailto:${CORRECTIONS_EMAIL}">${CORRECTIONS_EMAIL}</a>.</p>
              <ul class="es-list es-list--tight"><li>Article URL</li><li>The exact claim</li><li>Supporting evidence</li></ul>
            </div>
          </section>

          <section class="es-sec" id="independence" aria-labelledby="h-independence">
            <h2 id="h-independence"><span class="es-n">08</span>Independence, conflicts &amp; commercial separation</h2>
            <p class="es-rule"><strong>Commercial relationships do not authorize a sponsor, data provider or platform partner to alter an editorial conclusion.</strong></p>
            <dl class="es-kinds">
              <div><dt>Editorial</dt><dd>Evidence and analysis. We do not accept payment in exchange for favorable editorial coverage or a favorable pick.</dd></div>
              <div><dt>House product promotion</dt><dd>PropBetEdge's own products may be linked from editorial pages, but house promotion should be identifiable as product promotion rather than source evidence.</dd></div>
              <div><dt>Advertising &amp; sponsorship</dt><dd>Advertising, sponsorships and affiliate relationships must not be disguised as independent editorial judgment, and cannot purchase favorable editorial judgment.</dd></div>
              <div><dt>Third-party brands</dt><dd>Third-party league, team, athlete, sportsbook and market names remain the property of their respective owners; reference does not imply endorsement or affiliation.</dd></div>
            </dl>
            <h3 class="es-h3">Coverage &amp; representation</h3>
            <p>The PropBetEdge network covers men's and women's sports and is designed around sport-specific intelligence rather than market size alone. Editorial priority should be driven by significance, evidence and reader value — not by whether a team, athlete or league is already receiving the most attention elsewhere.</p>
            <p>We do not manufacture a diversity claim by forcing equal story counts across unequal news cycles. We do expect consistent standards of accuracy, respect and evidence regardless of the athlete, team, league, country or audience being covered.</p>
          </section>

          <section class="es-sec" id="responsible-betting" aria-labelledby="h-rb">
            <h2 id="h-rb"><span class="es-n">09</span>Responsible betting</h2>
            <p>PropBetEdge is a sports intelligence and entertainment service, not a sportsbook. Wagering involves risk and no article, model, probability or pick guarantees an outcome or profit.</p>
            <ul class="es-list">
              <li>Never wager money you cannot afford to lose.</li>
              <li>Do not chase losses or treat a model streak as certainty.</li>
              <li>Past performance does not guarantee future results.</li>
              <li>You are responsible for complying with the age and location rules that apply where you are.</li>
              <li>If gambling is causing harm or feels difficult to control, stop wagering and seek help. In the United States, call or text <strong>1-800-GAMBLER</strong>.</li>
            </ul>
          </section>

          <section class="es-sec es-accountability" id="accountability" aria-labelledby="h-acc">
            <h2 id="h-acc"><span class="es-n">10</span>Challenge our work</h2>
            <p class="es-lead">If you believe a factual claim is wrong, send us the article, the disputed claim and the evidence. Readers should be able to challenge our work with the same evidence standard we expect internally.</p>
            <dl class="es-contacts">
              <div class="es-contact-primary"><dt>Editorial / corrections</dt><dd><a href="mailto:${CORRECTIONS_EMAIL}">${CORRECTIONS_EMAIL}</a></dd></div>
              <div><dt>Support</dt><dd><a href="mailto:support@proptechusa.ai">support@proptechusa.ai</a></dd></div>
              <div><dt>Press</dt><dd><a href="mailto:press@proptechusa.ai">press@proptechusa.ai</a></dd></div>
            </dl>
            <p class="es-social">Also on <a href="${PROPBETEDGE_X_URL}" target="_blank" rel="noopener noreferrer">X ${esc(PROPBETEDGE_X_HANDLE)}</a> and <a href="https://bsky.app/profile/propbetedge.bsky.social" target="_blank" rel="noopener noreferrer">Bluesky @propbetedge.bsky.social</a>.</p>

            <h3 class="es-h3" id="ownership">Ownership &amp; editorial responsibility</h3>
            <p>PropBetEdge is operated by Local Home Buyers LLC d/b/a PropTechUSA.ai. PropBetEdge's newsroom, sports-intelligence products, data systems, APIs, models and automation operate within the broader PropTechUSA.ai technology organization.</p>
            <p>Editorial, live data, model governance, product behavior and source provenance operate inside one connected system by design. That integration does not change the obligation to distinguish sourced fact, analysis, model output and promotion — it makes that distinction more important.</p>
            <p class="es-links"><a href="/about">About PropBetEdge</a> · <a href="/authors">Editorial Team</a> · <a href="/legal">Legal</a> · <a href="/terms">Terms of Service</a></p>
            <p class="es-living">These standards are living. Material changes are dated. Last updated: ${UPDATED_LABEL}.</p>
          </section>
        </div>
      </div>
    </main>
    ${renderFooter({ cta: false })}
  `;
}

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

  root.innerHTML = editorialStandardsHtml();
  highlightToc(root);
}

// Progressive enhancement only: the TOC is plain anchor links; this marks the section in view.
function highlightToc(root) {
  if (typeof IntersectionObserver === 'undefined') return;
  const links = new Map([...root.querySelectorAll('.es-toc a')].map((a) => [a.getAttribute('href').slice(1), a]));
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      for (const a of links.values()) a.removeAttribute('aria-current');
      links.get(e.target.id)?.setAttribute('aria-current', 'location');
    }
  }, { rootMargin: '-30% 0px -60% 0px' });
  for (const id of links.keys()) { const s = root.querySelector(`#${id}`); if (s) io.observe(s); }
}
