import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { renderHomeCloser } from '../components/home-closer.js';
import '../styles/home-closer.css';

const SITE = 'https://propbetedge.ai';

const pages = {
  terms: {
    title: 'Terms of Service — PropBetEdge',
    description: 'Terms governing the PropBetEdge sports intelligence and entertainment network, including memberships, billing, no-refund policy, automated access, data use and AI-training restrictions.',
    eyebrow: 'TRUST & LEGAL',
    heading: 'Terms of Service',
    toc: true,
    intro: 'These Terms govern PropBetEdge and its sport, news, learning, intelligence, membership and related properties. PropBetEdge is a digital sports intelligence and entertainment service. By accessing, purchasing or using the network, you agree to these Terms.',
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

      <h2>6. Accounts, memberships, billing, cancellations and refunds</h2>
      <p>You are responsible for activity under your account and for protecting magic links, credentials and devices. Access is personal unless a written plan expressly says otherwise. You may not share, sell, transfer or sublicense paid access. Fees, renewal terms, promotions, taxes and entitlements are governed by the checkout terms shown to you, these Terms and applicable law. We may correct pricing or entitlement errors and may suspend access for nonpayment or abuse.</p>
      <div class="trust-notice"><strong>No-refund policy for digital sports intelligence.</strong> PropBetEdge memberships provide immediate access to digital sports information, live data, model output, predictions, proprietary analytics, research and entertainment features. Except where required by applicable law or expressly agreed by us in writing, subscription and membership charges are final and non-refundable once access is activated or made available.</div>
      <p>Cancellation stops future renewal; it does not reverse or prorate the current billing period. A losing pick, incorrect prediction, revised model output, changed odds or market prices, a player or team result, an unavailable or delayed data point, a temporary feature outage, a sport or event not producing the result you expected, non-use of the membership, or dissatisfaction with the outcome of a wager does not create a right to a refund. PropBetEdge is not selling a guaranteed result, profit, wager, security or financial return.</p>
      <p>If you believe you were charged twice, charged after a cancellation should have taken effect, denied access because of a verified billing or entitlement error, or otherwise experienced a billing error, contact <a href="/support">Support</a>. We will investigate and correct verified billing or access errors. A correction, access extension, service credit or other remedy may be offered at our discretion where appropriate, but it does not convert the membership into a refundable product.</p>

      <h2>7. Sports intelligence, models and predictions</h2>
      <p>PropBetEdge is a sports intelligence and entertainment service. Scores, statistics, market information, projections, picks, Player DNA, probabilities, live intelligence, editorial material and other outputs may be delayed, incomplete, revised, unavailable or wrong. Models are probabilistic, not promises. Past performance does not guarantee future results. No pick, projection, probability, model edge, live signal or editorial statement is a warranty of accuracy, a promise of profit or a guarantee that a wager will win. You are responsible for your own decisions and for independently verifying information that matters to you.</p>

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
    toc: true,
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
      <p>How PropBetEdge handles personal information — memberships, sign-in, billing, analytics and cookies — is described in the <a href="/privacy">PropBetEdge Privacy Policy</a>. Never send passwords, magic-login links, API keys, full payment-card numbers or government IDs in a support request.</p>

      <h2>Security reports</h2>
      <p>Do not probe or test PropBetEdge systems without written authorization. If you discover a potential security issue through ordinary use, report it privately to <a href="mailto:support@proptechusa.ai">support@proptechusa.ai</a> with the affected URL, impact and reproduction details. Do not publicly disclose credentials, tokens, personal information or exploit details that could place users or systems at risk.</p>

      <h2>Responsible gambling notice</h2>
      <p>PropBetEdge is a sports intelligence and entertainment service, not a sportsbook. Wagering involves risk, and model output is not a guarantee. You must be of legal age and located in a jurisdiction where any wagering activity you undertake is lawful. If gambling is causing harm or feels difficult to control, stop wagering and seek help. In the United States, call or text <strong>1-800-GAMBLER</strong>.</p>

      <h2>Legal and licensing contact</h2>
      <p>For rights, licensing, crawler authorization or legal notices, contact <a href="mailto:support@proptechusa.ai">support@proptechusa.ai</a>. For press requests, use <a href="/media">Media</a>. For account and billing issues, use <a href="/support">Support</a>.</p>
    `,
  },
  privacy: {
    title: 'Privacy Policy — PropBetEdge',
    description: 'How PropBetEdge handles personal information: analytics, memberships and sign-in, Stripe billing, support, cookies and browser storage, and how that differs from the sports data and model records shown in the product.',
    eyebrow: 'TRUST & PRIVACY',
    heading: 'Privacy Policy',
    intro: 'What PropBetEdge collects about readers and members, why, who helps us process it and the choices you have. Each section opens with a short summary; the full text beneath it is what governs.',
    toc: true,
    body: `
      <div class="trust-notice"><strong>Operator:</strong> PropBetEdge is operated by Local Home Buyers LLC d/b/a PropTechUSA.ai, Saint Paul, Minnesota (“PropBetEdge”, “we”, “us”). This policy covers propbetedge.ai and the PropBetEdge sport, news, learning, predictions and membership sites that link to it. It is specific to the PropBetEdge consumer product; PropTechUSA.ai’s business data products have their own policy.</div>

      <h2>What this policy covers</h2>
      <p class="trust-summary"><span>In short</span>Personal information about you is different from the sports data, predictions and market records PropBetEdge publishes.</p>
      <p>This policy is about <strong>information relating to you</strong> as a reader, member or customer: your account, your membership, how you use our sites and how you contact us.</p>
      <p>It is not about the <strong>sports data shown in the product</strong> — scores, statistics, schedules, injuries, odds and market prices, athlete and team records — or about our <strong>prediction, model and market records</strong> such as picks, probabilities, grades and track records. Those are published sports information and PropBetEdge model output, not information about our users. Public information about athletes and other public figures that appears in sports coverage is handled under our <a href="/editorial-standards">Editorial Standards</a> and <a href="/legal">Legal</a> notices.</p>

      <h2>Information we collect</h2>
      <p class="trust-summary"><span>In short</span>Your email and membership details when you join, what you send us, and technical information about how our sites are used.</p>
      <ul>
        <li><strong>Membership and account information</strong> — the email address you use at checkout and to sign in, your membership plan and status, and the access (entitlements) it unlocks across PropBetEdge sites.</li>
        <li><strong>Billing information</strong> — checkout and subscription management are handled by Stripe. We receive the email, plan, payment status and subscription details we need to grant and manage access. We do not receive or store your full payment-card number.</li>
        <li><strong>Sign-in and session information</strong> — members sign in with a one-time link sent to their email instead of a password. When you sign in, a session cookie keeps you signed in and lets PropBetEdge sites check what your membership includes.</li>
        <li><strong>Support communications</strong> — the emails you send to support, editorial or press contacts and our replies.</li>
        <li><strong>Usage and device information</strong> — pages and articles viewed, links and features clicked, approximate engagement such as reading time and scroll depth, referring pages, browser and device type, and similar analytics described below.</li>
        <li><strong>Security and request logs</strong> — our hosting and security systems record request information such as URL, time, user agent and referrer, including records of automated or abusive traffic.</li>
      </ul>
      <p>If we offer email-link reader access to articles, the email you enter is used to send the access link, and a cookie containing a one-way hash of that email (not the email itself) records that you are unlocked.</p>

      <h2>How we use information</h2>
      <ul>
        <li>Provide PropBetEdge, sign you in and give members the access they paid for across sports and products.</li>
        <li>Process subscriptions, renewals, cancellations and billing questions.</li>
        <li>Answer support, editorial and press requests.</li>
        <li>Send service messages, such as sign-in links and important membership or policy notices.</li>
        <li>Understand which coverage, tools and pages are useful so we can improve them, mostly through aggregated analytics.</li>
        <li>Remember preferences you set, such as followed teams and writers.</li>
        <li>Protect the Services: detect and stop abuse, account sharing, fraud, scraping and attacks, and enforce our <a href="/terms">Terms of Service</a>.</li>
        <li>Comply with law and respond to lawful requests.</li>
      </ul>

      <h2>Subscriptions and billing</h2>
      <p class="trust-summary"><span>In short</span>Stripe runs checkout and the billing portal; we see what we need to manage your membership, not your card number.</p>
      <p>All Access and other memberships are purchased through Stripe-hosted checkout, and you can manage or cancel a subscription in the Stripe billing portal linked from our footer and <a href="/support">Support</a> page. Stripe processes payment information under its own privacy policy. We keep subscription and transaction records needed for access, accounting, tax, fraud prevention and dispute handling.</p>

      <h2>Service providers</h2>
      <p class="trust-summary"><span>In short</span>We use a small set of providers to host, bill, email and measure PropBetEdge. We do not sell your personal information.</p>
      <p>Providers that process information for us include:</p>
      <ul>
        <li>website hosting and edge delivery (including Vercel and Cloudflare);</li>
        <li>payments and subscription billing (Stripe);</li>
        <li>databases used to run memberships and product features;</li>
        <li>transactional email for sign-in and access links;</li>
        <li>analytics (Google Analytics).</li>
      </ul>
      <p>We may also disclose information when the law requires it, to protect the rights, safety and security of PropBetEdge, our members or others, or as part of a merger, acquisition, financing or sale of assets. We do not sell personal information, and we do not run third-party advertising networks or ad pixels on propbetedge.ai.</p>

      <h2>Analytics, cookies and browser storage</h2>
      <ul>
        <li><strong>Google Analytics 4</strong> runs on PropBetEdge production sites. It sets analytics cookies on propbetedge.ai and its sport sites and records page views, clicks on links and calls to action, outbound clicks, article reading time and scroll depth, and changes to followed teams.</li>
        <li><strong>Sign-in and access cookies</strong> keep members signed in and record access. They are necessary for paid features to work.</li>
        <li><strong>Browser storage</strong> — your browser’s local storage keeps preferences such as followed teams, followed writers, your background scene and how often a membership promotion has been shown. This stays on your device; clearing site data removes it.</li>
        <li><strong>Security</strong> — our edge network may set short-lived security cookies to separate people from automated traffic.</li>
      </ul>
      <p>You can block or delete cookies in your browser settings and use Google’s browser add-on to opt out of Google Analytics. Blocking sign-in cookies will sign you out of member features.</p>

      <h2>Embedded and linked services</h2>
      <p>Some pages load content from other services, which receive standard request information (such as your IP address and browser details) from your browser when that content loads: Google Fonts; Google’s preferred-sources tool; YouTube video embeds (article embeds use YouTube’s privacy-enhanced mode); team, league and athlete images from their publishers’ image servers or through our image service; and the Mother AI verification badge. Links to Stripe, Discord, X, LinkedIn, Bluesky, sportsbooks, prediction markets, leagues and publishers take you to services that operate under their own policies.</p>

      <h2>Security</h2>
      <p>We use encrypted connections, email sign-in links, protected session cookies, access controls and monitoring. No system is perfectly secure. Never send passwords, sign-in links, full card numbers or government IDs by email, and report suspected misuse of your account to <a href="mailto:support@proptechusa.ai">support@proptechusa.ai</a>.</p>

      <h2>Retention</h2>
      <p>We keep membership and entitlement records while your membership is active and for a reasonable period after it ends; billing and transaction records for as long as accounting, tax and legal obligations require; support correspondence for as long as needed to resolve the request and a reasonable period afterwards; and security and request logs for as long as needed to protect the Services and investigate incidents. Analytics data is kept under the retention settings of our analytics provider. When information is no longer needed, we delete or de-identify it.</p>

      <h2>Your choices and rights</h2>
      <p class="trust-summary"><span>In short</span>Depending on where you live, you can ask to see, correct, delete or export your information.</p>
      <p>Depending on your location — including certain US states, the UK and the European Economic Area — you may have rights to access, correct, delete or receive a copy of your personal information, to object to or restrict certain processing, to withdraw consent, and not to be discriminated against for exercising these rights. To make a request, email <a href="mailto:support@proptechusa.ai">support@proptechusa.ai</a> with the subject “Privacy request” from the email address on your membership. We will verify the request and respond within the time the law requires. Deleting your information ends membership access; some records, such as billing records, may be kept where the law requires. You can also cancel a subscription at any time in the Stripe billing portal.</p>

      <h2>Children</h2>
      <p>PropBetEdge is intended for adults. It is not directed to anyone under 18, and wagering-related information is meant only for people of legal age where they live. We do not knowingly collect personal information from children. If you believe a child has given us personal information, contact us and we will delete it.</p>

      <h2>International users</h2>
      <p>PropBetEdge is operated from the United States. If you use it from elsewhere, your information will be processed in the United States and in other countries where our providers operate.</p>

      <h2>Changes to this policy</h2>
      <p>We will update this policy when our practices change. The “Last updated” date identifies the current version. For material changes, we may also notify members by email or on the site.</p>

      <h2>Contact</h2>
      <p>Privacy questions and requests: <a href="mailto:support@proptechusa.ai">support@proptechusa.ai</a>. Local Home Buyers LLC d/b/a PropTechUSA.ai, Saint Paul, Minnesota. See also the <a href="/terms">Terms of Service</a>, <a href="/legal">Legal</a> and <a href="/support">Support</a>.</p>
    `,
  },
  support: {
    title: 'Support — PropBetEdge',
    description: 'Account, billing, access, technical and data support for PropBetEdge, including membership cancellations and the no-refund policy.',
    eyebrow: 'HELP CENTER',
    heading: 'Support',
    intro: 'Need help with access, billing, a broken page, or something that looks wrong in the data? Send enough detail for us to reproduce the issue and route it quickly.',
    body: `
      <div class="trust-grid">
        <section><h2>Account & access</h2><p>Include the email used for your PropBetEdge membership, the sport or product and what you expected to see. Never send a password, login token or full payment-card number.</p></section>
        <section><h2>Billing & membership</h2><p>Include the membership name, approximate purchase date and the email used at checkout. For duplicate subscriptions, post-cancellation charges or access mismatches, mention both products involved so we can investigate the billing or entitlement record.</p></section>
        <section><h2>Site or app issue</h2><p>Send the page URL, device/browser, what you clicked, what happened and a screenshot when useful. If a hard refresh changes the result, tell us that too.</p></section>
        <section><h2>Data or model issue</h2><p>Include the sport, event or player, date, page and exact number or statement that looks wrong. Clear reproduction details help us separate source latency from a product bug.</p></section>
      </div>
      <h2>Membership cancellations and refunds</h2>
      <div class="trust-notice"><strong>PropBetEdge memberships are non-refundable digital services.</strong> Access to sports intelligence, live data, models, predictions, proprietary analytics, research and entertainment features is made available digitally. Except where applicable law requires otherwise or we expressly agree in writing, charges are final once access is activated or made available. Cancellation stops the next renewal; it does not prorate or reverse the current billing period.</div>
      <p>A losing pick, incorrect prediction, revised model output, changed market price, delayed or unavailable data point, temporary feature outage, non-use, or dissatisfaction with a game, match, race, fight, market or wagering outcome is not a refundable event. If the issue is a duplicate charge, a charge after cancellation should have taken effect, or a verified billing/access error, contact us and we will investigate and correct the error.</p>
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
.trust-card h2[id]{scroll-margin-top:96px}.trust-card ul{margin:10px 0 0;padding-left:20px;color:var(--paper-dim);line-height:1.7}.trust-card li{margin:0 0 8px}.trust-card li strong,.trust-card p strong{color:var(--paper)}.trust-summary{margin:8px 0 14px;padding:10px 14px;border-left:2px solid rgba(212,175,55,.6);background:rgba(255,245,220,.035);color:var(--paper)!important;font-size:15px;line-height:1.55}.trust-summary span{margin-right:8px;font-family:var(--font-mono);font-size:10.5px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--gold)}.trust-shell:has(.trust-layout){max-width:1140px}.trust-layout{display:grid;grid-template-columns:220px minmax(0,800px);gap:44px;align-items:start}.trust-toc{position:sticky;top:96px;max-height:calc(100vh - 120px);overflow:auto;padding-right:6px}.trust-toc-label{font-family:var(--font-mono);font-size:10.5px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:var(--paper-dim);margin:0 0 10px}.trust-toc ol,.trust-toc-mobile ol{list-style:none;margin:0;padding:0;counter-reset:t}.trust-toc li,.trust-toc-mobile li{counter-increment:t}.trust-toc a,.trust-toc-mobile a{display:flex;gap:10px;padding:5px 0;font-size:13px;line-height:1.4;color:var(--paper-dim);text-decoration:none}.trust-toc a::before,.trust-toc-mobile a::before{content:counter(t,decimal-leading-zero);font-family:var(--font-mono);font-size:10.5px;color:var(--gold);opacity:.8;padding-top:2px}.trust-toc a:hover,.trust-toc-mobile a:hover{color:var(--paper)}.trust-page a:focus-visible{outline:2px solid var(--gold);outline-offset:3px;border-radius:2px}.trust-toc-mobile{display:none;margin:0 0 22px;border:1px solid rgba(255,245,220,.12);border-radius:12px;background:rgba(255,245,220,.03)}.trust-toc-mobile summary{cursor:pointer;padding:12px 16px;font-family:var(--font-mono);font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--paper-dim)}.trust-toc-mobile ol{padding:0 16px 12px}@media(max-width:1023px){.trust-layout{display:block}.trust-toc{display:none}.trust-toc-mobile{display:block}}
</style>`;

const TAB_LABELS = { privacy: 'Privacy', terms: 'Terms', legal: 'Legal', support: 'Support', media: 'Media' };

// Section anchors + contents for the long legal documents (presentation only; the text is untouched).
const slug = (text) => text.replace(/<[^>]+>/g, '').replace(/&amp;/g, 'and').replace(/^\d+\.\s*/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function withAnchors(html) {
  const toc = [];
  const body = html.replace(/<h2>([\s\S]*?)<\/h2>/g, (_, label) => {
    const id = slug(label);
    toc.push({ id, label });
    return `<h2 id="${id}">${label}</h2>`;
  });
  return { body, toc };
}

export function renderTrustPage(root, kind, setMeta) {
  const page = pages[kind];
  if (!page) return;
  const canonical = `${SITE}/${kind}`;
  setMeta?.({ title: page.title, description: page.description, canonical });
  const { body, toc } = page.toc ? withAnchors(page.body) : { body: page.body, toc: [] };
  const contents = toc.length ? `<ol>${toc.map((t) => `<li><a href="#${t.id}">${t.label}</a></li>`).join('')}</ol>` : '';
  root.innerHTML = `
    ${renderHeader({ mode: 'editorial' })}
    ${styles}
    <main class="trust-page">
      <div class="container trust-shell">
        <nav class="trust-tabs" aria-label="Trust and company">
          ${['privacy','terms','legal','support','media'].map((key) => `<a href="/${key}"${key === kind ? ' aria-current="page"' : ''}>${TAB_LABELS[key]}</a>`).join('')}
        </nav>
        <div class="trust-kicker">${page.eyebrow}</div>
        <h1>${page.heading}</h1>
        <p class="trust-lede">${page.intro}</p>
        <p class="trust-meta">Effective October 5, 2026 · Last updated October 5, 2026</p>
        ${contents ? `<details class="trust-toc-mobile"><summary>On this page · ${toc.length} sections</summary>${contents}</details>` : ''}
        <div class="${contents ? 'trust-layout' : ''}">
          ${contents ? `<nav class="trust-toc" aria-label="On this page"><div class="trust-toc-label">On this page</div>${contents}</nav>` : ''}
          <article class="trust-card">${body}</article>
        </div>
      </div>
    </main>
    ${renderHomeCloser()}
    ${renderFooter({ cta: false })}
  `;
}
