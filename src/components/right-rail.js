/**
 * src/components/right-rail.js
 *
 * ESPN-pattern article right rail with three zones:
 *
 *   1. TOP HEADLINES — 5 latest articles from the homepage feed (excluding
 *      the current article). Plain-text list, sport tag, relative time.
 *
 *   2. MODEL NOTES — articles where take.advice exists and impact_score >= 3.
 *      Shows the bet_advice line in italic — the bettor angle no other site
 *      has. Sourced client-side from the same homepage feed (zero new infra).
 *
 *   3. PICKS CTA — one soft block at the bottom linking to mlb.propbetedge.ai.
 *      ESPN-style: rail's job is adjacent value, not aggressive conversion.
 *      The score strip already does aggressive teasing site-wide.
 *
 * USAGE — from article.js:
 *
 *     import { renderRailShell, mountArticleRail } from '../components/right-rail.js'
 *     // ...inside renderArticle, after main HTML is in place:
 *     mountArticleRail({ currentSlug: article.slug, currentSport: article.sport })
 *
 * The shell renders synchronously inside the article.js layout. The mount
 * fetches data via api.homepage() (already cached on most page loads) and
 * paints both zones. No new API endpoints. No new exports anywhere else.
 */

import { api } from '../api.js'

const SPORT_LABELS   = { mlb: 'MLB', nfl: 'NFL', nba: 'NBA', nhl: 'NHL' }

const PROP_TYPE_LABELS = {
  k_prop: 'Strikeouts',
  hr: 'Home Runs',
  altprop_hits: 'Hits',
  altprop_total_bases: 'Total Bases',
  altprop_doubles: 'Doubles',
  altprop_rbi: 'RBI',
  team_total: 'Team Total',
  spread: 'Spread',
  moneyline: 'Moneyline',
}

/* ─────────────────────────────────────────────────────────────────────────
 * STYLES — scoped under #pbe-article-rail
 * ────────────────────────────────────────────────────────────────────────*/
function injectStyles() {
  if (document.getElementById('pbe-article-rail-styles')) return
  const s = document.createElement('style')
  s.id = 'pbe-article-rail-styles'
  s.textContent = `
    /* Outer wrapper — flexbox layout that keeps the article at its natural
       container-narrow reading width and adds the rail beside it on desktop.
       Below 1100px, single column with article on top and rail below. */
    .article-with-rail {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 32px;
      padding: 0 16px;
      width: 100%;
      max-width: 100%;
    }
    .article-with-rail > .article-page {
      width: 100%;
      max-width: 720px;
    }
    .article-with-rail > #pbe-article-rail {
      width: 100%;
      max-width: 720px;
    }

    @media (min-width: 1100px) {
      .article-with-rail {
        flex-direction: row;
        align-items: flex-start;
        gap: 40px;
        max-width: 1140px;
        margin: 0 auto;
      }
      .article-with-rail > .article-page {
        flex: 1 1 720px;
        max-width: 720px;
        min-width: 0;
        margin: 0;
      }
      .article-with-rail > #pbe-article-rail {
        flex: 0 0 320px;
        width: 320px;
        max-width: 320px;
        /* Drop the rail down so it aligns with the article body, not the
           kicker/back-link. Roughly the height of the article-back link
           plus meta row + half the title. */
        margin-top: 80px;
      }
    }

    #pbe-article-rail {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      -webkit-font-smoothing: antialiased;
      display: flex;
      flex-direction: column;
      gap: 20px;
      min-width: 0;
    }

    /* Each card */
    .par-card {
      background: var(--surface, rgba(255, 255, 255, 0.03));
      border: 1px solid var(--line, rgba(255, 255, 255, 0.08));
      border-radius: 12px;
      padding: 18px 18px 16px;
    }

    /* Sticky behavior for the model notes + CTA — keeps the conversion lever
       visible while the user reads. Top headlines scrolls naturally. */
    @media (min-width: 1100px) {
      .par-card.par-sticky {
        position: sticky;
        top: 88px; /* 48px score strip + 40px breathing room */
      }
    }

    .par-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin: 0 0 14px;
      padding-bottom: 11px;
      border-bottom: 1px solid var(--line, rgba(255, 255, 255, 0.08));
    }
    .par-heading-title {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--paper, #f5f5f7);
      margin: 0;
    }
    .par-heading-meta {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.06em;
      color: var(--paper-subtle, rgba(245, 245, 247, 0.5));
      text-transform: uppercase;
    }
    .par-heading-pulse {
      display: inline-block;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #ef4444;
      margin-right: 6px;
      animation: par-pulse 1.6s ease-in-out infinite;
    }
    @keyframes par-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    /* ── Headlines list ──────────────────────────────────────────── */
    .par-headlines {
      display: flex;
      flex-direction: column;
    }
    .par-headline {
      display: block;
      padding: 12px 0;
      text-decoration: none;
      color: inherit;
      border-bottom: 1px solid var(--line, rgba(255, 255, 255, 0.06));
      transition: opacity 0.15s ease;
    }
    .par-headline:last-child { border-bottom: none; padding-bottom: 0; }
    .par-headline:first-child { padding-top: 0; }
    .par-headline:hover .par-headline-title { color: #ffd24a; }
    .par-headline-meta {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 9.5px;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: #b8c2d4;  /* readable instead of near-invisible */
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .par-headline-sport {
      color: #ffd24a;
      font-weight: 800;
    }
    .par-headline-dot {
      color: #64748b;
    }
    .par-headline-title {
      font-size: 14px;
      font-weight: 600;
      line-height: 1.4;
      color: var(--paper, #f5f5f7);
      transition: color 0.15s ease;
      margin: 0;
    }

    /* ── Model Notes ─────────────────────────────────────────────── */
    .par-notes {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .par-note {
      display: block;
      padding: 12px 14px;
      background: rgba(255, 210, 74, 0.04);
      border: 1px solid rgba(255, 210, 74, 0.15);
      border-left: 3px solid rgba(255, 210, 74, 0.5);
      border-radius: 6px;
      text-decoration: none;
      color: inherit;
      transition: border-color 0.15s ease, background 0.15s ease;
    }
    .par-note:hover {
      border-color: rgba(255, 210, 74, 0.4);
      border-left-color: #ffd24a;
      background: rgba(255, 210, 74, 0.08);
    }
    .par-note-meta {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: #b8c2d4;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .par-note-tag {
      color: #ffd24a;
      background: rgba(255, 210, 74, 0.14);
      padding: 2px 7px;
      border-radius: 3px;
      font-size: 8.5px;
      letter-spacing: 0.1em;
      font-weight: 800;
    }
    .par-note-impact {
      color: #b8c2d4;
    }
    .par-note-advice {
      font-size: 13px;
      font-weight: 500;
      font-style: italic;
      line-height: 1.55;
      color: #f5f8ff;  /* full white for max contrast against dark bg */
      margin: 0 0 8px;
    }
    .par-note-source {
      font-size: 10.5px;
      font-weight: 500;
      color: #b8c2d4;  /* readable mid-gray instead of near-invisible */
      margin: 0;
      line-height: 1.4;
    }
    .par-note-source-arrow {
      color: #ffd24a;
      margin-left: 3px;
      font-weight: 700;
    }

    /* ── Picks CTA ───────────────────────────────────────────────── */
    .par-cta {
      background: linear-gradient(155deg, rgba(255, 210, 74, 0.08), rgba(255, 210, 74, 0.02));
      border: 1px solid rgba(255, 210, 74, 0.25);
      padding: 18px;
      text-align: center;
    }
    .par-cta-eyebrow {
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.14em;
      color: #ffd24a;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .par-cta-title {
      font-size: 16px;
      font-weight: 700;
      color: var(--paper, #f5f5f7);
      margin: 0 0 4px;
      line-height: 1.3;
    }
    .par-cta-sub {
      font-size: 12px;
      color: var(--paper-subtle, rgba(245, 245, 247, 0.6));
      margin: 0 0 14px;
      line-height: 1.5;
    }
    .par-cta-btn {
      display: inline-block;
      padding: 10px 18px;
      background: linear-gradient(135deg, #ffd24a 0%, #f5b83c 100%);
      color: #0a1220;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      text-decoration: none;
      border-radius: 6px;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    .par-cta-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 20px rgba(255, 210, 74, 0.3);
    }

    /* ── Loading + empty ─────────────────────────────────────────── */
    .par-skel {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .par-skel-line {
      height: 14px;
      border-radius: 4px;
      background: linear-gradient(90deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.08) 50%, rgba(255, 255, 255, 0.04) 100%);
      background-size: 200% 100%;
      animation: par-shimmer 1.4s ease-in-out infinite;
    }
    @keyframes par-shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    .par-empty {
      font-size: 12px;
      color: var(--paper-subtle, rgba(245, 245, 247, 0.5));
      font-style: italic;
      padding: 10px 0;
    }

    /* Mobile — Top Headlines collapses but stays compact, model notes stay full */
    @media (max-width: 640px) {
      #pbe-article-rail { gap: 18px; }
      .par-card { padding: 14px 14px 12px; }
      .par-cta { padding: 16px; }
    }
    @media (prefers-reduced-motion: reduce) {
      .par-skel-line, .par-heading-pulse { animation: none; }
    }
  `
  document.head.appendChild(s)
}

/* ─────────────────────────────────────────────────────────────────────────
 * HELPERS
 * ────────────────────────────────────────────────────────────────────────*/
function escape(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c])
}

function relativeTime(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const days = Math.floor(hr / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function articleHref(article) {
  // Match the routing pattern article.js uses
  return article.url || `/news/${article.sport}/${article.slug}`
}

function topPropType(article) {
  const types = article.take?.prop_types
  if (!Array.isArray(types) || !types.length) return null
  return PROP_TYPE_LABELS[types[0]] || types[0].replace(/_/g, ' ')
}

/* ─────────────────────────────────────────────────────────────────────────
 * RENDERING
 * ────────────────────────────────────────────────────────────────────────*/
function renderHeadline(article) {
  const sport = (article.sport || '').toLowerCase()
  return `
    <a class="par-headline" href="${escape(articleHref(article))}">
      <div class="par-headline-meta">
        <span class="par-headline-sport">${escape(SPORT_LABELS[sport] || sport.toUpperCase())}</span>
        <span class="par-headline-dot">·</span>
        <span>${escape(relativeTime(article.published_at))}</span>
      </div>
      <h3 class="par-headline-title">${escape(article.title)}</h3>
    </a>
  `
}

function renderModelNote(article) {
  const advice = article.take?.advice
  if (!advice) return ''
  const sport = (article.sport || '').toLowerCase()
  const propType = topPropType(article)
  const impact = article.take?.impact_score

  return `
    <a class="par-note" href="${escape(articleHref(article))}">
      <div class="par-note-meta">
        <span class="par-note-tag">📊 Model</span>
        <span>${escape(SPORT_LABELS[sport] || sport.toUpperCase())}</span>
        ${propType ? `<span>·</span><span>${escape(propType)}</span>` : ''}
        ${impact ? `<span>·</span><span class="par-note-impact">Impact ${impact}/5</span>` : ''}
      </div>
      <p class="par-note-advice">${escape(advice)}</p>
      <p class="par-note-source">From: ${escape(article.title)}<span class="par-note-source-arrow">→</span></p>
    </a>
  `
}

function renderShellHTML() {
  return `
    <aside id="pbe-article-rail" role="complementary" aria-label="Related coverage and betting angles">

      <!-- Zone 1: Top Headlines -->
      <section class="par-card" id="par-headlines-card">
        <header class="par-heading">
          <h2 class="par-heading-title">Top Headlines</h2>
          <span class="par-heading-meta">
            <span class="par-heading-pulse"></span>Live
          </span>
        </header>
        <div class="par-headlines" id="par-headlines">
          <div class="par-skel">
            <div class="par-skel-line" style="width:30%"></div>
            <div class="par-skel-line" style="width:90%;height:18px"></div>
            <div class="par-skel-line" style="width:75%;height:18px"></div>
            <div class="par-skel-line" style="width:30%;margin-top:8px"></div>
            <div class="par-skel-line" style="width:85%;height:18px"></div>
            <div class="par-skel-line" style="width:70%;height:18px"></div>
          </div>
        </div>
      </section>

      <!-- Zone 2 + 3 wrapper, sticky on desktop -->
      <div class="par-sticky-wrap">
        <!-- Zone 2: Model Notes -->
        <section class="par-card par-sticky" id="par-notes-card">
          <header class="par-heading">
            <h2 class="par-heading-title">Model Notes</h2>
            <span class="par-heading-meta">Bettor Angles</span>
          </header>
          <div class="par-notes" id="par-notes">
            <div class="par-skel">
              <div class="par-skel-line" style="width:40%"></div>
              <div class="par-skel-line" style="width:90%;height:18px"></div>
              <div class="par-skel-line" style="width:70%;height:18px"></div>
            </div>
          </div>
        </section>

        <!-- Zone 3: Soft CTA -->
        <section class="par-card par-cta" id="par-cta-card">
          <div class="par-cta-eyebrow">⚡ Tonight's Slate</div>
          <h2 class="par-cta-title">See live MLB picks.</h2>
          <p class="par-cta-sub">The same model behind Model Notes grades picks against live odds, every night.</p>
          <a href="https://mlb.propbetedge.ai" class="par-cta-btn" target="_blank" rel="noopener">
            View tonight's picks →
          </a>
        </section>
      </div>
    </aside>
  `
}

/* ─────────────────────────────────────────────────────────────────────────
 * PUBLIC API
 * ────────────────────────────────────────────────────────────────────────*/

/**
 * Synchronous shell — drop into the article.js layout where the rail goes.
 * Renders skeleton placeholders. mountArticleRail() populates with live data.
 */
export function renderRailShell() {
  return renderShellHTML()
}

/**
 * Fetch + paint. Call once after the page renders.
 *
 * @param {object} opts
 * @param {string} opts.currentSlug  - the slug of the article being read (excluded from headlines)
 * @param {string} opts.currentSport - sport of the current article (used to bias model notes)
 */
export async function mountArticleRail({ currentSlug, currentSport } = {}) {
  injectStyles()

  // If shell isn't on the page, bail silently — nothing to populate
  if (!document.getElementById('pbe-article-rail')) return

  let articles = []
  try {
    const data = await api.homepage()
    articles = Array.isArray(data?.articles) ? data.articles : []
  } catch (err) {
    console.warn('[article-rail] api.homepage() failed:', err)
    paintEmpty('Headlines unavailable.', 'Model Notes unavailable.')
    return
  }

  // Exclude the article being read
  const others = articles.filter(a => a.slug !== currentSlug)

  // Top Headlines: latest 5 by published_at, mixed sports, current article excluded
  const headlines = [...others]
    .sort((a, b) => new Date(b.published_at) - new Date(a.published_at))
    .slice(0, 5)

  // Model Notes: any article where take.advice exists and impact >= 3.
  // Prefer the current sport but fall back to any sport if current sport is dry.
  const noteCandidates = others
    .filter(a => a.take?.advice && (a.take?.impact_score || 0) >= 3)
    .sort((a, b) => (b.take.impact_score || 0) - (a.take.impact_score || 0))

  const sameSportNotes = currentSport
    ? noteCandidates.filter(a => (a.sport || '').toLowerCase() === currentSport.toLowerCase())
    : []

  // Show 3 same-sport notes if available, else mix in others up to 3 total
  let notes = sameSportNotes.slice(0, 3)
  if (notes.length < 3) {
    const filler = noteCandidates.filter(a => !notes.includes(a)).slice(0, 3 - notes.length)
    notes = [...notes, ...filler]
  }

  paintHeadlines(headlines)
  paintNotes(notes)
}

function paintHeadlines(articles) {
  const target = document.getElementById('par-headlines')
  if (!target) return
  if (!articles.length) {
    target.innerHTML = '<p class="par-empty">No other headlines right now.</p>'
    return
  }
  target.innerHTML = articles.map(renderHeadline).join('')
}

function paintNotes(articles) {
  const target = document.getElementById('par-notes')
  if (!target) return
  if (!articles.length) {
    target.innerHTML = '<p class="par-empty">No model notes flagged yet — fresh takes drop hourly.</p>'
    return
  }
  target.innerHTML = articles.map(renderModelNote).join('')
}

function paintEmpty(headlinesMsg, notesMsg) {
  const h = document.getElementById('par-headlines')
  const n = document.getElementById('par-notes')
  if (h) h.innerHTML = `<p class="par-empty">${escape(headlinesMsg)}</p>`
  if (n) n.innerHTML = `<p class="par-empty">${escape(notesMsg)}</p>`
}
