/**
 * Canonical PropBetEdge byline registry.
 *
 * This module is deliberately DOM-free so the client renderer, Edge middleware,
 * structured data and newsroom UI all describe the same people and operational
 * bylines. A byline kind is part of the contract: named people are Person
 * entities; the PropBetEdge Editorial Team is an Organization/editorial
 * operation and must never be represented as a fictitious person.
 */

export const AUTHOR_PROFILES = Object.freeze({
  'justin-erickson': Object.freeze({
    name: 'Justin Erickson',
    kind: 'person',
    bylineLabel: 'Founder-led named human byline',
    role: 'Founder & CEO · Chief Architect',
    title: 'Founder & CEO, PropTechUSA.ai · Founder & Chief Architect, PropBetEdge',
    summary: 'Founder and operator behind PropBetEdge and the broader PropTechUSA.ai platform, responsible for product direction, data infrastructure, APIs, models, editorial systems and release standards across the sports-intelligence network.',
    bio: `Justin Erickson is the founder and CEO of PropTechUSA.ai and the founder and chief architect of PropBetEdge. He built PropBetEdge beyond a conventional sports publication into a connected sports-intelligence network: sport-native products, live PBEcast experiences, Player DNA and other proprietary intelligence layers, predictive systems, public model records, newsroom automation, and the PropSports data and API infrastructure underneath them.

His PropBetEdge byline is now reserved primarily for founder-led work where sports analysis, product architecture and operating judgment intersect — model and methodology explainers, market structure, data provenance, product and platform decisions, cross-sport analysis, and stories where the system behind the conclusion matters as much as the conclusion itself. It is not intended to make him look like a traditional beat writer.

Justin's editorial process is AI-native and engineering-led. He may use AI deeply for research organization, source comparison, data and code review, structured analysis, drafting and revision. A named Justin Erickson byline means he owns the thesis, materially directs or shapes the analysis, and stands behind the published judgment. It does not mean every sentence was manually typed by him or that software was absent from the process.

That distinction is central to how he runs PropBetEdge. Editorial is not separated from the data layer by a wall of handoffs: source provenance, evidence packets, live state, model versions, track records, product behavior and publication quality are treated as one connected system. Justin is responsible for the architecture and operating principles that keep those layers aligned — including explicit uncertainty, direct-source verification where available, visible corrections, source and rights discipline, versioned model behavior, and preserving the historical record after outcomes are known.

PropBetEdge operates inside PropTechUSA.ai alongside PropSports and PropData. Justin's broader role spans company strategy, data infrastructure, APIs, AI systems, product design, deployment and operating standards across those platforms. His articles remain subject to the same sourcing, corrections, disclosure and responsible-betting rules as every other PropBetEdge byline.`,
    expertise: Object.freeze([
      'Sports-intelligence systems & product architecture',
      'AI-native newsroom, editorial automation & publication systems',
      'Data infrastructure, APIs, provenance & source governance',
      'Model governance, probability, market structure & public track records',
      'Cross-sport product strategy & decision intelligence',
    ]),
    credentials: Object.freeze([
      'Founder & CEO — PropTechUSA.ai',
      'Founder & Chief Architect — PropBetEdge',
      'Builder & operator — PropSports data and API infrastructure',
      'Product and systems lead for the PropBetEdge intelligence network',
    ]),
    accountability: 'A founder-led named human byline. Justin Erickson owns the thesis, editorial judgment and conclusions published under his name. AI and automation may participate throughout research, analysis, drafting and revision; the byline is a statement of accountable direction and approval, not a claim that every word was manually written.',
    location: 'Saint Paul, MN',
    initials: 'JE',
    accent: 'gold',
  }),
  'erik-schwartz': Object.freeze({
    name: 'Erik Schwartz',
    kind: 'person',
    bylineLabel: 'Named human author',
    role: 'Senior Editorial — Hockey, Football & Baseball',
    title: 'Senior Editorial Contributor, PropBetEdge',
    summary: 'Senior editorial contributor focused on translating lineup, workload, roster and game-context changes into their downstream sports-intelligence implications.',
    bio: `Erik Schwartz is a senior editorial contributor at PropBetEdge with primary coverage across NHL, NFL and MLB, plus selected cross-sport assignments. His work focuses on the second-order consequences of sports news: not simply that a lineup changed, but which role, matchup, workload or market assumption changes with it.

In hockey, that means line combinations, goaltender usage, special-teams deployment and late availability context. In football, the emphasis is snap share, target redistribution and workload after injuries or transactions. In baseball, his coverage centers on pitching matchups, bullpen context and hitter or pitcher conditions that can materially change a pregame read.

Erik's byline is used for named editorial analysis rather than automated newsroom output. Source reporting and data are separated from interpretation, and uncertainty is stated when the evidence does not support a definitive conclusion. His work follows the same corrections and record-preservation rules applied across PropBetEdge.`,
    expertise: Object.freeze([
      'NHL lineup, goaltending & special-teams context',
      'NFL snap share, target distribution & workload changes',
      'MLB pitching, bullpen & matchup analysis',
      'Breaking news translated into downstream game context',
    ]),
    credentials: Object.freeze([
      'Senior Editorial Contributor — PropBetEdge',
      'Primary editorial coverage across NHL, NFL & MLB',
    ]),
    accountability: 'A named human byline. The author is accountable for the analysis and conclusions published under this name. AI tools may assist with research or drafting, but factual claims still require support and editorial conclusions remain attributable to the named author.',
    initials: 'ES',
    accent: 'gold',
  }),
  'ty-whitney': Object.freeze({
    name: 'Ty Whitney',
    kind: 'person',
    bylineLabel: 'Named human author',
    role: 'Senior Research Analyst & Data Scientist',
    title: 'Senior Research Analyst, PropBetEdge',
    summary: 'Senior research analyst focused on quantitative sports analysis, model interpretation, calibration, signal quality and translating statistical output into understandable decisions.',
    bio: `Ty Whitney is a senior research analyst and data scientist at PropBetEdge. His editorial lane is quantitative: separating signal from noise, interrogating model output, checking base rates and assumptions, and translating statistical evidence into language a reader can actually evaluate.

His work emphasizes the difference between a number and a conclusion. A projection, probability or trend is presented with the context needed to understand what it measures, what it does not measure and how much uncertainty remains. That standard matters most in sports markets, where small edges can be overwhelmed by bad assumptions or stale inputs.

Across baseball, football, basketball and hockey coverage, Ty's byline is used when the story depends heavily on data interpretation, methodology or model context. His work follows PropBetEdge's sourcing, corrections, AI-disclosure and responsible-betting standards, including the rule that model outputs are probabilistic rather than promises.`,
    expertise: Object.freeze([
      'Quantitative sports analysis & predictive modeling',
      'Signal validation, calibration & uncertainty',
      'Backtesting and model interpretation',
      'Translating statistical output into reader-facing analysis',
    ]),
    credentials: Object.freeze([
      'Senior Research Analyst — PropBetEdge',
      'Data-science and quantitative research focus',
      'Multi-sport analytical coverage',
    ]),
    accountability: 'A named human byline. The author is accountable for the interpretation and conclusions published under this name. AI may assist research or drafting, but the page must distinguish observed facts, derived metrics and editorial judgment.',
    initials: 'TW',
    accent: 'algo',
  }),
  'propbetedge-editorial-team': Object.freeze({
    name: 'PropBetEdge Editorial Team',
    kind: 'organization',
    bylineLabel: 'Operational newsroom byline',
    role: 'Editorial Operations · AI-Assisted',
    title: 'PropBetEdge Editorial Operations',
    summary: 'The disclosed operational byline for PropBetEdge newsroom automation and editorial systems when a story is not attributable to one named human author.',
    bio: `The PropBetEdge Editorial Team is an operational newsroom byline, not a fictitious person. It is used when a published story is produced through PropBetEdge's newsroom systems and cannot honestly be attributed to one named human author.

The workflow can include source discovery and retrieval, structured extraction, AI-assisted drafting, data and identity checks, publication-integrity gates, formatting, and editorial intervention where the story or risk level requires it. The exact path can vary by sport and story type. We do not claim that a human manually writes or reviews every sentence published under this operational byline.

The governing rule is evidence over fluency. A system-generated sentence does not become a fact because it sounds confident. Source-backed claims must remain traceable to evidence; unsupported specifics are withheld rather than invented; analysis must be distinguishable from observed facts; and corrections must preserve the publication record.

Named contributors — Justin Erickson, Erik Schwartz and Ty Whitney — have their own permanent profiles and bylines. When an article carries the PropBetEdge Editorial Team byline, readers should understand that they are seeing the output of the disclosed newsroom operation rather than an unnamed human writer.`,
    expertise: Object.freeze([
      'Rapid-response sports newsroom operations',
      'AI-assisted drafting and structured editorial workflows',
      'Source, identity & publication-integrity checks',
      'Cross-sport factual and analytical coverage',
    ]),
    credentials: Object.freeze([
      'Operational byline — not a Person entity',
      'PropBetEdge newsroom systems and editorial process',
      'Public AI and automation disclosure',
    ]),
    accountability: 'An operational newsroom byline, not a human identity. Accountability rests with PropBetEdge and its editorial process. The byline identifies automated and editorial production honestly instead of inventing a person.',
    initials: 'PE',
    accent: 'algo',
  }),
});

export function authorSlug(name) {
  return String(name || '').toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
}

export function getAuthorBySlug(slug) {
  return AUTHOR_PROFILES[String(slug || '').toLowerCase()] || null;
}

export function listAuthors() {
  return Object.entries(AUTHOR_PROFILES).map(([slug, profile]) => ({ slug, ...profile }));
}

export function listNamedAuthors() {
  return listAuthors().filter((author) => author.kind === 'person');
}

export function listOperationalBylines() {
  return listAuthors().filter((author) => author.kind === 'organization');
}
