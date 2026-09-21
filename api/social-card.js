/**
 * api/social-card.js
 *
 * PropBetEdge article social card — a real raster at a stable, public URL.
 *
 * Contract:
 *   GET /api/social-card?sport=nfl&slug=<article-slug>[&v=16x9|4x3|1x1]
 *   → image/png, 1200×630 by default, cacheable, never behind auth, never 404.
 *
 * The subject is chosen by the shared entity graph (share-image.js), so the
 * card always depicts this story's own photograph, player or team. It never
 * synthesises an athlete likeness and never borrows an unrelated player.
 *
 * Failure is not allowed to produce a broken preview: if the article or its
 * photograph cannot be fetched, the card degrades to the league treatment and
 * still returns 200.
 */

import { ImageResponse } from '@vercel/og';
import { buildEntityManifest } from '../src/entity-graph/manifest.js';
import { selectShareSubject, variantSize } from '../src/entity-graph/share-image.js';
import { SPORT_LABELS, SUPPORTED_SPORTS } from '../src/entity-graph/constants.js';

/*
 * Node runtime, deliberately.
 *
 * @vercel/og ships a ~1.5 MB resvg WASM binary. On the Edge runtime that sits
 * inside a hard bundle budget alongside the entity dictionary, and a bundle
 * that is a little too large fails at deploy time rather than in review. The
 * Node runtime has no such ceiling, and this endpoint is cached for a week —
 * only crawlers and social scrapers ever reach the function itself.
 */

const NEWS_API = 'https://propbet-news-api.sales-fd3.workers.dev';
const SITE = 'https://propbetedge.ai';

const INK = '#100e0a';
const INK_SOFT = '#1b1710';
const GOLD = '#d4af37';
const PAPER = '#f5f1eb';

const LEAGUE_ACCENT = {
  mlb: '#c8102e',
  nfl: '#1e6fbf',
  nba: '#c8562b',
  nhl: '#5f7f96',
};

/** Minimal element factory so this file needs no JSX toolchain. */
function h(type, props, ...children) {
  const flat = children.flat().filter((c) => c !== null && c !== undefined && c !== false);
  return { type, props: { ...(props || {}), ...(flat.length ? { children: flat.length === 1 ? flat[0] : flat } : {}) } };
}

export default async function handler(req, res) {
  const sport = String(req.query?.sport || '').toLowerCase();
  const slug = String(req.query?.slug || '').trim();
  const size = variantSize(String(req.query?.v || ''));

  const article = SUPPORTED_SPORTS.includes(sport) && slug
    ? await loadArticle(slug).catch(() => null)
    : null;

  const manifest = article ? buildEntityManifest(article) : null;
  const subject = article
    ? selectShareSubject(article, manifest)
    : { tier: 4, kind: 'league_card', image: null, player: null, team: null, sport };

  const headline = String(article?.title || `PropBetEdge ${SPORT_LABELS[sport] || 'Sports'}`).trim();
  const accent = LEAGUE_ACCENT[sport] || GOLD;

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const image = new ImageResponse(card({ headline, subject, sport, accent, size }), {
      width: size.width,
      height: size.height,
    });
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=604800, stale-while-revalidate=604800');
    res.setHeader('X-Pbe-Card-Tier', String(subject.tier));
    return res.status(200).send(Buffer.from(await image.arrayBuffer()));
  } catch (error) {
    // A card must never break a share. Fall back to the league treatment, and
    // still answer 200 — a social scraper does not retry a 500.
    console.warn('[social-card] render failed', error?.message || error);
    const fallback = new ImageResponse(
      card({ headline, subject: { ...subject, tier: 4, kind: 'league_card', image: null }, sport, accent, size }),
      { width: size.width, height: size.height },
    );
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600');
    res.setHeader('X-Pbe-Card-Tier', '4');
    return res.status(200).send(Buffer.from(await fallback.arrayBuffer()));
  }
}

async function loadArticle(slug) {
  const res = await fetch(`${NEWS_API}/news/article/${encodeURIComponent(slug)}`, {
    headers: { Accept: 'application/json', Origin: SITE, Referer: `${SITE}/news` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.article || null;
}

function card({ headline, subject, sport, accent, size }) {
  const label = SPORT_LABELS[sport] || 'SPORTS';
  const hasArt = Boolean(subject.image);
  const isPortrait = subject.kind === 'player_headshot';
  const isMark = subject.kind === 'team_mark';

  const entityLine = [
    subject.player?.name,
    subject.player?.team_name || subject.team?.name,
  ].filter(Boolean).join(' · ');

  return h('div', {
    style: {
      display: 'flex',
      width: '100%',
      height: '100%',
      position: 'relative',
      backgroundColor: INK,
      fontFamily: 'sans-serif',
    },
  },
    // Story art fills the frame; the text panel sits on a gradient over it.
    hasArt && h('div', {
      style: {
        display: 'flex',
        position: 'absolute',
        top: 0,
        right: 0,
        width: isPortrait || isMark ? '46%' : '62%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: INK_SOFT,
      },
    },
      h('img', {
        src: subject.image,
        style: isPortrait
          ? { width: '86%', height: '86%', objectFit: 'contain', objectPosition: 'bottom' }
          : isMark
            ? { width: '58%', height: '58%', objectFit: 'contain' }
            : { width: '100%', height: '100%', objectFit: 'cover' },
      }),
    ),

    // Left-to-right scrim so the headline stays legible over any photograph.
    hasArt && h('div', {
      style: {
        display: 'flex',
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundImage: `linear-gradient(90deg, ${INK} 34%, rgba(16,14,10,0.92) 48%, rgba(16,14,10,0.16) 78%, rgba(16,14,10,0.30) 100%)`,
      },
    }),

    !hasArt && h('div', {
      style: {
        display: 'flex',
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundImage: `radial-gradient(circle at 78% 22%, ${accent}33, transparent 58%), linear-gradient(140deg, ${INK_SOFT}, ${INK})`,
      },
    }),

    // Gold rule along the top edge — the PropBetEdge signature.
    h('div', {
      style: {
        display: 'flex',
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '8px',
        backgroundColor: GOLD,
      },
    }),

    h('div', {
      style: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        width: hasArt ? '62%' : '82%',
        height: '100%',
        padding: '58px 56px 50px 58px',
      },
    },
      h('div', { style: { display: 'flex', alignItems: 'center' } },
        h('div', {
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '9px 18px',
            borderRadius: '999px',
            backgroundColor: accent,
            color: PAPER,
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: '0.16em',
          },
        }, label),
      ),

      h('div', { style: { display: 'flex', flexDirection: 'column' } },
        h('div', {
          style: {
            display: 'flex',
            color: PAPER,
            fontSize: headlineSize(headline, size),
            fontWeight: 700,
            lineHeight: 1.12,
            letterSpacing: '-0.015em',
          },
        }, clamp(headline, 118)),

        entityLine && h('div', {
          style: {
            display: 'flex',
            marginTop: '22px',
            color: GOLD,
            fontSize: 26,
            fontWeight: 600,
            letterSpacing: '0.02em',
          },
        }, clamp(entityLine, 64)),
      ),

      h('div', { style: { display: 'flex', alignItems: 'center' } },
        h('div', {
          style: {
            display: 'flex',
            width: '34px',
            height: '4px',
            backgroundColor: GOLD,
            marginRight: '16px',
          },
        }),
        h('div', {
          style: {
            display: 'flex',
            color: PAPER,
            fontSize: 27,
            fontWeight: 700,
            letterSpacing: '0.06em',
          },
        }, 'PropBetEdge'),
      ),
    ),
  );
}

function headlineSize(headline, size) {
  const scale = size.height / 630;
  const length = headline.length;
  if (length > 96) return Math.round(42 * scale);
  if (length > 70) return Math.round(48 * scale);
  if (length > 46) return Math.round(55 * scale);
  return Math.round(62 * scale);
}

function clamp(value, max) {
  const text = String(value || '').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}
