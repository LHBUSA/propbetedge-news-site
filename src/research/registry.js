/**
 * PropBetEdge Research — the one registry for /research and its pages (DOM-free: the client renderer, the Edge
 * middleware crawler copy, the sitemap and the footer all read this file).
 *
 * Scope rule (owner 2026-10-04): explain the science and engineering PRINCIPLES at a high level. Never publish
 * feature weights, formulas, thresholds, proprietary signals, source-selection logic, internal endpoints, code,
 * private datasets or anything else that materially exposes model IP. Every statement describes a practice the
 * network actually runs today; nothing here is aspirational.
 */

export const RESEARCH_UPDATED = { iso: '2026-10-04', label: 'October 4, 2026' };

export const RESEARCH_NOT_PUBLISHED = Object.freeze([
  'Feature weights, formulas or model coefficients',
  'Decision thresholds and gate values',
  'Proprietary signals and how they are built',
  'Source-selection logic and internal endpoints',
  'Code, private datasets and anything that materially exposes model IP',
]);

export const RESEARCH_PAGES = Object.freeze([
  Object.freeze({
    slug: '',
    path: '/research',
    label: 'Research',
    title: 'How PropBetEdge intelligence is built',
    description: 'The research process behind PropBetEdge: evidence provenance, canonical state, prospective validation, shadow research, calibration, frozen predictions, model governance and permanent records.',
    lede: 'Every probability, projection and call on PropBetEdge comes out of a research process designed to be checked: evidence with provenance, one canonical state of the world, predictions frozen before outcomes, and records that stay public after the result is known.',
    sections: Object.freeze([
      Object.freeze({ id: 'principles', h: 'Principles', body: Object.freeze([
        'Evidence before fluency. A model output, a story and a product surface all start from evidence whose source and capture time are recorded.',
        'Uncertainty is the output. Models produce probabilities and ranges, not promises, and the products show them that way.',
        'The record is permanent. Official calls are frozen before the event, graded after it, and never quietly rewritten.',
        'Research is labeled. Candidate models run in replay and shadow before they can affect anything a customer sees.',
      ]) }),
    ]),
  }),
  Object.freeze({
    slug: 'methodology',
    path: '/research/methodology',
    label: 'Methodology & Validation',
    title: 'Methodology & validation',
    description: 'How PropBetEdge validates models: prospective validation, point-in-time replay, shadow evaluation, calibration against outcomes and baselines, and visible losses.',
    lede: 'A model is only as credible as the way it is tested. PropBetEdge validates prospectively — on decisions made before outcomes were known — and treats every other kind of evidence as supporting, never sufficient.',
    sections: Object.freeze([
      Object.freeze({ id: 'prospective', h: 'Prospective validation', body: Object.freeze([
        'The evidence that counts most is a decision issued before the event, frozen, and graded after it. Retrospective fits can suggest a model is promising; they cannot prove it.',
        'Official calls carry their issue time and lock at the start of the event. Nothing issued, changed or withdrawn after that boundary can enter the record.',
      ]) }),
      Object.freeze({ id: 'replay', h: 'Point-in-time replay', body: Object.freeze([
        'Candidate logic is replayed against evidence exactly as it existed at decision time. Inputs that only became known later are excluded, so a replay cannot borrow from the future.',
      ]) }),
      Object.freeze({ id: 'shadow', h: 'Shadow evaluation', body: Object.freeze([
        'Shadow models run alongside production on live inputs. Their outputs are recorded and graded, but they never change official, customer-facing output while they are being evaluated.',
      ]) }),
      Object.freeze({ id: 'calibration', h: 'Calibration and baselines', body: Object.freeze([
        'Probabilities are scored against outcomes with proper scoring rules, and checked for calibration: events given a 60% chance should happen about 60% of the time.',
        'Models are compared with simple baselines and with the market reference where one exists. A model that cannot beat a naive baseline does not ship, however good its story.',
      ]) }),
      Object.freeze({ id: 'losses', h: 'Losses stay visible', body: Object.freeze([
        'Track records include every graded decision. Losses remain visible, replaced decisions are shown rather than hidden, and historical outcomes are never backfilled to improve a record.',
      ]) }),
    ]),
  }),
  Object.freeze({
    slug: 'model-governance',
    path: '/research/model-governance',
    label: 'Model Governance',
    title: 'Model governance',
    description: 'How PropBetEdge governs models: versioning, published model states, promotion gates, immutable issuance records and the separation of official, research and editorial output.',
    lede: 'Governance is what stops a promising experiment from quietly becoming a product claim. Every model has a version, a state, and a path into production that requires evidence.',
    sections: Object.freeze([
      Object.freeze({ id: 'versioning', h: 'Versioning', body: Object.freeze([
        'Every output is attributable to the model version that produced it. A new version is a new model for record-keeping purposes; it does not inherit or overwrite the old version’s results.',
      ]) }),
      Object.freeze({ id: 'states', h: 'Model states', body: Object.freeze([
        'A model’s state describes evidence maturity and publication status, not confidence. PropBetEdge Predictions uses MONITORING, SHADOW, RESEARCH, VALIDATED and OFFICIAL; each sport product labels its own model states, and not every sport has an official model.',
      ]) }),
      Object.freeze({ id: 'promotion', h: 'Promotion gates', body: Object.freeze([
        'A model moves toward production only when its prospective evidence, parity with the system it would replace and an explicit acceptance review all clear. Sample adequacy is part of the gate: enough graded decisions, across enough distinct periods.',
        'Promotion is a deliberate release, recorded with its date. A release can be withdrawn without rewriting what it already published.',
      ]) }),
      Object.freeze({ id: 'records', h: 'Immutable issuance records', body: Object.freeze([
        'Official decisions are written with issuance receipts — content hashes chained in order — so a published call can be checked against what was actually issued. This is internal tamper evidence, not third-party notarization.',
        'When a pre-event decision is replaced, both decisions remain on record; the replaced one is shown, never graded and never counted.',
      ]) }),
      Object.freeze({ id: 'separation', h: 'Official, research and editorial stay separate', body: Object.freeze([
        'Official model calls, research and shadow output, and editorial analysis are labeled differently and are not interchangeable. Market prices are observations, not model truth.',
      ]) }),
    ]),
  }),
  Object.freeze({
    slug: 'data-provenance',
    path: '/research/data-provenance',
    label: 'Data Provenance',
    title: 'Data provenance',
    description: 'How PropBetEdge treats data: canonical state, source hierarchy, timestamps as evidence, a missing-data policy that never invents values, rights discipline and timestamped market observations.',
    lede: 'Data is evidence only when you can say where it came from and when. PropBetEdge records both, keeps one canonical version of the world, and lets missing data stay missing.',
    sections: Object.freeze([
      Object.freeze({ id: 'canonical', h: 'Canonical state', body: Object.freeze([
        'Games, players, teams, events and markets resolve to canonical identifiers. Products, stories and models read the same canonical state instead of each page inventing its own version of the truth.',
      ]) }),
      Object.freeze({ id: 'sources', h: 'Source hierarchy', body: Object.freeze([
        'Official and primary sources take precedence. Provider identity, provider state and capture time are stored with the data and treated as part of the evidence.',
      ]) }),
      Object.freeze({ id: 'missing', h: 'Missing-data policy', body: Object.freeze([
        'Missing, stale or conflicting data is shown as missing, stale or conflicting. Values are never imputed and presented as observed, and a system without required evidence fails closed rather than filling the gap.',
      ]) }),
      Object.freeze({ id: 'markets', h: 'Market observations', body: Object.freeze([
        'Prices from prediction markets and sportsbooks are timestamped observations, kept per venue and never averaged into one number. A later price is never presented as if it were available at an earlier decision.',
      ]) }),
      Object.freeze({ id: 'rights', h: 'Rights and corrections', body: Object.freeze([
        'Data is collected and used under the rights that apply to it. Corrections to data or grading are traceable amendments, not silent replacements of the past.',
      ]) }),
    ]),
  }),
  Object.freeze({
    slug: 'intelligence-systems',
    path: '/research/intelligence-systems',
    label: 'Intelligence Systems',
    title: 'Intelligence systems',
    description: 'The PropBetEdge intelligence loop: observe, normalize, analyze, evaluate, research, promote and publish — with monitoring that reports degraded inputs honestly.',
    lede: 'PropBetEdge is built as a connected system rather than a set of pages: one loop that observes the sport, normalizes it, analyzes it, evaluates itself, and publishes with the evidence attached.',
    sections: Object.freeze([
      Object.freeze({ id: 'loop', h: 'The loop', steps: Object.freeze([
        ['Observe', 'Live scores, events, player and team state, lineups, injuries, weather, rankings, markets and source changes.'],
        ['Normalize', 'One canonical game, player, team, event and market state.'],
        ['Analyze', 'Sport-specific models, DNA systems, matchup intelligence, live context and market comparison.'],
        ['Evaluate', 'Official calls frozen before outcomes, graded after, kept as permanent records.'],
        ['Research', 'Candidate signals and models in replay and shadow, without touching official output.'],
        ['Promote', 'Into production only when evidence, parity and acceptance gates clear.'],
        ['Publish', 'Newsroom stories, entity pages, PBEcast and products connected back to the evidence.'],
      ]) }),
      Object.freeze({ id: 'monitoring', h: 'Monitoring', body: Object.freeze([
        'Runtime health and decision health are monitored separately: a page that loads on stale inputs is degraded, not healthy. Unknown or stale states are reported as unknown or stale, never shown as healthy by default.',
      ]) }),
      Object.freeze({ id: 'sport-native', h: 'Sport-native by design', body: Object.freeze([
        'Each sport is modeled on its own terms — a tennis point, a hockey shift and a baseball pitch are different evidence — while sharing the same provenance, governance and record-keeping rules.',
      ]) }),
    ]),
  }),
]);

export const researchPage = (path) => RESEARCH_PAGES.find((p) => p.path === path) || null;
export const researchSubpages = () => RESEARCH_PAGES.filter((p) => p.slug);
