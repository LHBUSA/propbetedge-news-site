import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';

const SITE = 'https://propbetedge.ai';

const pages = {
  terms: {
    title: 'Terms of Service — PropBetEdge',
    description: 'High-level terms governing use of the PropBetEdge sports intelligence network.',
    eyebrow: 'TRUST & LEGAL',
    heading: 'Terms of Service',
    intro: 'These Terms apply to PropBetEdge and its sport, news, learning, intelligence and membership properties. By using the network, you agree to use it lawfully, responsibly and subject to the limits below.',
    body: `
      <div class="trust-notice"><strong>Important:</strong> PropBetEdge provides sports information, analysis, models, predictions and entertainment. PropBetEdge is not a sportsbook, casino, bookmaker, broker, investment adviser or financial institution. Nothing on the network guarantees a winning outcome or profit.</div>
      <h2>1. Eligibility and lawful use</h2><p>You must be legally capable of agreeing to these Terms. If you use wagering-related information, you are responsible for complying with the laws, age requirements and rules that apply where you are located. Do not use PropBetEdge where doing so is unlawful.</p>
      <h2>2. Sports intelligence, models and predictions</h2><p>Scores, statistics, market information, projections, picks, model outputs, live intelligence, editorial material and other content may be delayed, incomplete, revised, unavailable or wrong. Models are probabilistic, not promises. Past performance does not guarantee future results. You are responsible for your own decisions and for independently verifying information that matters to you.</p>
      <h2>3. Accounts, memberships and paid access</h2><p>Some features require an account or paid membership. You are responsible for activity under your account and for keeping access links, credentials and devices secure. Memberships provide access to the features described at purchase and may change as products evolve. Billing, renewals, cancellations, refunds, trials, promotions and taxes are governed by the checkout terms shown to you and applicable law.</p>
      <h2>4. Acceptable use</h2><p>You may not interfere with the service, bypass access controls, probe for vulnerabilities, misuse accounts, automate abusive traffic, impersonate another person, or use the network for unlawful, fraudulent, deceptive or harmful activity.</p>
      <h2>5. Data, content and intellectual property</h2><p>PropBetEdge branding, product design, model logic, original editorial content, compilations, software and proprietary analytics are protected by applicable intellectual-property and other laws. Unless expressly authorized, you may not copy, scrape, bulk-extract, republish, resell, sublicense, create a competing dataset from, or commercially exploit protected portions of the service. Third-party names, marks, data, images and links remain the property of their respective owners and may be subject to separate terms.</p>
      <h2>6. External services and links</h2><p>The network may reference or link to third-party services, data providers, sportsbooks, payment processors, social networks, publishers or other websites. We do not control those services and are not responsible for their availability, security, accuracy or terms.</p>
      <h2>7. Service changes and availability</h2><p>We may add, modify, suspend, limit or discontinue features, sports, models, memberships, pages, APIs or other services. We may restrict or terminate access when needed for security, abuse prevention, nonpayment, legal compliance or protection of the network and its users.</p>
      <h2>8. No warranties</h2><p>To the fullest extent permitted by law, the services are provided on an “as is” and “as available” basis without warranties of guaranteed accuracy, availability, fitness for a particular purpose, profitability or uninterrupted operation.</p>
      <h2>9. Limitation of responsibility</h2><p>To the fullest extent permitted by law, PropBetEdge and its operators are not responsible for losses arising from wagering decisions, reliance on predictions or data, missed opportunities, service interruptions, third-party services or unauthorized account use. Nothing in these Terms excludes rights or liabilities that cannot lawfully be excluded.</p>
      <h2>10. Changes to these Terms</h2><p>We may update these Terms as the network changes. The “Last updated” date will reflect material revisions. Continued use after an update means you accept the revised Terms to the extent permitted by law.</p>
      <h2>11. Questions</h2><p>Questions about these Terms or your account can be directed through <a href="/support">Support</a>. Press and media requests belong on the <a href="/media">Media</a> page.</p>
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
      <h2>Contact support</h2><p>Email <a href="mailto:hello@proptechusa.ai">hello@proptechusa.ai</a> for account, membership, billing and general product support. For editorial corrections or newsroom questions, email <a href="mailto:editorial@proptechusa.ai">editorial@proptechusa.ai</a>.</p>
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
          ${['terms','support','media'].map((key) => `<a href="/${key}"${key === kind ? ' aria-current="page"' : ''}>${key[0].toUpperCase() + key.slice(1)}</a>`).join('')}
        </nav>
        <div class="trust-kicker">${page.eyebrow}</div>
        <h1>${page.heading}</h1>
        <p class="trust-lede">${page.intro}</p>
        <p class="trust-meta">Effective October 4, 2026 · Last updated October 4, 2026</p>
        <article class="trust-card">${page.body}</article>
      </div>
    </main>
    ${renderFooter()}
  `;
}
