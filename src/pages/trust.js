import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { renderHomeCloser } from '../components/home-closer.js';
import '../styles/home-closer.css';

const SITE = 'https://propbetedge.ai';

const pages = {
  terms: {
    title: 'Terms of Service — PropBetEdge',
    description: 'Terms governing use of the PropBetEdge sports intelligence network, including automated-access, data-use and AI-training restrictions.',
    eyebrow: 'TRUST & LEGAL',
    heading: 'Terms of Service',
    intro: 'These Terms govern PropBetEdge and its sport, news, learning, intelligence, membership and related properties. By accessing or using the network, you agree to these Terms.',
    body: `
      <div class="trust-notice"><strong>Operator:</strong> PropBetEdge is operated by Local Home Buyers LLC d/b/a PropTechUSA.ai, Saint Paul, Minnesota. PropBetEdge provides sports information, analysis, models, predictions and entertainment. It is not a sportsbook, casino, bookmaker, broker, investment adviser or financial institution, and no output guarantees a winning outcome or profit.</div>

      <h2>1. Acceptance, scope and eligibility</h2>
      <p>By visiting, accessing, purchasing, subscribing to or using any PropBetEdge website, application, membership feature, model output, live experience, article, tool or other service (collectively, the “Services”), you agree to these Terms and any product-specific terms presented to you. If you do not agree, do not use the Services. You must be legally capable of entering into this agreement. If you use wagering-related information, you are solely responsible for complying with the laws, age requirements and location rules that apply to you.</p>

      <h2>2. Limited permission to use the Services</h2>
      <p>Subject to these Terms, we grant you a limited, revocable, non-exclusive, non-transferable permission to access public consumer-facing portions of the Services for your personal use and to use paid features within the scope of your active membership. No ownership right is transferred to you. Any rights not expressly granted are reserved.</p>

      <h2>3. No scraping, crawling or unauthorized automated access</h2>
      <div class="trust-notice"><strong>Automated extraction is not permitted.</strong> Except for bona fide general-purpose search engines and search-discovery crawlers acting solely to index publicly available pages in accordance with our robots.txt rules, and clients using an expressly authorized PropBetEdge or PropSports API, you may not use any robot, crawler, spider, scraper, headless browser, browser-automation tool, agent, script, data-mining process or other automated means to access, monitor, copy, download, extract, harvest, index, cache, archive, mirror or collect any portion of the Services.</div>
      <p>You may not disguise automated traffic as human traffic; rotate IP addresses, accounts, devices or user agents to evade controls; bypass paywalls, authentication, rate limits, CAPTCHAs, bot controls or technical restrictions; enumerate hidden endpoints; or continue automated access after receiving notice that the access is not authorized. Published robots.txt directives, rate limits, access controls, response headers, metadata and other machine-readable restrictions communicate conditions and restrictions on automated access. The absence of a technical block does not create permission.</p>

      <h2>4. Search indexing is allowed; AI training and dataset extraction are not</h2>
      <p>We want PropBetEdge to remain discoverable in legitimate search products. Search-engine indexing and search-result snippets are permitted when performed by recognized search crawlers that honor our robots.txt rules. Unless we give prior written permission, however, you may not use PropBetEdge content, pages, model outputs, proprietary analytics, compilations or other protected material to train or fine-tune a generative-AI or machine-learning model; build embeddings, corpora, benchmark sets, retrieval datasets, synthetic-training sets or searchable mirrors; systematically ground a competing commercial product; create a substitute or competing dataset, publication, product, model or service; or resell, sublicense, republish or commercially exploit bulk-extracted material.</p>

      <h2>5. Intellectual property and data rights</h2>
      <p>PropBetEdge and its licensors retain rights in the Services, including original editorial expression, software, interfaces, product design, model logic, derived metrics, proprietary analytics, databases and compilations, selection and arrangement, graphics, trademarks, logos and branding. We do not claim exclusive ownership of raw facts merely because they appear on a PropBetEdge page. Third-party names, marks, data, images, statistics and links remain subject to the rights of their respective owners. No license to third-party material is granted by these Terms.</p>

      <h2>6. Accounts, memberships and billing</h2>
      <p>You are responsible for activity under your account and for protecting magic links, credentials and devices. Access is personal unless a written plan expressly says otherwise. You may not share, sell, transfer or sublicense paid access. Fees, renewals, cancellations, refunds, promotions, taxes and entitlements are governed by the checkout terms shown to you, these Terms and applicable law. We may correct pricing or entitlement errors and may suspend access for nonpayment or abuse.</p>

      <h2>7. Sports intelligence, models and predictions</h2>
      <p>Scores, statistics, market information, projections, picks, Player DNA, probabilities, live intelligence, editorial material and other outputs may be delayed, incomplete, revised, unavailable or wrong. Models are probabilistic, not promises. Past performance does not guarantee future results. You are responsible for your own decisions and for independently verifying information that matters to you.</p>

      <h2>8. Acceptable use and security</h2>
      <p>You may not interfere with the Services; probe or test security without written authorization; gain unauthorized access; misuse accounts; introduce malicious code; impersonate another person; manipulate grading or records; engage in fraud, match-fixing or unlawful gambling; or use the Services in a manner that is illegal, deceptive, abusive, harmful or operationally disruptive.</p>

      <h2>9. Third-party services, marks and independence</h2>
      <p>The Services may reference teams, leagues, athletes, tours, sanctioning bodies, sportsbooks, prediction markets, payment processors, publishers, social platforms and data sources. Unless we expressly state otherwise, PropBetEdge is independent and is not affiliated with, sponsored by or endorsed by those third parties. Third-party marks are used only to identify the subjects discussed. We do not control third-party services and are not responsible for their availability, security, accuracy or terms.</p>

      <h2>10. Service changes, enforcement and termination</h2>
      <p>We may add, modify, suspend, limit or discontinue features, sports, models, memberships, pages, APIs or other Services. We may block traffic, revoke sessions, restrict accounts, preserve abuse evidence, suspend or terminate access, and take other reasonable measures when we believe these Terms have been violated or when necessary to protect users, rights, data, infrastructure, service availability or legal compliance. Termination does not waive rights or remedies arising from earlier conduct.</p>

      <h2>11. Warranty disclaimer</h2>
      <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE SERVICES ARE PROVIDED “AS IS” AND “AS AVAILABLE.” WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, ACCURACY, AVAILABILITY, PROFITABILITY AND UNINTERRUPTED OR ERROR-FREE OPERATION, EXCEPT TO THE EXTENT A WARRANTY CANNOT LAWFULLY BE DISCLAIMED.</p>

      <h2>12. Limitation of liability</h2>
      <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, LOCAL HOME BUYERS LLC, PROPTECHUSA.AI, PROPBETEDGE AND THEIR AFFILIATES, OFFICERS, EMPLOYEES, CONTRACTORS AND SERVICE PROVIDERS WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY OR PUNITIVE DAMAGES; LOST PROFITS OR REVENUE; LOSS OF DATA OR GOODWILL; BUSINESS INTERRUPTION; WAGERING LOSSES; MISSED OPPORTUNITIES; OR LOSSES ARISING FROM RELIANCE ON DATA, MODELS, PREDICTIONS, THIRD-PARTY SERVICES OR SERVICE INTERRUPTIONS. TO THE MAXIMUM EXTENT PERMITTED BY LAW, AGGREGATE LIABILITY ARISING OUT OF OR RELATING TO THE SERVICES WILL NOT EXCEED THE GREATER OF $100 OR THE AMOUNT YOU PAID FOR THE AFFECTED PROPBETEDGE SERVICE DURING THE TWELVE MONTHS BEFORE THE EVENT GIVING RISE TO THE CLAIM. NOTHING HERE LIMITS LIABILITY THAT CANNOT LEGALLY BE LIMITED.</p>

      <h2>13. Indemnification</h2>
      <p>To the extent permitted by law, you agree to defend, indemnify and hold harmless Local Home Buyers LLC d/b/a PropTechUSA.ai, PropBetEdge and their affiliates, officers, employees, contractors and service providers from third-party claims, losses, liabilities, damages and reasonable costs arising from your unlawful or unauthorized use of the Services, your violation of these Terms, your infringement of another party’s rights, or your scraping, extraction, redistribution or commercialization of material in violation of these Terms.</p>

      <h2>14. Governing law and venue</h2>
      <p>These Terms are governed by the laws of the State of Minnesota, without regard to conflict-of-law principles. To the extent a dispute is not subject to a separate written agreement, the parties consent to exclusive jurisdiction and venue in the state courts located in Ramsey County, Minnesota, and the federal courts with jurisdiction over that county. Before filing a claim, each party will provide written notice and allow thirty days for good-faith resolution, except where urgent injunctive or equitable relief is reasonably necessary.</p>

      <h2>15. Changes to these Terms</h2>
      <p>We may update these Terms as the Services change. The “Last updated” date identifies the current version. For material changes, we may provide additional notice where appropriate. Continued use after an updated version becomes effective constitutes acceptance to the extent permitted by law. Changes are not intended to retroactively alter rights or obligations for earlier conduct unless applicable law permits it.</p>

      <h2>16. Miscellaneous</h2>
      <p>If any provision is held unenforceable, the remaining provisions remain in effect. A failure to enforce a provision is not a waiver. You may not assign these Terms without our written consent; we may assign them in connection with a merger, acquisition, reorganization or transfer of the Services. These Terms and any applicable checkout or written product terms form the agreement governing your use of the Services and supersede prior understandings about the same subject matter.</p>

      <h2>17. Contact</h2>
      <p>Questions about these Terms, authorized automated access, licensing or rights requests can be sent to <a href="mailto:support@proptechusa.ai">support@proptechusa.ai</a>. Editorial corrections can be sent to <a href="mailto:editorial@proptechusa.ai">editorial@proptechusa.ai</a>. See the <a href="/legal">Legal</a> page for rights, crawler and trademark notices.</p>
    `,
  },
  legal: {
    title: 'Legal — PropBetEdge',
    description: 'Ownership, intellectual-property, crawler, AI-training, trademark, copyright, privacy and responsible-use notices for PropBetEdge.',
    eyebrow: 'LEGAL & RIGHTS',
    heading: 'Legal',
    intro: 'Ownership, rights, crawler policy, third-party notices and legal contact information for the PropBetEdge sports intelligence network.',
    body: `
      <div class="trust-notice"><strong>Network operator:</strong> PropBetEdge is operated by Local Home Buyers LLC d/b/a PropTechUSA.ai, Saint Paul, Minnesota. These notices supplement the <a href="/terms">Terms of Service</a>.</div>

      <h2>Ownership and protected material</h2>
      <p>PropBetEdge’s original editorial work, software, interfaces, product design, model logic, derived metrics, Player DNA, proprietary analytics, databases and compilations, selection and arrangement, graphics, trademarks, logos and branding are protected by applicable intellectual-property and other laws. All rights not expressly granted are reserved.</p>

      <h2>Automated access and crawler policy</h2>
      <p>PropBetEdge permits legitimate search-engine and search-discovery crawlers to index public pages when they comply with our published <a href="/robots.txt">robots.txt</a> rules. That permission is limited to search discovery and ordinary search-result presentation. It is not permission to scrape, mirror, bulk-download, republish, resell, reconstruct a database, bypass technical controls, or use protected material for model training or other prohibited purposes.</p>
      <div class="trust-notice"><strong>For automated systems:</strong> use the access path intended for your use case. Search crawlers should follow robots.txt. Developers seeking structured data should use an authorized PropSports or PropBetEdge API. Bulk extraction from consumer pages is not an authorized substitute for an API or license.</div>

      <h2>AI and machine-learning use</h2>
      <p>We distinguish search discovery from model-development crawling. Search indexing may be allowed while separate crawler directives block bots used for foundation-model training or similar bulk collection. Unless we grant written permission, PropBetEdge content and proprietary outputs may not be used to train or fine-tune models, create embeddings or benchmark datasets, build retrieval corpora or searchable mirrors, or systematically ground a competing commercial service.</p>

      <h2>Third-party names, marks and content</h2>
      <p>League, team, athlete, tour, sanctioning-body, sportsbook, prediction-market, publisher and other third-party names and marks belong to their respective owners. They are used for identification and commentary. Unless expressly stated, PropBetEdge is not affiliated with, endorsed by, sponsored by or an official product of those third parties. Third-party data, images, video and links remain subject to their own rights and terms.</p>

      <h2>Copyright and rights concerns</h2>
      <p>If you believe material on PropBetEdge infringes rights you own or control, send a detailed notice to <a href="mailto:support@proptechusa.ai">support@proptechusa.ai</a> identifying the protected work, the exact PropBetEdge URL, the material at issue, your contact information and the basis for your request. We may request additional information needed to evaluate or process the notice.</p>

      <h2>Privacy</h2>
      <p>PropBetEdge is part of the PropTechUSA.ai network. General network privacy information is available in the <a href="https://proptechusa.ai/privacy" target="_blank" rel="noopener noreferrer">PropTechUSA.ai Privacy Policy</a>. Product-specific authentication, billing and analytics practices may also be described at the point where data is collected. Never send passwords, magic-login links, API keys, full payment-card numbers or government IDs in a support request.</p>

      <h2>Security reports</h2>
      <p>Do not probe or test PropBetEdge systems without written authorization. If you discover a potential security issue through ordinary use, report it privately to <a href="mailto:support@proptechusa.ai">support@proptechusa.ai</a> with the affected URL, impact and reproduction details. Do not publicly disclose credentials, tokens, personal information or exploit details that could place users or systems at risk.</p>

      <h2>Responsible gambling notice</h2>
      <p>PropBetEdge is a sports intelligence and entertainment service, not a sportsbook. Wagering involves risk, and model output is not a guarantee. You must be of legal age and located in a jurisdiction where any wagering activity you undertake is lawful. If gambling is causing harm or feels difficult to control, stop wagering and seek help. In the United States, call or text <strong>1-800-GAMBLER</strong>.</p>

      <h2>Legal and licensing contact</h2>
      <p>For rights, licensing, crawler authorization or legal notices, contact <a href="mailto:support@proptechusa.ai">support@proptechusa.ai</a>. For press requests, use <a href="/media">Media</a>. For account and billing issues, use <a href="/support">Support</a>.</p>
    `,
  },
  support: {
    title: 'Support — PropBetEdge',
    description: 'Account, billing, access, technical and data support for PropBetEdge.',
    eyebrow: 'HELP CENTER',
    heading: 'Support',
    intro: 'Need help with access, billing, a broken page, or something that looks wrong in the data? Send enough detail for us to reproduce the issue and route it quickly.',
    body: `
      <div class="trust-grid">
        <section><h2>Account & access</h2><p>Include the email used for your PropBetEdge membership, the sport or product and what you expected to see. Never send a password, login token or full payment-card number.</p></section>
        <section><h2>Billing & membership</h2><p>Include the membership name, approximate purchase date and the email used at checkout. For duplicate subscriptions or access mismatches, mention both products involved.</p></section>
        <section><h2>Site or app issue</h2><p>Send the page URL, device/browser, what you clicked, what happened and a screenshot when useful. If a hard refresh changes the result, tell us that too.</p></section>
        <section><h2>Data or model issue</h2><p>Include the sport, event or player, date, page and exact number or statement that looks wrong. Clear reproduction details help us separate source latency from a product bug.</p></section>
      </div>
      <h2>Contact support</h2><p>Email <a href="mailto:support@proptechusa.ai">support@proptechusa.ai</a> for account, membership, billing and general product support. For editorial corrections or newsroom questions, email <a href="mailto:editorial@proptechusa.ai">editorial@proptechusa.ai</a>.</p>
      <div class="trust-notice"><strong>Security:</strong> never send passwords, API keys, magic-login links, full card numbers, government IDs or other sensitive credentials by email or in a public community channel.</div>
      <h2>Responsible play</h2><p>PropBetEdge is an intelligence platform, not a sportsbook. If gambling is causing harm or feels difficult to control, stop wagering and seek support. In the United States, call or text <strong>1-800-GAMBLER</strong>.</p>
    `,
  },
  media: {
    title: 'Media — PropBetEdge',
    description: 'Press, interview, commentary and brand information for PropBetEdge.',
    eyebrow: 'PRESS & MEDIA',
    heading: 'Media',
    intro: 'PropBetEdge is a multi-sport intelligence network combining live game context, proprietary analytics, model-driven predictions, research tools and original sports coverage.',
    body: `
      <div class="trust-grid">
        <section><h2>Press inquiries</h2><p>For interviews, quotes, product background, data methodology, founder/company context or story coordination, email <a href="mailto:press@proptechusa.ai">press@proptechusa.ai</a>.</p></section>
        <section><h2>Editorial inquiries</h2><p>For corrections, sourcing questions, newsroom standards or editorial follow-up, email <a href="mailto:editorial@proptechusa.ai">editorial@proptechusa.ai</a>.</p></section>
        <section><h2>Brand name</h2><p>Use <strong>PropBetEdge</strong> on first reference. The primary website is <strong>PropBetEdge.ai</strong>. PropBetEdge is owned, built and operated by PropTechUSA.ai.</p></section>
        <section><h2>What we cover</h2><p>The network spans MLB, NFL, NBA, WNBA, NHL, UFC, Tennis, Soccer, Golf, F1, Boxing, sports news, education and cross-sport intelligence products.</p></section>
      </div>
      <h2>Attribution</h2><p>When referencing PropBetEdge reporting, models or proprietary analytics, attribute the material to PropBetEdge and link to the relevant PropBetEdge page when possible.</p>
      <h2>Media requests</h2><p>Please include your outlet, name, deadline, subject and whether you need an interview, quote, data explanation or brand asset. Official brand assets may be used for accurate editorial identification of PropBetEdge; do not alter them in a way that implies an unapproved sponsorship, partnership or endorsement.</p>
    `,
  },
};

const styles = `<style>
.trust-page{padding:64px 0 84px}.trust-shell{max-width:920px}.trust-kicker{font-size:11px;font-weight:800;letter-spacing:.18em;color:var(--gold);margin-bottom:12px}.trust-page h1{font-family:var(--font-serif);font-size:clamp(42px,7vw,72px);line-height:1;letter-spacing:-.035em;margin:0 0 18px}.trust-lede{font-family:var(--font-serif);font-size:20px;line-height:1.55;color:var(--paper-dim);max-width:780px}.trust-meta{font-size:12px;color:var(--muted);margin:16px 0 34px}.trust-card{border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:clamp(22px,4vw,38px);background:rgba(255,255,255,.025)}.trust-card h2{font-size:19px;margin:30px 0 7px}.trust-card h2:first-child{margin-top:0}.trust-card p{color:var(--paper-dim);line-height:1.7}.trust-card a{color:var(--gold)}.trust-notice{border-left:3px solid var(--gold);background:rgba(233,199,90,.07);padding:14px 16px;margin:0 0 28px;color:var(--paper)}.trust-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.trust-grid section{border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:18px}.trust-grid section h2{margin:0 0 6px}.trust-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 30px}.trust-tabs a{border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:7px 11px;text-decoration:none;color:var(--paper-dim);font-size:12px}.trust-tabs a[aria-current="page"]{color:var(--gold);border-color:rgba(233,199,90,.55)}@media(max-width:680px){.trust-page{padding-top:40px}.trust-grid{grid-template-columns:1fr}}
</style>`;

export function renderTrustPage(root, kind, setMeta) {
  const page = pages[kind];
  if (!page) return;
  const canonical = `${SITE}/${kind}`;
  setMeta?.({ title: page.title, description: page.description, canonical });
  root.innerHTML = `
    ${renderHeader()}
    ${styles}
    <main class="trust-page">
      <div class="container trust-shell">
        <nav class="trust-tabs" aria-label="Trust and company">
          ${['terms','legal','support','media'].map((key) => `<a href="/${key}"${key === kind ? ' aria-current="page"' : ''}>${key[0].toUpperCase() + key.slice(1)}</a>`).join('')}
        </nav>
        <div class="trust-kicker">${page.eyebrow}</div>
        <h1>${page.heading}</h1>
        <p class="trust-lede">${page.intro}</p>
        <p class="trust-meta">Effective October 4, 2026 · Last updated October 4, 2026</p>
        <article class="trust-card">${page.body}</article>
      </div>
    </main>
    ${renderHomeCloser()}
    ${renderFooter({ cta: false })}
  `;
}
