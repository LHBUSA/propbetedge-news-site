/**
 * src/pages/author.js
 * Author profile page — bio, role, latest articles
 *
 * Routes: /authors/justin-erickson
 *         /authors/donneal-green
 *         /authors/eric-esters
 *         /authors/erik-schwartz
 *         /authors/propbetedge-editorial-team
 *
 * Strong E-E-A-T signal for Google: real authors with role, bio, and article portfolio.
 * Each profile is a structured Person entity that links back to NewsArticle author fields.
 */

import { api } from '../api.js';
import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { renderArticleCard, escapeHtml, escapeAttr } from '../components/article-card.js';
import { renderNotFound } from './404.js';
import {
  organizationSchema, websiteSchema, breadcrumbSchema,
  profilePageSchema, injectSchemas,
} from '../schema.js';

// ─── Author registry ────────────────────────────────────────────────────
// Single source of truth for each author's identity. Slug → full profile.
const AUTHORS = {
  'justin-erickson': {
    name: 'Justin Erickson',
    role: 'Founder & CTO',
    title: 'Founder & Chief Technology Officer, PropBetEdge',
    bio: `Justin Erickson is the founder and chief architect of PropBetEdge — the first AI-native sports newsroom and prop-bet intelligence platform of its kind. A self-taught full-stack engineer based in Saint Paul, Minnesota, he has built and shipped over 230 production Cloudflare Workers across sports analytics, real estate technology, and AI infrastructure, including the Poisson-based fair-value odds model that powers PropBetEdge's daily picks and the editorial pipeline that publishes 100+ original prop-bet articles per day at a fraction of traditional newsroom cost.

Justin's coverage spans all four major sports with a focus on systemic edges — the kind of plays that emerge when lineup changes ripple across multiple prop markets, when front-office moves reshape long-tail futures, or when AI-assisted research surfaces angles that traditional handicapping misses entirely. His thesis: the future of sports analysis belongs to operators who can fuse domain expertise with the technical fluency to build their own tooling.

Beyond PropBetEdge, Justin is the founder and CEO of LocalHomeBuyersUSA, a nationwide real estate investment operation, and PropTechUSA.ai, the parent company behind PropData (165M+ property records) and a growing portfolio of AI-native platforms. He has authored 20+ books spanning technology, real estate strategy, and the philosophy of AI consciousness — including the white papers <em>The Third Kind of Mind</em> and <em>Lost in the Mirror</em>, which have been cited in early academic discussion of AI cognition.

When he writes about sports, the lens is always the same: where is the market mispricing systematic information, and what tools can surface that edge faster than anyone else?`,
    expertise: [
      'Cross-sport prop-bet strategy & systemic market edges',
      'AI-driven sports analytics infrastructure',
      'Quantitative model design & fair-value odds',
      'Lineup, roster, and front-office ripple effects',
    ],
    credentials: [
      'Founder & CTO, PropBetEdge',
      'Founder, PropTechUSA.ai',
      'Author of 20+ books on technology, real estate & AI',
      'Architect of 230+ production Cloudflare Workers',
    ],
    twitter: 'https://x.com/propbetedgeai',
    location: 'Saint Paul, MN',
    initials: 'JE',
    accent: 'gold',
  },
  'donneal-green': {
    name: 'Donneal Green',
    role: 'VP, Player Markets & Picks',
    title: 'Vice President of Player Markets, PropBetEdge',
    bio: `Donneal Green is the Vice President of Player Markets at PropBetEdge, leading the daily pick generation operation across MLB, NFL, NBA, and NHL. He is the architect and human voice behind PropBetEdge's K Props lineup — the strikeout-prop product that has become the platform's signature MLB offering — and works the early-morning slate review every day before lineups are even confirmed.

Donneal's edge is methodical. Where most analysts default to narrative-driven picks ("this guy is due"), he cross-references current-form metrics with situational splits, umpire profiles, park-factor adjustments, and the kind of micro-news — a pitcher's velocity dipping in his last bullpen, a hitter quietly shifting his stance in BP — that reshapes lines hours before first pitch but rarely makes the box score recap. His approach is closer to a sportsbook trader than a typical handicapper: find where the market is slow to price information, then move before it adjusts.

His MLB strikeout work draws on Statcast-grade pitcher data, recent CSW% trends, and lineup handedness splits — but he writes across all four sports with the same lens. On NFL, he tracks running back workload distribution and target share shifts that move under-the-radar receivers' totals. On NBA, he focuses on rotation reads and minutes restrictions in playoff series. On NHL, he leans into goaltender form and shot-share matchups.

When Donneal publishes a pick, it has been pressure-tested against the data — not just the narrative. That's the standard at PropBetEdge.`,
    expertise: [
      'MLB strikeout props & K Props daily lineup',
      'NFL workload & target share analysis',
      'Pitcher matchup modeling (CSW%, swstr%, recent form)',
      'Multi-sport prop research & line value timing',
    ],
    credentials: [
      'VP, Player Markets — PropBetEdge',
      'Lead architect of the K Props daily product',
      'Daily slate review across MLB, NFL, NBA, NHL',
    ],
    initials: 'DG',
    accent: 'algo',
  },
  'eric-esters': {
    name: 'Eric Esters',
    role: 'VP, Sports Strategy & Acquisitions',
    title: 'Vice President of Sports Strategy, PropBetEdge',
    bio: `Eric Esters is the Vice President of Sports Strategy at PropBetEdge and a seasoned operator across the LocalHomeBuyersUSA nationwide deal-flow network. His unique angle on sports betting comes from years spent underwriting cash real-estate transactions — work that demands the same skill set sharp prop bettors use: cut through the narrative, weight the verifiable signal, and act on the asymmetric edge before the market adjusts.

Eric's strongest reads are on basketball rotation mechanics and NFL workload distribution — the second-order effects that emerge when a backup point guard gets promoted, a depth-chart shuffles in week 6, or a starter is scratched 30 minutes before puck drop. While most analysts cover the headline injury news, Eric's coverage tracks the contract leverage points and front-office mechanics that move long-tail props bookmakers are slow to reprice: minutes restrictions in back-to-backs, target-share concentration after a trade, and the kind of roster math that turns into prop-market value when nobody else is paying attention.

His coverage spans all four major sports — ESPN-analyst style — with a focus on the long-tail edges institutional bettors miss. On NBA, he writes about rotation shifts and lineup-driven scoring concentration. On NFL, he focuses on red-zone target share, snap-count trends, and post-trade workload realignment. On MLB and NHL, he applies the same lens: where is the market still pricing yesterday's depth chart?

Eric's belief: the difference between a 52% bettor and a 56% bettor isn't access to data. It's discipline about which data actually matters.`,
    expertise: [
      'NBA rotation, minutes & lineup edges',
      'NFL workload, target share & snap-count trends',
      'Front-office moves with prop-market implications',
      'Multi-sport long-tail edge identification',
    ],
    credentials: [
      'VP, Sports Strategy — PropBetEdge',
      'Director of Acquisitions — LocalHomeBuyersUSA',
      'Multi-sport prop coverage across four major leagues',
    ],
    initials: 'EE',
    accent: 'gold',
  },
  'erik-schwartz': {
    name: 'Erik Schwartz',
    role: 'Senior Editorial — Hockey, Football & Baseball',
    title: 'Senior Editorial Contributor, PropBetEdge',
    bio: `Erik Schwartz is a senior editorial contributor at PropBetEdge covering NHL, NFL, and MLB — and the lead voice on hockey across the masthead. His NHL coverage is the deepest on the staff: line-shuffle implications for shots-on-goal markets, goaltender form trends across back-to-backs, special-teams matchups that move power-play-points props, and the kind of late-warmup news (a top-six winger reassigned to the fourth line, a starter pulled for "maintenance," a third pair suddenly skating top-pair minutes) that reshapes lines hours before puck drop but rarely surfaces in a national headline.

On football, Erik focuses on snap-share volatility and target-tree shifts — the second-order roster math that emerges after a Wednesday practice report, a Friday designation, or a midweek transaction. While most NFL coverage chases the injury headline itself, his angle is the workload realignment that follows: who absorbs the targets, who picks up the early-down snaps, and which prop markets are slowest to reprice the change. On baseball, he writes strikeout props, hitter total bases, and the bullpen-usage gymnastics that turn a "safe" over into a coin flip in the seventh.

Erik also contributes select NBA coverage during the regular season, focusing on rotation-driven prop volatility on heavy-slate nights — when bookmakers spread their attention thin and analytical edges open up across multiple props simultaneously. His cross-sport range makes him the editorial workload anchor on weeks when one league's news cycle goes quiet and another spikes.

Articles published under Erik's byline combine breaking-news editorial response with prop-market translation — taking the headlines other outlets stop at and pushing them one layer deeper to the actual betting implications. Methodology is transparent, AI-assisted research is disclosed, and every take stands on cited sources.`,
    expertise: [
      'NHL line combinations, goaltender form & special-teams matchups',
      'NFL snap-share, target-tree & late-week workload realignment',
      'MLB strikeout props & bullpen-usage forecasting',
      'Multi-sport breaking news → prop market translation',
    ],
    credentials: [
      'Senior Editorial Contributor — PropBetEdge',
      'Lead voice on NHL editorial coverage',
      'Multi-sport coverage across NHL, NFL, MLB & select NBA',
    ],
    initials: 'ES',
    accent: 'gold',
  },
  'propbetedge-editorial-team': {
    name: 'PropBetEdge Editorial Team',
    role: 'AI-Assisted Editorial',
    title: 'PropBetEdge Editorial Operations',
    bio: `The PropBetEdge Editorial Team is the hybrid human-and-AI editorial operation that publishes original prop-bet analysis daily across MLB, NFL, NBA, and NHL. Articles published under this byline are produced through our proprietary editorial pipeline — a system that combines real-time source-fetching from established sports outlets, AI-assisted drafting calibrated to the prop-bet implications of each story, and human editorial review on the strategic angles, picks, and market reads.

Our editorial methodology is intentionally transparent. Every article published under this byline goes through three phases: (1) source identification and verification against the original reporting, (2) AI-assisted drafting with a structured editorial framework focused on prop-bet impact, and (3) human review on the strategic conclusions, betting angles, and any data citations. We disclose AI assistance openly because we believe readers deserve to know how their information is produced — and because we believe the future of sports media is hybrid, not adversarial, when done with rigor.

This byline covers the rapid-response volume work that no single human can produce in real time: breaking injury news with prop-impact analysis within minutes of the wire report, post-game implication coverage on yesterday's games, and the kind of cross-sport editorial response that keeps PropBetEdge readers ahead of the market. For deeper takes, daily picks, and signature columns, articles are published under the bylines of our human staff: <a href="/authors/justin-erickson">Justin Erickson</a>, <a href="/authors/donneal-green">Donneal Green</a>, <a href="/authors/eric-esters">Eric Esters</a>, and <a href="/authors/erik-schwartz">Erik Schwartz</a>.

Our standards: <a href="/editorial-standards">read our editorial standards</a>.`,
    expertise: [
      'Cross-sport prop-bet impact analysis',
      'Real-time editorial response to breaking news',
      'AI-assisted research with human editorial oversight',
      'Source verification & transparent methodology',
    ],
    credentials: [
      'Hybrid human-AI editorial operation',
      'Daily volume coverage across MLB, NFL, NBA, NHL',
      'Transparent AI-assistance disclosure on every article',
    ],
    initials: 'PE',
    accent: 'algo',
  },
};

// Convert a name like "Justin Erickson" → "justin-erickson"
export function authorSlug(name) {
  return (name || '').toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
}

export function getAuthorBySlug(slug) {
  return AUTHORS[slug] || null;
}

export function listAuthors() {
  return Object.entries(AUTHORS).map(([slug, profile]) => ({ slug, ...profile }));
}

export async function renderAuthor(root, slug, setMeta) {
  const author = AUTHORS[slug];
  if (!author) {
    renderNotFound(root);
    return;
  }

  if (setMeta) {
    setMeta({
      title: `${author.name} — ${author.role} · PropBetEdge`,
      description: stripHtml(author.bio).slice(0, 160),
      canonical: `https://propbetedge.ai/authors/${slug}`,
    });
  }

  // Inject Person JSON-LD for E-E-A-T signal
  // 🆕 v3.9.6: Rich schema — ProfilePage wrapping Person + breadcrumbs + org + website
  injectSchemas([
    organizationSchema(),
    websiteSchema(),
    profilePageSchema(slug, author),
    breadcrumbSchema([
      { name: 'Home', url: '/' },
      { name: 'Editorial Team', url: '/authors' },
      { name: author.name },
    ]),
  ], 'jsonld-author');

  // Skeleton
  root.innerHTML = `
    ${renderHeader()}
    <main>
      <div class="container author-page">
        <header class="author-hero">
          <div class="author-avatar author-avatar-${author.accent}">${author.initials}</div>
          <div class="author-info">
            <span class="author-role-eyebrow">${escapeHtml(author.role)}</span>
            <h1 class="author-name">${escapeHtml(author.name)}</h1>
            <p class="author-title">${escapeHtml(author.title)}</p>
          </div>
        </header>

        <section class="author-bio-section">
          <div class="author-bio">${formatBioParagraphs(author.bio)}</div>
          <aside class="author-sidebar">
            ${author.credentials && author.credentials.length ? `
              <div class="author-credentials">
                <span class="author-sidebar-label">Credentials</span>
                <ul class="author-credentials-list">
                  ${author.credentials.map((c) => `<li>${escapeHtml(c)}</li>`).join('')}
                </ul>
              </div>
            ` : ''}
            ${author.expertise && author.expertise.length ? `
              <div class="author-expertise">
                <span class="author-sidebar-label">Coverage areas</span>
                <ul class="author-expertise-list">
                  ${author.expertise.map((e) => `<li>${escapeHtml(e)}</li>`).join('')}
                </ul>
              </div>
            ` : ''}
            ${author.location ? `
              <div class="author-meta-row">
                <span class="author-meta-label">Based in</span>
                <span class="author-meta-value">${escapeHtml(author.location)}</span>
              </div>
            ` : ''}
            ${author.twitter ? `
              <div class="author-social">
                <a href="${escapeAttr(author.twitter)}" target="_blank" rel="noopener">𝕏 Follow on X</a>
              </div>
            ` : ''}
          </aside>
        </section>

        <section class="author-articles-section">
          <div class="section-heading">
            <h2>Latest articles by ${escapeHtml(author.name)}</h2>
            <span class="section-meta" id="article-count">Loading…</span>
          </div>
          <div id="author-articles-grid" class="article-grid uniform-grid fade-stagger">${cardSkeleton(6)}</div>
        </section>
      </div>
    </main>
    ${renderFooter()}
  `;

  // Fetch articles by this author
  let resp;
  try {
    resp = await api.byAuthor(author.name, 24);
  } catch (e) {
    document.getElementById('author-articles-grid').innerHTML = `
      <div class="empty" style="grid-column:1/-1">
        <h3>Couldn't load articles</h3>
        <p>${escapeHtml(e.message)}</p>
      </div>
    `;
    return;
  }

  const articles = resp.articles || [];
  const total = resp.total || 0;
  const countEl = document.getElementById('article-count');
  if (countEl) {
    countEl.textContent = total === 0 ? 'No articles yet' : `${total} ${total === 1 ? 'article' : 'articles'} published`;
  }

  const grid = document.getElementById('author-articles-grid');
  if (!articles.length) {
    grid.innerHTML = `
      <div class="empty" style="grid-column:1/-1">
        <h3>No articles yet</h3>
        <p>${escapeHtml(author.name)}'s articles will appear here as they're published.</p>
      </div>
    `;
  } else {
    grid.innerHTML = articles.map((a) => renderArticleCard(a)).join('');
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────
function stripHtml(s) {
  return String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

// Split bio by double-newline into <p> tags. Bio HTML is trusted (we control it).
function formatBioParagraphs(bio) {
  if (!bio) return '';
  return bio
    .split(/\n\s*\n/)
    .map((para) => para.trim())
    .filter(Boolean)
    .map((para) => `<p>${para}</p>`)
    .join('\n');
}

function cardSkeleton(n) {
  let out = '';
  for (let i = 0; i < n; i++) {
    out += `
      <div class="skel-card">
        <div class="skel skel-card-img"></div>
        <div class="skel skel-line" style="width:25%;height:10px"></div>
        <div class="skel skel-line" style="width:90%;height:22px;margin-top:8px"></div>
        <div class="skel skel-line" style="width:75%;height:22px"></div>
      </div>
    `;
  }
  return out;
}
