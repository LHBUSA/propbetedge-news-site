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
    bylineLabel: 'Named human author',
    role: 'Founder & CTO',
    title: 'Founder & Chief Technology Officer, PropBetEdge',
    summary: 'Founder and product architect of PropBetEdge, focused on sports-intelligence systems, model governance, data provenance and the connection between reporting, live data and decision tools.',
    bio: `Justin Erickson is the founder and chief technology officer of PropBetEdge and the product architect behind its sports-intelligence network. His work sits at the intersection of sports coverage, data infrastructure, predictive systems and product design: building the systems that turn live information into research tools, model outputs, PBEcast experiences and permanent records.

His PropBetEdge byline is used for work where the technical or strategic context matters as much as the headline — product and methodology explainers, cross-sport analysis, model and market structure, and coverage that connects what happened on the field to how the platform measures it.

As founder, Justin is responsible for the architecture and operating principles behind PropBetEdge: source provenance, explicit uncertainty, versioned model behavior, evidence-backed publication, and preserving the historical record rather than rewriting it after results are known.

PropBetEdge is operated within the PropTechUSA.ai organization. Justin is based in Saint Paul, Minnesota. His articles remain subject to the same sourcing, corrections, AI-disclosure and responsible-betting standards as every other PropBetEdge byline.`,
    expertise: Object.freeze([
      'Sports-intelligence product architecture',
      'Model governance, probability systems & market context',
      'Data provenance, APIs & evidence-backed product design',
      'Cross-sport strategy and decision intelligence',
    ]),
    credentials: Object.freeze([
      'Founder & CTO — PropBetEdge',
      'Founder — PropTechUSA.ai',
      'Product architect for the PropBetEdge intelligence network',
    ]),
    accountability: 'A named human byline. The author is accountable for the analysis and conclusions published under this name. AI and automation may assist research, organization or drafting, but they do not turn the byline into an automated persona.',
    location: 'Saint Paul, MN',
    initials: 'JE',
    accent: 'gold',
    // Founder / technical-operator presentation (src/pages/author-founder.js). Every line below is derived from the
    // bio, summary and accountability copy above: no counts, no metrics, nothing that has to be re-verified monthly.
    profileVariant: 'founder',
    founder: Object.freeze({
      eyebrow: 'Founder · Product Architect',
      positioning: 'Building sports-intelligence systems where live data, predictive models, journalism and permanent records meet.',
      facts: Object.freeze([
        'Founder · PropBetEdge',
        'Founder · PropTechUSA.ai',
        'Saint Paul, Minnesota',
        'Sports intelligence · data infrastructure · model governance',
      ]),
      pillars: Object.freeze([
        Object.freeze({ title: 'Sports Intelligence', body: 'How PropBetEdge connects live sports data, models, PBEcast, editorial context and permanent records into one research surface.' }),
        Object.freeze({ title: 'Data Infrastructure', body: 'APIs, evidence provenance, canonical identifiers, ingestion and the systems architecture that keeps every claim traceable to its source.' }),
        Object.freeze({ title: 'Model Governance', body: 'Versioned model behavior, explicit uncertainty, predictions frozen before results are known, and model output kept separate from market prices.' }),
      ]),
      principles: Object.freeze([
        Object.freeze({ title: 'Evidence over fluency', body: 'A confident sentence is not a fact. Facts need provenance.' }),
        Object.freeze({ title: 'Never rewrite the record', body: 'Predictions and evidence stay historically inspectable after results are known.' }),
        Object.freeze({ title: 'Models are probabilities', body: 'Output is a statement of uncertainty, not a promise.' }),
        Object.freeze({ title: 'Build the tooling', body: 'Product and research infrastructure are part of the editorial advantage.' }),
      ]),
      network: Object.freeze([
        Object.freeze({ label: 'PropBetEdge', href: '/about' }),
        Object.freeze({ label: 'Predictions', href: 'https://predictions.propbetedge.ai/' }),
        Object.freeze({ label: 'PropSports API', href: 'https://propsports.proptechusa.ai' }),
        Object.freeze({ label: 'PropTechUSA.ai', href: 'https://proptechusa.ai' }),
      ]),
    }),
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
