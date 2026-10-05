/**
 * PropBetEdge Research — the one registry for /research and its pages (DOM-free: the client renderer, the Edge
 * middleware crawler copy, the sitemap and the footer all read this file).
 *
 * Scope rule (owner 2026-10-04): explain the science and engineering PRINCIPLES at a high level. Never publish
 * feature weights, formulas, thresholds, proprietary signals, source-selection logic, internal endpoints, code,
 * private datasets or anything else that materially exposes model IP. Every statement describes a practice the
 * network actually runs today; nothing here is aspirational.
 */

export const RESEARCH_UPDATED = { iso: '2026-10-05', label: 'October 5, 2026' };

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
    description: 'The research system behind PropBetEdge: evidence provenance, canonical state, prospective validation, shadow research, calibration, frozen decisions, model governance and permanent records.',
    lede: 'PropBetEdge is built to make sports intelligence inspectable. Evidence has provenance, state is canonical, predictions are frozen before outcomes, research is separated from official output, and the historical record stays visible after the result is known.',
    heroSignals: Object.freeze([
      'Evidence before inference',
      'Point-in-time by design',
      'Research stays labeled',
      'The record does not move',
    ]),
    summary: Object.freeze([
      Object.freeze({ k: 'EVIDENCE', h: 'Know what was observed', body: 'A useful number starts with a source, a capture time and a clear distinction between observed fact, derived metric, model output and market observation.' }),
      Object.freeze({ k: 'DECISION', h: 'Know when it became a call', body: 'The decision boundary matters. Official output is issued before the event, frozen at the relevant lock, and graded against what happened afterward.' }),
      Object.freeze({ k: 'STATE', h: 'Know how mature the system is', body: 'Research, shadow, validated and official states are not marketing adjectives. They tell readers what the output is allowed to do and what evidence exists behind it.' }),
    ]),
    sections: Object.freeze([
      Object.freeze({
        id: 'contract',
        h: 'The research contract',
        deck: 'A PropBetEdge page should tell you what the system knows, what it inferred, what it published and what remains uncertain.',
        body: Object.freeze([
          'The research program starts with a simple constraint: a conclusion should be traceable to evidence that existed when the conclusion was made. That means preserving time, state and model identity instead of treating a finished result as if it had always been known.',
          'The same discipline applies across predictive models, Player DNA, matchup intelligence, live products, PBEcast and editorial analysis. The surface can change by sport; the obligation to distinguish evidence from inference does not.',
        ]),
        points: Object.freeze([
          Object.freeze(['Observed fact', 'A score, event, lineup, injury status, ranking, market quote or other captured state.']),
          Object.freeze(['Derived PBE metric', 'A transformation or summary built from observed evidence and labeled as a PropBetEdge measure.']),
          Object.freeze(['Model output', 'A probability, projection or decision produced by a versioned model under a known publication state.']),
          Object.freeze(['Editorial analysis', 'Interpretation and judgment that may use the data and models but is not silently converted into official model output.']),
        ]),
        rule: 'The category matters because the standard of proof is different for a captured fact, a derived metric, a model probability and an editorial judgment.',
      }),
      Object.freeze({
        id: 'loop',
        h: 'From observation to publication',
        deck: 'The network is organized as one evidence loop, not a collection of disconnected pages.',
        steps: Object.freeze([
          Object.freeze(['Observe', 'Capture live and historical sports state, market observations and source changes with time attached.']),
          Object.freeze(['Normalize', 'Resolve players, teams, games, events and markets into canonical identities and state.']),
          Object.freeze(['Analyze', 'Apply sport-specific models, DNA systems, matchup logic and contextual intelligence.']),
          Object.freeze(['Evaluate', 'Freeze eligible decisions before outcomes and grade them after the event.']),
          Object.freeze(['Research', 'Run candidate logic in replay and shadow without changing official customer-facing output.']),
          Object.freeze(['Govern', 'Promote, hold or withdraw versions through explicit evidence and acceptance gates.']),
          Object.freeze(['Publish', 'Serve the result through products, records, PBEcast and editorial surfaces with the state made clear.']),
          Object.freeze(['Monitor', 'Watch runtime health and decision health separately so stale or unknown inputs are not mistaken for healthy output.']),
        ]),
      }),
      Object.freeze({
        id: 'evidence',
        h: 'What counts as evidence',
        deck: 'Evidence is useful only if it preserves the conditions under which a decision was possible.',
        body: Object.freeze([
          'PropBetEdge treats provenance and time as part of the data rather than metadata that can be discarded later. A value without context can be directionally interesting, but it is not enough to support a serious claim about what the system knew at a specific moment.',
          'Prospective outcomes carry the most weight because the system had to make the call without knowing the result. Replay, historical analysis and exploratory research are valuable for finding ideas and failure modes, but they do not get promoted into prospective proof after the fact.',
        ]),
        points: Object.freeze([
          Object.freeze(['Source and capture time', 'The evidence should preserve where it came from and when it was observed.']),
          Object.freeze(['Canonical identity', 'The player, team, event or market has to resolve to the same underlying object across products.']),
          Object.freeze(['Decision-time availability', 'Inputs that became known later are excluded from point-in-time evaluation.']),
          Object.freeze(['Outcome and grading', 'The result is attached after the event without changing the original issued decision.']),
        ]),
      }),
      Object.freeze({
        id: 'outputs',
        h: 'How to read PropBetEdge output',
        deck: 'The most important label on an intelligence product is often the one that tells you what the number is allowed to mean.',
        cards: Object.freeze([
          Object.freeze(['PROBABILITY', 'Uncertainty, not certainty', 'A probability is a calibrated expression of uncertainty. It is not a promise, guarantee or claim that the favorite outcome must occur.']),
          Object.freeze(['MARKET', 'Reference, not truth', 'A sportsbook or prediction-market price is a timestamped market observation. It can be a benchmark without becoming an independent model label.']),
          Object.freeze(['RESEARCH', 'Evidence gathering', 'Replay and shadow output can be rigorous and still remain research. It does not become official because it later looks good.']),
          Object.freeze(['MISSING', 'Unknown stays unknown', 'A missing, stale or conflicting field is not silently converted into a plausible value just to keep a page full.']),
        ]),
      }),
      Object.freeze({
        id: 'failure',
        h: 'Failure is part of the record',
        body: Object.freeze([
          'A trustworthy research system has to preserve the cases that make it look worse. Losses, failed gates, stale-input incidents, withdrawn releases and model versions that do not earn promotion are all information about the system.',
          'The purpose of a permanent record is not to manufacture a clean historical story. It is to make the current product harder to fool — including by its own developers — because past decisions can still be inspected after the outcome is known.',
        ]),
        rule: 'If the historical record improves because the past was silently rewritten, the research process has failed even if the current model looks better.',
      }),
      Object.freeze({
        id: 'publication',
        h: 'Research and publication stay separate',
        body: Object.freeze([
          'PropBetEdge can publish deep model context without publishing the proprietary mechanics that create the edge. These pages explain the validation, governance, provenance and system architecture around the models while intentionally withholding weights, formulas, thresholds, private datasets and internal source-selection logic.',
          'That boundary is deliberate. Transparency should let a reader evaluate the integrity of the process without turning a public trust center into a blueprint for reconstructing proprietary systems.',
        ]),
      }),
    ]),
  }),
  Object.freeze({
    slug: 'methodology',
    path: '/research/methodology',
    label: 'Methodology & Validation',
    title: 'Methodology & validation',
    description: 'How PropBetEdge evaluates predictive systems: prospective validation, point-in-time replay, shadow evaluation, leakage controls, calibration, baselines, grading discipline and visible failures.',
    lede: 'A model is only as credible as the way it is tested. PropBetEdge gives the greatest weight to prospective decisions made before outcomes were known, uses point-in-time replay and shadow evaluation to challenge candidate logic, and keeps failures visible.',
    heroSignals: Object.freeze([
      'Prospective first',
      'No borrowing from the future',
      'Baselines matter',
      'Losses stay visible',
    ]),
    summary: Object.freeze([
      Object.freeze({ k: 'DESIGN', h: 'Test the decision, not the story', body: 'The unit of evaluation is the decision the system could actually have made at that moment, using only information that existed then.' }),
      Object.freeze({ k: 'VALIDATION', h: 'Replay supports; prospective proves', body: 'Historical replay is useful for diagnosis and iteration. Prospective frozen decisions are the stronger evidence because the outcome was unavailable.' }),
      Object.freeze({ k: 'INTERPRETATION', h: 'A good score is not enough', body: 'Calibration, simple baselines, market context, stability and visible failure modes all matter before a result can justify production use.' }),
    ]),
    sections: Object.freeze([
      Object.freeze({
        id: 'question',
        h: 'Start with the decision question',
        body: Object.freeze([
          'Methodology begins before model fitting. The system defines the decision it is trying to make, the information boundary at decision time, the outcome that will later grade it, and the publication state the result is allowed to occupy.',
          'This prevents a common failure in predictive work: changing the question after seeing the answer. A model cannot earn credibility by repeatedly redefining success around the outcomes it happened to get right.',
        ]),
        points: Object.freeze([
          Object.freeze(['Decision boundary', 'What information may exist when the prediction is issued.']),
          Object.freeze(['Outcome definition', 'What later event closes and grades the decision.']),
          Object.freeze(['Comparison set', 'Which naive or market reference the candidate must be understood against.']),
          Object.freeze(['Publication state', 'Whether the result is research, shadow, validated or eligible for official use.']),
        ]),
      }),
      Object.freeze({
        id: 'prospective',
        h: 'Prospective validation',
        deck: 'The evidence that counts most is a decision made before the outcome.',
        body: Object.freeze([
          'Eligible official calls are issued before the event, carry their issue time, and lock at the defined event boundary. Once that boundary passes, the original decision cannot be edited into a better one.',
          'Prospective evaluation forces the model to live with the same uncertainty the customer saw. It captures real data gaps, late lineup changes, stale feeds, market movement and operational friction that a clean historical dataset can hide.',
        ]),
        rule: 'Retrospective fit can show that an idea is interesting. It cannot by itself show that the system would have made the same decision in real time.',
      }),
      Object.freeze({
        id: 'replay',
        h: 'Point-in-time replay',
        body: Object.freeze([
          'Replay asks a strict question: given only the evidence that existed at the original decision time, what would this version have produced? Inputs that arrived later are excluded even when they make the historical answer easier.',
          'This makes replay useful for comparing candidate logic, diagnosing regressions and understanding whether a new version changes decisions for defensible reasons. It is supporting evidence, not a substitute for a live prospective record.',
        ]),
        points: Object.freeze([
          Object.freeze(['State is reconstructed', 'The replay uses the evidence available at the decision boundary rather than the final post-event dataset.']),
          Object.freeze(['Future information is excluded', 'Later injuries, final lineups, closing prices and outcomes do not leak backward into the decision.']),
          Object.freeze(['Version identity is preserved', 'A replay belongs to the version that generated it; later versions do not inherit its historical behavior.']),
        ]),
      }),
      Object.freeze({
        id: 'leakage',
        h: 'Leakage controls',
        deck: 'The easiest way to build an impressive historical model is to let the future leak into the past. PropBetEdge treats that as a test failure.',
        body: Object.freeze([
          'Leakage can be obvious, such as using a final result directly, or subtle, such as relying on a field that was only corrected after the event. The methodology therefore treats timestamps, source state and availability windows as part of the validation design.',
          'When the system cannot establish that a required input existed at the decision boundary, that input is not silently granted to the model. The evaluation either excludes it or marks the decision as not valid for that test.',
        ]),
      }),
      Object.freeze({
        id: 'shadow',
        h: 'Shadow evaluation',
        body: Object.freeze([
          'Shadow models run on live inputs beside production while remaining unable to alter official customer-facing output. Their predictions are recorded and graded as evidence, but the product continues to follow the active production version.',
          'Shadowing is valuable because it exposes candidate logic to the same messy environment as production without granting it production authority. A candidate that behaves well in replay but fails under live data conditions has not earned promotion.',
        ]),
        points: Object.freeze([
          Object.freeze(['Same environment', 'The candidate sees live operating conditions rather than a curated offline sample.']),
          Object.freeze(['No production control', 'Its output cannot silently replace the official model during evaluation.']),
          Object.freeze(['Permanent evidence', 'Shadow results can inform a promotion decision without being relabeled later as if they had been official calls.']),
        ]),
      }),
      Object.freeze({
        id: 'calibration',
        h: 'Calibration and baselines',
        body: Object.freeze([
          'A probability model should be judged as a probability model. PropBetEdge checks whether predicted probabilities correspond sensibly to observed outcomes and scores them with proper scoring rules rather than reducing everything to win rate.',
          'Calibration is interpreted in plain language: events given a 60% chance should happen about 60% of the time over an adequate sample. The same output is also compared with simple baselines and a market reference where one exists.',
          'A complicated model does not receive credit for complexity. If a simple baseline explains the same decisions, or the candidate cannot establish useful separation from the reference it is compared against, the story around the model does not rescue it.',
        ]),
      }),
      Object.freeze({
        id: 'stability',
        h: 'Sample adequacy and stability',
        body: Object.freeze([
          'Evaluation looks for evidence that survives more than one convenient slice of history. The relevant sample has to include enough graded decisions and enough variation in teams, opponents, event conditions and time periods to make a promotion decision meaningful.',
          'PropBetEdge does not publish a universal public gate value because adequacy depends on the decision type and sport. The governing principle is consistent: a small cluster of favorable outcomes is not treated as proof of a durable edge.',
        ]),
        points: Object.freeze([
          Object.freeze(['Breadth', 'Evidence should not depend on one opponent, venue, athlete or unusual run of conditions.']),
          Object.freeze(['Time', 'Behavior is examined across distinct periods rather than one narrow streak.']),
          Object.freeze(['Operational parity', 'The candidate has to work under the same input and publication constraints as the system it may replace.']),
        ]),
      }),
      Object.freeze({
        id: 'grading',
        h: 'Grading discipline',
        body: Object.freeze([
          'Once an eligible decision is frozen, grading happens against the outcome without rewriting the original call. Wins and losses are both kept. If a pre-event decision is formally replaced, the original remains visible as replaced and is not quietly converted into the later choice.',
          'A grading correction is an amendment to the record, not permission to erase the earlier state. The purpose is to preserve what was issued while also making the corrected interpretation clear.',
        ]),
      }),
      Object.freeze({
        id: 'failure',
        h: 'Failure is evidence',
        body: Object.freeze([
          'A candidate can fail because its predictive behavior is weak, because calibration deteriorates, because it depends on fragile data, because production parity is poor, or because the operational system cannot reproduce the offline result reliably.',
          'Those outcomes are useful. A methodology that only preserves successful experiments will eventually promote the wrong lesson. Failed gates and negative results narrow the space of ideas that deserve further investment.',
        ]),
        rule: 'The purpose of validation is not to prove the model right. It is to make it difficult for a weak model to look right by accident.',
      }),
      Object.freeze({
        id: 'handoff',
        h: 'From validation to governance',
        body: Object.freeze([
          'Methodology decides whether the evidence is persuasive; governance decides what the system is allowed to do with that evidence. A candidate that clears evaluation still requires an explicit release decision, version identity and acceptance review before it can become official.',
          'That separation keeps research velocity high without allowing experiments to drift into production through familiarity or repeated exposure.',
        ]),
      }),
    ]),
  }),
  Object.freeze({
    slug: 'model-governance',
    path: '/research/model-governance',
    label: 'Model Governance',
    title: 'Model governance',
    description: 'How PropBetEdge governs predictive systems: version identity, model states, promotion gates, release acceptance, rollback, immutable issuance records and separation of official, research and editorial output.',
    lede: 'Governance is what stops a promising experiment from quietly becoming a product claim. Every production model has an identity, a publication state, an evidence trail and an explicit path into — and back out of — official use.',
    heroSignals: Object.freeze([
      'Versioned',
      'State-labeled',
      'Gate-controlled',
      'Reversible',
    ]),
    summary: Object.freeze([
      Object.freeze({ k: 'IDENTITY', h: 'A version owns its record', body: 'A new model version does not rewrite or inherit the historical decisions of the version it replaces.' }),
      Object.freeze({ k: 'AUTHORITY', h: 'State defines what output may do', body: 'Monitoring, shadow, research, validated and official labels describe publication authority and evidence maturity, not excitement.' }),
      Object.freeze({ k: 'CONTROL', h: 'Promotion is a release event', body: 'Evidence can recommend a promotion, but only an explicit acceptance decision changes what the customer-facing system is allowed to publish.' }),
    ]),
    sections: Object.freeze([
      Object.freeze({
        id: 'purpose',
        h: 'Why model governance exists',
        body: Object.freeze([
          'Predictive systems change constantly: data improves, bugs are fixed, new signals are tested and market conditions move. Governance provides a stable boundary between that research activity and the claims the production product is allowed to make.',
          'The goal is not to slow research. It is to keep model authority explicit. A candidate can be technically interesting, statistically promising and operationally healthy while still remaining research until the release requirements are satisfied.',
        ]),
      }),
      Object.freeze({
        id: 'versioning',
        h: 'Version identity',
        body: Object.freeze([
          'Every governed output is attributable to the model version that produced it. When logic changes materially, the new version starts its own evidence trail rather than inheriting the old version’s performance as if nothing changed.',
          'Version identity also makes regressions diagnosable. If a new release changes a decision, the system can distinguish a deliberate model change from a data problem, publication bug or stale state.',
        ]),
        points: Object.freeze([
          Object.freeze(['Model version', 'Identifies the decision logic that generated the output.']),
          Object.freeze(['Release state', 'Identifies whether that version is monitoring, shadow, research, validated or official.']),
          Object.freeze(['Issue record', 'Connects an official decision to the version and time that produced it.']),
          Object.freeze(['Outcome record', 'Grades what was issued without changing the original decision.']),
        ]),
      }),
      Object.freeze({
        id: 'states',
        h: 'Model states',
        deck: 'State is a control surface, not a confidence adjective.',
        cards: Object.freeze([
          Object.freeze(['MONITORING', 'Observe the system', 'The system is being watched or instrumented. Output in this state is not an official customer-facing decision.']),
          Object.freeze(['SHADOW', 'Run beside production', 'The candidate receives live inputs and is graded, but it cannot alter the active official output.']),
          Object.freeze(['RESEARCH', 'Develop and challenge', 'The model or signal is under active evaluation and may appear in clearly labeled research surfaces only.']),
          Object.freeze(['VALIDATED', 'Evidence cleared', 'The candidate has met the relevant validation standard but has not automatically become the active official release.']),
          Object.freeze(['OFFICIAL', 'Production authority', 'The version is explicitly approved to issue the customer-facing decisions governed by that product.']),
        ]),
        body: Object.freeze([
          'PropBetEdge Predictions uses this vocabulary as its canonical state legend. Individual sport products may use sport-specific labels around their own releases, and not every sport has an official model.',
        ]),
      }),
      Object.freeze({
        id: 'promotion',
        h: 'Promotion gates',
        body: Object.freeze([
          'Promotion requires more than a favorable backtest. The evidence has to be prospective enough to support the claim, broad enough to be meaningful, operationally reproducible and comparable with the production system the candidate would replace.',
          'Acceptance also checks the surrounding system: data contracts, publication behavior, grading, record continuity and user-facing labels. A model that scores well but cannot be served reliably is not production-ready.',
        ]),
        points: Object.freeze([
          Object.freeze(['Evidence', 'Prospective and shadow behavior support the claimed use.']),
          Object.freeze(['Parity', 'The candidate works under the same real operating constraints as production.']),
          Object.freeze(['Acceptance', 'The release is reviewed as a system change, not only as a modeling result.']),
          Object.freeze(['Record continuity', 'The transition preserves the old version and begins a distinct record for the new one.']),
        ]),
      }),
      Object.freeze({
        id: 'release',
        h: 'Release acceptance',
        body: Object.freeze([
          'A promotion becomes real only when it is released deliberately. The active version, activation time and publication authority are explicit so there is a clear boundary between the research period and the official period.',
          'The release process is intentionally asymmetric: evidence can accumulate gradually, but official authority changes at a defined moment. That prevents a candidate from becoming “basically official” through repeated use before acceptance.',
        ]),
        rule: 'A validated model is not automatically an official model. Validation is evidence; official status is a governed release decision.',
      }),
      Object.freeze({
        id: 'rollback',
        h: 'Withdrawal and rollback',
        body: Object.freeze([
          'Official status is not permanent. A release can be turned off or replaced when post-release evidence, data integrity or operational behavior fails the standard it was expected to maintain.',
          'Withdrawal changes the current system, not the past. Decisions already issued by that version remain attached to it, including losses and replaced calls, so the historical record still reflects what customers actually saw.',
        ]),
      }),
      Object.freeze({
        id: 'records',
        h: 'Immutable issuance records',
        body: Object.freeze([
          'Official decisions are written with issuance receipts so a published call can be checked against what the system actually issued. Content hashes are chained in order to provide internal tamper evidence across the record.',
          'This is not presented as third-party notarization. It is an internal control that makes silent mutation harder and gives the product a concrete way to compare current display state with the original issued content.',
          'When a pre-event decision is replaced, both decisions remain on record. The replaced decision is shown as replaced, is not graded as the active call and is never deleted simply because the later decision performed better.',
        ]),
      }),
      Object.freeze({
        id: 'separation',
        h: 'Official, research and editorial stay separate',
        body: Object.freeze([
          'An official model decision, a shadow output and an editorial opinion can all discuss the same game without becoming the same thing. PropBetEdge labels those classes separately because they have different evidence standards and different authority.',
          'Market observations are also kept in their own lane. A market price can benchmark a model or provide context, but it is not silently presented as independent model output and does not become a prediction merely because it is useful.',
        ]),
        points: Object.freeze([
          Object.freeze(['Official', 'Governed production output with a defined issuance and grading record.']),
          Object.freeze(['Research or shadow', 'Evidence-generating output without production authority.']),
          Object.freeze(['Editorial', 'Human-accountable analysis that may use data and models without becoming an official model call.']),
          Object.freeze(['Market', 'Timestamped external reference state, preserved as an observation rather than model truth.']),
        ]),
      }),
      Object.freeze({
        id: 'change-control',
        h: 'Change control',
        body: Object.freeze([
          'Bug fixes, data repairs and model changes are treated differently because they change different parts of the evidence chain. A data correction may amend the input record; a model revision creates a new model identity; a display fix should not alter the underlying issued decision.',
          'Keeping those categories separate is what allows a customer-facing correction to be made without laundering a historical model change into a harmless presentation update.',
        ]),
      }),
      Object.freeze({
        id: 'meaning',
        h: 'What OFFICIAL means — and what it does not',
        body: Object.freeze([
          'OFFICIAL means a version has passed the product’s governing release process and is authorized to issue that product’s official decisions. It does not mean the model cannot lose, cannot be withdrawn or has discovered certainty.',
          'The strongest governance claim is therefore procedural: the system tells you which version had authority, when that authority began, what it issued and how those decisions were later graded.',
        ]),
      }),
    ]),
  }),
  Object.freeze({
    slug: 'data-provenance',
    path: '/research/data-provenance',
    label: 'Data Provenance',
    title: 'Data provenance',
    description: 'How PropBetEdge treats sports and market data: source and capture time, canonical state, identity resolution, freshness, missing-data discipline, timestamped market observations, corrections and rights controls.',
    lede: 'Data becomes evidence only when the system can say what it represents, where it came from and when it was observed. PropBetEdge preserves those boundaries, resolves the network to canonical state and lets missing or conflicting data remain visible.',
    heroSignals: Object.freeze([
      'Source + time',
      'Canonical identity',
      'Missing stays missing',
      'Corrections stay traceable',
    ]),
    summary: Object.freeze([
      Object.freeze({ k: 'LINEAGE', h: 'Provenance travels with the value', body: 'Provider identity, observed time and state are part of the evidence used to interpret a value rather than disposable ingest metadata.' }),
      Object.freeze({ k: 'CANONICAL', h: 'One object across the network', body: 'Players, teams, games, events and markets resolve to canonical identities so products do not create competing versions of the same world.' }),
      Object.freeze({ k: 'QUALITY', h: 'Unknown is a valid state', body: 'Missing, stale and conflicting inputs are treated as data-quality states in their own right instead of being hidden behind a plausible substitute.' }),
    ]),
    sections: Object.freeze([
      Object.freeze({
        id: 'provenance',
        h: 'Provenance is part of the evidence',
        body: Object.freeze([
          'A value is not fully described by the value alone. The system also needs to know the source class, the time it was captured, the entity it belongs to and whether the observation is current, stale, corrected or in conflict.',
          'That context is preserved because the same number can mean different things at different moments. A lineup observed before a game, a later correction and a final post-event state cannot be treated as interchangeable if the model decision happened between them.',
        ]),
      }),
      Object.freeze({
        id: 'canonical',
        h: 'Canonical state',
        body: Object.freeze([
          'The network resolves games, players, teams, competitions, events and markets to canonical identities. Product pages, research systems and models read from that shared identity layer instead of independently guessing which real-world object an upstream record refers to.',
          'Canonical state reduces a subtle but dangerous class of error: two pages can both be internally consistent while referring to different versions of the same player, game or market. Identity resolution makes disagreement visible before it becomes model input.',
        ]),
        points: Object.freeze([
          Object.freeze(['Identity', 'Records referring to the same real-world object are reconciled to one canonical entity.']),
          Object.freeze(['State', 'Current status is represented once rather than recomputed independently on every surface.']),
          Object.freeze(['History', 'Corrections and changes can update the current view without pretending earlier observations never existed.']),
        ]),
      }),
      Object.freeze({
        id: 'hierarchy',
        h: 'Source hierarchy',
        deck: 'Not every source has the same authority, and the system does not pretend otherwise.',
        body: Object.freeze([
          'Official and primary evidence is preferred where it is available and appropriate. Other observations can still be useful, but their role is contextual and their identity remains attached to the captured state.',
          'The public research pages do not disclose internal source-selection logic. The principle that matters to users is that source authority is deliberate, provenance is retained and conflicting evidence is not silently collapsed into whichever value is most convenient.',
        ]),
      }),
      Object.freeze({
        id: 'time',
        h: 'Time semantics',
        body: Object.freeze([
          'PropBetEdge distinguishes when an event happened, when a source reported it, when the platform captured it and when a decision was issued. Those times are related but not interchangeable.',
          'This matters most in validation. A value that was eventually correct cannot be granted to a historical model if it was not available when the model had to decide. Capture time therefore becomes part of the evidence boundary for replay and grading.',
        ]),
        points: Object.freeze([
          Object.freeze(['Event time', 'When the real-world sports event occurred.']),
          Object.freeze(['Observed time', 'When the source exposed the state to the platform.']),
          Object.freeze(['Capture time', 'When PropBetEdge recorded the observation.']),
          Object.freeze(['Decision time', 'When the model or product issued the output that will later be evaluated.']),
        ]),
      }),
      Object.freeze({
        id: 'identity',
        h: 'Normalization and identity resolution',
        body: Object.freeze([
          'Sports data arrives with naming differences, league-specific identifiers, rescheduled events, roster changes and market conventions. Normalization turns those differences into a stable internal representation without erasing the original provenance.',
          'The purpose is not to make every sport look the same. It is to give shared concepts — identity, time, state and evidence quality — a common contract while preserving sport-specific details where they matter.',
        ]),
      }),
      Object.freeze({
        id: 'missing',
        h: 'Missing, stale and conflicting data',
        body: Object.freeze([
          'Missing data is not automatically bad data. Sometimes the correct state is genuinely unknown. PropBetEdge preserves that distinction instead of filling a gap with an estimate and presenting it as an observation.',
          'Stale and conflicting data are also surfaced as quality conditions. If required evidence is not trustworthy enough for a decision, the affected system is expected to degrade or fail closed rather than manufacture confidence from incomplete state.',
        ]),
        cards: Object.freeze([
          Object.freeze(['MISSING', 'No observation', 'The required value is unavailable. The system should not pretend it observed one.']),
          Object.freeze(['STALE', 'Observation too old for the use', 'The value may have been true, but its age prevents it from being treated as current evidence.']),
          Object.freeze(['CONFLICT', 'Sources disagree', 'The disagreement is a condition to resolve or expose, not permission to pick the more convenient value silently.']),
          Object.freeze(['CURRENT', 'Evidence within its use window', 'The observation is fresh enough and sufficiently resolved for the downstream use that depends on it.']),
        ]),
      }),
      Object.freeze({
        id: 'markets',
        h: 'Market observations',
        body: Object.freeze([
          'Sportsbook and prediction-market prices are stored as timestamped venue-specific observations. PropBetEdge does not treat later prices as if they existed earlier, and it does not average distinct venues into a fictional single market quote.',
          'A price captured at a decision lock can be compared with a later closing observation when both exist. When one side of that comparison is missing, the platform leaves the derived comparison unavailable rather than manufacturing it from a different timestamp.',
        ]),
      }),
      Object.freeze({
        id: 'corrections',
        h: 'Corrections and amendments',
        body: Object.freeze([
          'Corrections should improve the current truth without destroying the historical truth. When a data or grading error is repaired, the corrected state is made clear while the record retains enough lineage to show that an amendment occurred.',
          'That is different from silently replacing the past. A trustworthy data system should be able to admit that an earlier record was wrong without pretending it never existed.',
        ]),
      }),
      Object.freeze({
        id: 'rights',
        h: 'Rights and use discipline',
        body: Object.freeze([
          'Data collection and publication operate inside explicit source and rights controls. Provenance surfaces, internal source registries and customer-facing attribution serve different purposes, and the platform keeps those concerns separated.',
          'The public standard is straightforward: a data point should not gain credibility merely because it is technically retrievable. The system also has to be allowed to collect, process and publish it in the way the product uses it.',
        ]),
      }),
      Object.freeze({
        id: 'boundary',
        h: 'The data-to-model boundary',
        body: Object.freeze([
          'A model cannot repair a broken evidence chain by being statistically sophisticated. Before a feature can influence a governed decision, the underlying state has to meet the provenance, freshness and identity requirements of that use.',
          'This is why data quality is part of model governance rather than a separate engineering concern. When the evidence layer is degraded, the model’s apparent precision should not be allowed to hide that fact.',
        ]),
        rule: 'The model is downstream of the evidence. If the evidence cannot support the claim, the model is not allowed to make the claim more certain.',
      }),
    ]),
  }),
  Object.freeze({
    slug: 'intelligence-systems',
    path: '/research/intelligence-systems',
    label: 'Intelligence Systems',
    title: 'Intelligence systems',
    description: 'How the PropBetEdge intelligence network connects observation, canonical state, sport-native analysis, evaluation, research, governance, publishing and runtime monitoring.',
    lede: 'PropBetEdge is built as a connected intelligence system rather than a set of pages. The same loop observes the sport, normalizes state, produces sport-native analysis, evaluates itself, governs releases and publishes with evidence attached.',
    heroSignals: Object.freeze([
      'One evidence loop',
      'Sport-native analysis',
      'Separate research lane',
      'Runtime + decision health',
    ]),
    summary: Object.freeze([
      Object.freeze({ k: 'SYSTEM', h: 'Products share a truth layer', body: 'Live pages, PBEcast, research, newsroom surfaces and model records are connected to the same canonical state instead of maintaining isolated versions of reality.' }),
      Object.freeze({ k: 'SPORT', h: 'Shared rules, different evidence', body: 'A pitch, shift, possession, point and lap are not interchangeable. The architecture shares provenance and governance while keeping sport-native reasoning.' }),
      Object.freeze({ k: 'HEALTH', h: 'A page can load and still be degraded', body: 'Runtime availability and decision quality are monitored separately so stale inputs are not mislabeled as a healthy intelligence state.' }),
    ]),
    sections: Object.freeze([
      Object.freeze({
        id: 'system',
        h: 'A connected intelligence system',
        body: Object.freeze([
          'The network is designed so the same underlying sports state can support multiple products without every page rebuilding its own worldview. Entity identity, time, provenance and publication state are shared contracts; the analysis layered on top remains sport-specific.',
          'That architecture matters because research and customer experience are coupled. If the live product sees a different game state than the evaluator or newsroom, the system can look polished while becoming impossible to audit.',
        ]),
      }),
      Object.freeze({
        id: 'loop',
        h: 'The operating loop',
        steps: Object.freeze([
          Object.freeze(['Observe', 'Capture live scores, events, player and team state, lineups, injuries, weather, rankings, markets and source changes.']),
          Object.freeze(['Normalize', 'Resolve the observation into canonical games, players, teams, events and market state.']),
          Object.freeze(['Analyze', 'Apply sport-specific models, Player DNA, matchup intelligence, live context and market comparison.']),
          Object.freeze(['Evaluate', 'Freeze governed decisions before outcomes and grade them after the event.']),
          Object.freeze(['Research', 'Run candidate logic in replay and shadow without changing official output.']),
          Object.freeze(['Govern', 'Promote or withdraw versions only through explicit evidence and acceptance gates.']),
          Object.freeze(['Publish', 'Serve the result through sport products, PBEcast, records, entity pages and newsroom coverage.']),
          Object.freeze(['Monitor', 'Watch data freshness, runtime behavior and decision health so degraded states are visible.']),
        ]),
      }),
      Object.freeze({
        id: 'observe',
        h: 'Observe: evidence enters the system',
        body: Object.freeze([
          'Observation is the edge of the platform where the real world becomes system state. The goal is not to collect the most data possible; it is to capture the evidence needed for a product while preserving its source, time and quality.',
          'Different sports expose different primitives. The system therefore accepts that a useful observation in one sport may have no direct analogue in another, while still requiring the same provenance discipline.',
        ]),
      }),
      Object.freeze({
        id: 'normalize',
        h: 'Normalize: build canonical state',
        body: Object.freeze([
          'Normalization resolves provider-specific records into stable identities and state contracts. This is what lets the newsroom, model layer, entity hubs and live product agree that they are talking about the same player, team, event or market.',
          'Canonical state is intentionally narrower than “all available data.” It is the trusted representation that downstream systems can depend on without repeating identity and freshness decisions independently.',
        ]),
      }),
      Object.freeze({
        id: 'analyze',
        h: 'Analyze: keep the intelligence sport-native',
        body: Object.freeze([
          'Shared infrastructure does not imply a universal sports model. Baseball, football, basketball, hockey, tennis, soccer, golf, combat sports and motorsports create different evidence and different decision problems.',
          'PropBetEdge therefore shares the governance rails while allowing each sport to build the analytical objects that actually make sense for it: player profiles, matchup context, event state, DNA systems, simulations and sport-specific model outputs.',
        ]),
        rule: 'The network standardizes evidence discipline, not the sport itself.',
      }),
      Object.freeze({
        id: 'evaluate',
        h: 'Evaluate: attach outcomes to decisions',
        body: Object.freeze([
          'Governed decisions are frozen before the outcome and later graded against what happened. Evaluation is connected to the same identity and time layer used by the product so the system is not scoring one event while the customer saw another.',
          'The evaluator also preserves non-winning outcomes and replacements. That makes the record a diagnostic system, not only a marketing surface.',
        ]),
      }),
      Object.freeze({
        id: 'research-lane',
        h: 'Research lane: experiment without production drift',
        body: Object.freeze([
          'Candidate models and signals can run in replay and shadow while the production product remains on its active governed version. This creates room to iterate aggressively without confusing research output with official authority.',
          'Because research shares live canonical state and evaluation infrastructure, a candidate can be challenged under realistic conditions before it earns any right to affect customer-facing decisions.',
        ]),
      }),
      Object.freeze({
        id: 'govern',
        h: 'Govern: control authority',
        body: Object.freeze([
          'Governance sits between evidence and production authority. It records which version is active, which state a candidate occupies and whether the evidence and operational acceptance are sufficient for promotion.',
          'The same layer supports withdrawal. A model that was good enough to ship can still be turned off later without deleting the decisions it already issued.',
        ]),
      }),
      Object.freeze({
        id: 'publish',
        h: 'Publish: connect intelligence to the product',
        body: Object.freeze([
          'Publishing is not the end of the data pipeline; it is the point where state, analysis and labels become a customer experience. The page has to preserve the meaning of the underlying output rather than flattening research, official decisions and editorial context into one undifferentiated score.',
          'That applies across live products, PBEcast, historical records, entity pages and newsroom coverage. The presentation can be rich, but the evidence category and model state should survive the trip to the interface.',
        ]),
      }),
      Object.freeze({
        id: 'monitoring',
        h: 'Monitoring: runtime health and decision health',
        body: Object.freeze([
          'A system can return a successful web response while its intelligence is degraded. PropBetEdge therefore separates runtime health from decision health: the page can be technically available while the data feeding it is stale, incomplete or uncertain.',
          'Unknown and stale states are reported as unknown or stale rather than defaulting to healthy. That prevents observability from becoming cosmetic — a green page load is not enough when the evidence underneath it is no longer trustworthy.',
        ]),
        cards: Object.freeze([
          Object.freeze(['RUNTIME', 'Can the system serve?', 'Availability, request behavior and execution health answer whether the product is functioning technically.']),
          Object.freeze(['DATA', 'Is the evidence current?', 'Freshness, completeness and conflicts answer whether the underlying state is trustworthy for the intended use.']),
          Object.freeze(['DECISION', 'Is the output valid?', 'Model state, required inputs and decision-boundary checks answer whether the system is allowed to issue the result.']),
          Object.freeze(['RECORD', 'Can the result be audited?', 'Issuance and outcome records answer whether the historical decision can still be reconstructed and graded.']),
        ]),
      }),
      Object.freeze({
        id: 'failure',
        h: 'Failure containment',
        body: Object.freeze([
          'The system is designed to fail honestly. If a required dependency is stale, missing or contradictory, the preferred behavior is to degrade the affected output, withhold the claim or mark the state unknown rather than allowing a fallback to masquerade as full-confidence intelligence.',
          'This is especially important in a network with many sports and products. Local failures should remain local, and a weakness in one feed or research lane should not silently contaminate unrelated official output.',
        ]),
      }),
      Object.freeze({
        id: 'shared',
        h: 'Shared rules across different sports',
        body: Object.freeze([
          'Sport-native products share a small set of system promises: preserve provenance, keep canonical identity, honor decision time, separate research from official output, version governed models, grade what was actually issued and expose degraded states honestly.',
          'Those shared rules are what make PropBetEdge a network rather than a group of unrelated sites. The sports can look and behave differently while still being evaluated against the same integrity standard.',
        ]),
      }),
    ]),
  }),
]);

export const researchPage = (path) => RESEARCH_PAGES.find((p) => p.path === path) || null;
export const researchSubpages = () => RESEARCH_PAGES.filter((p) => p.slug);
