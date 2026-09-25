/**
 * src/search/documents.js — builders that turn our own data sources into
 * compact search documents.
 *
 * Pure: every builder takes already-fetched data and returns docs, so the
 * Worker, the tests and any rebuild script share one implementation and the
 * tests can run on captured fixtures with no network.
 *
 * Sources (all public, keyless, already used by our own sites):
 *   MLB / NFL / NBA / NHL players + teams  src/entity-graph dictionary (the identity spine)
 *   WNBA players + teams                   wnba-api /v1/players (owned Worker behind wnba.propbetedge.ai)
 *   UFC fighters / events / fights         ufc.propbetedge.ai sitemaps (canonical URLs by construction)
 *   News stories                           propbet-news-api /news (the corpus the site renders)
 */

import { normalizeQuery } from './rank.js';
import { teamDoc } from './destinations.js';

const SITE = 'https://propbetedge.ai';
const UFC = 'https://ufc.propbetedge.ai';
const WNBA = 'https://wnba.propbetedge.ai';

// ─── dictionary players (MLB, NFL, NBA, NHL) ────────────────────────────────

/**
 * @param players  entity-graph player entities (allPlayers(sport))
 * @param aliasesFor  playerNameAliases from the identity system
 */
export function dictionaryPlayerDocs(players, aliasesFor = () => []) {
  return players.map((p) => {
    const self = normalizeQuery(p.name);
    const aliases = (aliasesFor(p.name) || []).filter((a) => a && a !== self);
    return {
      type: 'player',
      sport: p.sport,
      id: String(p.id),
      title: p.name,
      subtitle: [p.team_name, p.position].filter(Boolean).join(' · '),
      href: p.path || `/player/${p.sport}/${p.id}`,
      image: p.image_url || null,
      aliases,
      keywords: [p.name, p.team_name, p.team_id, p.position].filter(Boolean),
      teamHref: p.team_url ? p.team_url.replace(SITE, '') : null,
    };
  });
}

// ─── WNBA (wnba-api) ────────────────────────────────────────────────────────

function absoluteWnbaAsset(url) {
  if (!url) return null;
  if (/^https:\/\//.test(url)) return url;
  if (url.startsWith('/')) return `${WNBA}${url}`;
  return null;
}

/** Docs from a wnba-api /v1/players payload ({ ok, data: { players, teams } }). */
export function wnbaDocsFromApi(payload) {
  const data = payload?.data || {};
  const rawPlayers = Array.isArray(data.players) ? data.players : [];
  // /v1/players reports `teams` as a count; the club records ride on each
  // player. Accept either shape.
  const teamById = new Map();
  for (const t of Array.isArray(data.teams) ? data.teams : []) if (t?.team_id) teamById.set(String(t.team_id), t);
  for (const p of rawPlayers) if (p?.team?.team_id && !teamById.has(String(p.team.team_id))) teamById.set(String(p.team.team_id), p.team);
  const teams = [...teamById.values()];
  const teamDocs = teams
    .filter((t) => t?.team_id && t?.name)
    .map((t) => teamDoc({
      sport: 'wnba',
      id: t.team_id,
      name: t.name,
      location: t.location,
      nickname: t.short_name,
      abbr: t.abbr,
      href: `${WNBA}/teams/${t.team_id}`,
      logo: t.abbr ? `https://a.espncdn.com/i/teamlogos/wnba/500/${String(t.abbr).toLowerCase()}.png` : null,
    }));
  const teamHrefById = new Map(teamDocs.map((d) => [d.id, d.href]));

  const players = rawPlayers
    .filter((p) => p?.athlete_id && p?.name)
    .map((p) => {
      const teamName = p.team?.name || null;
      const photo = p.photo || {};
      const image = absoluteWnbaAsset(photo.square) || absoluteWnbaAsset(photo.portrait) || null;
      return {
        type: 'player',
        sport: 'wnba',
        id: String(p.athlete_id),
        title: p.name,
        subtitle: [teamName, p.position].filter(Boolean).join(' · '),
        href: `${WNBA}/players/${p.athlete_id}`,
        image,
        aliases: [p.short_name].filter(Boolean),
        keywords: [p.name, teamName, p.team?.abbr, p.position_name].filter(Boolean),
        teamHref: p.team_id ? teamHrefById.get(String(p.team_id)) || null : null,
      };
    });
  return [...players, ...teamDocs];
}

// ─── UFC (ufc.propbetedge.ai sitemaps) ──────────────────────────────────────

const LOWER_PARTICLES = new Set(['da', 'das', 'de', 'del', 'della', 'di', 'do', 'dos', 'du', 'la', 'le', 'y', 'e']);
const ROMAN = new Set(['ii', 'iii', 'iv']);
const BROADCASTERS = { espn: 'ESPN', fox: 'Fox', fx: 'FX', abc: 'ABC', fuel: 'Fuel TV', versus: 'Versus', 'espn+': 'ESPN+' };

function capitalizeToken(token, index, count) {
  if (!token) return token;
  if (ROMAN.has(token)) return token.toUpperCase();
  if (token === 'jr' || token === 'sr') return `${token[0].toUpperCase()}${token[1]}.`;
  if (token === 'vs') return 'vs';
  if (index > 0 && index < count - 1 && LOWER_PARTICLES.has(token)) return token;
  if (/^mc[a-z]{2,}/.test(token)) return `Mc${token[2].toUpperCase()}${token.slice(3)}`;
  return token[0].toUpperCase() + token.slice(1);
}

export function titleFromSlugTokens(tokens) {
  return tokens.map((t, i) => capitalizeToken(t, i, tokens.length)).join(' ');
}

/** "alexandre-pantoja-2560746" -> { name: "Alexandre Pantoja" } */
export function fighterNameFromSlug(slug) {
  const clean = String(slug || '').replace(/-(?:\d{3,}|[0-9a-f]{12,})$/, '');
  const tokens = clean.split('-').filter(Boolean);
  return titleFromSlugTokens(tokens);
}

function splitDate(slug) {
  const m = String(slug || '').match(/^(.*)-(\d{4}-\d{2}-\d{2})$/);
  return m ? { base: m[1], date: m[2] } : { base: String(slug || ''), date: null };
}

/** "ufc-320-ankalaev-vs-pereira-2" -> "UFC 320: Ankalaev vs Pereira 2" */
export function eventTitleFromSlug(base) {
  const tok = (s) => titleFromSlugTokens(String(s || '').split('-').filter(Boolean));
  let m = base.match(/^ufc-(\d+)(?:-(.+))?$/);
  if (m) return { title: `UFC ${m[1]}${m[2] ? `: ${tok(m[2])}` : ''}`, number: m[1] };
  m = base.match(/^ufc-fight-night(?:-(.+))?$/);
  if (m) return { title: `UFC Fight Night${m[1] ? `: ${tok(m[1])}` : ''}` };
  m = base.match(/^ufc-on-([a-z]+)(?:-(\d+))?(?:-(.+))?$/);
  if (m && BROADCASTERS[m[1]]) {
    return { title: `UFC on ${BROADCASTERS[m[1]]}${m[2] ? ` ${m[2]}` : ''}${m[3] ? `: ${tok(m[3])}` : ''}` };
  }
  m = base.match(/^the-ultimate-fighter-(.+)$/);
  if (m) return { title: `The Ultimate Fighter: ${tok(m[1])}` };
  return { title: tok(base).replace(/^Ufc\b/, 'UFC') };
}

export function locsFromSitemap(xml) {
  const out = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/g;
  let m;
  while ((m = re.exec(String(xml || '')))) out.push(m[1]);
  return out;
}

/**
 * Docs from the UFC site's own sitemaps.
 *   fighters: fighter URLs (every fighter page)
 *   events:   event URLs (full archive + announced cards)
 *   fights:   fight URLs — only recent + upcoming bouts are indexed
 * @param now  epoch ms (fight recency window is measured against it)
 */
export function ufcDocsFromSitemaps({ fighters = [], events = [], fights = [] }, { now = Date.now(), fightWindowDays = 450 } = {}) {
  const docs = [];
  const seen = new Set();
  const push = (doc) => {
    const key = `${doc.type}|${doc.href}`;
    if (seen.has(key)) return;
    seen.add(key);
    docs.push(doc);
  };

  for (const url of fighters) {
    const m = String(url).match(/\/fighters\/([a-z0-9-]+)$/);
    if (!m) continue;
    const slug = m[1];
    const name = fighterNameFromSlug(slug);
    if (!name) continue;
    push({
      type: 'player',
      sport: 'ufc',
      id: slug,
      title: name,
      subtitle: 'Fighter profile · Fight DNA',
      href: `${UFC}/fighters/${slug}`,
      image: null,
      aliases: [],
      keywords: [name, 'fighter', 'mma'],
    });
  }

  const eventBases = new Map();
  for (const url of events) {
    const m = String(url).match(/\/events\/([a-z0-9-]+)$/);
    if (!m) continue;
    const slug = m[1];
    const { base, date } = splitDate(slug);
    const { title, number } = eventTitleFromSlug(base);
    eventBases.set(base, { slug, title, date });
    push({
      type: 'event',
      kind: 'event',
      sport: 'ufc',
      id: slug,
      title,
      subtitle: 'Fight card',
      href: `${UFC}/events/${slug}`,
      image: null,
      date: date ? `${date}T00:00:00Z` : null,
      aliases: number ? [`ufc ${number}`] : [],
      keywords: ['ufc', 'card', 'event'],
    });
  }

  const windowStart = now - fightWindowDays * 86_400_000;
  for (const url of fights) {
    const m = String(url).match(/\/fights\/([a-z0-9-]+)$/);
    if (!m) continue;
    const slug = m[1];
    const { base, date } = splitDate(slug);
    if (!date) continue;
    const time = Date.parse(`${date}T00:00:00Z`);
    if (!Number.isFinite(time) || time < windowStart) continue;

    // The fight slug is "<a>-vs-<b>-<event slug without date>". Peel the
    // event off using the event archive so a "-vs-" inside the event name
    // cannot be mistaken for the bout.
    let event = null;
    let pair = base;
    for (const [eventBase, info] of eventBases) {
      if (info.date === date && base.endsWith(`-${eventBase}`)) {
        event = info;
        pair = base.slice(0, base.length - eventBase.length - 1);
        break;
      }
    }
    const parts = pair.split('-vs-');
    if (parts.length !== 2) continue;
    const a = titleFromSlugTokens(parts[0].split('-'));
    const b = titleFromSlugTokens(parts[1].split('-'));
    push({
      type: 'event',
      kind: 'fight',
      sport: 'ufc',
      id: slug,
      title: `${a} vs ${b}`,
      subtitle: event ? event.title : 'UFC bout',
      href: `${UFC}/fights/${slug}`,
      image: null,
      date: `${date}T00:00:00Z`,
      aliases: [`${b} vs ${a}`],
      keywords: event ? [event.title, 'fight'] : ['fight'],
      // Bouts support their fighters and cards; they should not outrank them.
      boost: -30,
    });
  }
  return docs;
}

// ─── stories (propbet-news-api) ─────────────────────────────────────────────

/**
 * Compact stored form of one story: [id, sport, title, path, published_at,
 * category, players[], teams[]]. ~200 bytes, so the whole corpus fits in a
 * handful of KV values.
 */
export function compactStory(article) {
  if (!article?.id || !article?.title || !article?.slug) return null;
  const sport = String(article.sport || '').toLowerCase();
  let path = `/news/${sport}/${article.slug}`;
  if (typeof article.url === 'string') {
    try {
      const u = new URL(article.url);
      if (u.hostname === 'propbetedge.ai' || u.hostname === 'www.propbetedge.ai') path = u.pathname;
      else if (u.hostname.endsWith('.propbetedge.ai')) path = u.href;
    } catch { /* keep the constructed path */ }
  }
  const take = article.take || {};
  return [
    String(article.id),
    sport,
    String(article.title).slice(0, 220),
    path,
    article.published_at || null,
    article.category || null,
    (Array.isArray(take.players) ? take.players : []).slice(0, 8).map(String),
    (Array.isArray(take.teams) ? take.teams : []).slice(0, 6).map(String),
  ];
}

export function storyDoc(row) {
  const [id, sport, title, path, publishedAt, category, players = [], teams = []] = row;
  return {
    type: 'story',
    sport: sport || null,
    id,
    title,
    subtitle: category ? String(category).replace(/[_-]+/g, ' ') : '',
    href: path,
    image: null,
    date: publishedAt,
    aliases: [...players, ...teams],
    keywords: [...players, ...teams, category].filter(Boolean),
  };
}
