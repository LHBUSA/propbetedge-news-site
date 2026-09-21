/**
 * src/entity-graph/linkify.js
 *
 * Deterministic entity linking inside article HTML.
 *
 * This is a tokenizer, not a regex sprayed over markup. It walks the document
 * as a stream of tags and text nodes and only ever rewrites text nodes, so:
 *   - attribute values (including image alt text) are structurally unreachable
 *   - anchors can never nest, because <a> opens a skip region
 *   - script/style/code/pre content is never touched
 *   - malformed output is not possible: every byte outside a matched name is
 *     re-emitted verbatim
 *
 * Linking policy:
 *   - first meaningful occurrence of each entity only
 *   - longest, left-most match wins
 *   - headings stay clean
 *   - hard cap per article, so a story never turns into a link farm
 */

import { nameMatchPattern, LEADING_BOUNDARY, TRAILING_BOUNDARY, escapeRegex } from './text.js';
import { linkSurfaces, surnameSurface } from './entities.js';

export const MAX_BODY_ENTITY_LINKS = 8;

/** Elements whose text content must never be linkified. */
const SKIP_ELEMENTS = new Set([
  'a', 'script', 'style', 'code', 'pre', 'textarea', 'select', 'option',
  'svg', 'math', 'iframe', 'noscript', 'figcaption', 'button', 'label',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
]);

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link',
  'meta', 'param', 'source', 'track', 'wbr',
]);

/**
 * @param {string} html            article body HTML
 * @param {object} manifest        entity manifest for this article
 * @param {object} [options]
 * @param {number} [options.maxLinks]
 * @param {string[]} [options.excludeUrls]  never link these (self-reference guard)
 * @returns {{ html: string, links: Array, count: number }}
 */
export function linkifyArticleHtml(html, manifest, options = {}) {
  const source = String(html || '');
  if (!source) return { html: '', links: [], count: 0 };

  const matchers = buildMatchers(manifest, options.excludeUrls || []);
  if (!matchers.length) return { html: source, links: [], count: 0 };

  const state = {
    linked: new Set(),
    remaining: Number.isFinite(options.maxLinks) ? options.maxLinks : MAX_BODY_ENTITY_LINKS,
    links: [],
  };

  const out = [];
  let skipDepth = 0;
  const openStack = [];
  let cursor = 0;

  const tagRe = /<!--[\s\S]*?-->|<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
  let match;

  while ((match = tagRe.exec(source)) !== null) {
    const textChunk = source.slice(cursor, match.index);
    out.push(skipDepth > 0 ? textChunk : linkifyTextNode(textChunk, matchers, state));
    cursor = match.index + match[0].length;

    const whole = match[0];
    out.push(whole);

    if (whole.startsWith('<!--')) continue;

    const tagName = String(match[1] || '').toLowerCase();
    const isClosing = whole.startsWith('</');
    const isSelfClosing = /\/\s*>$/.test(whole) || VOID_ELEMENTS.has(tagName);

    if (isClosing) {
      // Unwind to the matching open tag; ignore stray closers.
      const index = openStack.lastIndexOf(tagName);
      if (index !== -1) {
        for (let i = openStack.length - 1; i >= index; i--) {
          if (SKIP_ELEMENTS.has(openStack[i])) skipDepth = Math.max(0, skipDepth - 1);
        }
        openStack.length = index;
      }
    } else if (!isSelfClosing) {
      openStack.push(tagName);
      if (SKIP_ELEMENTS.has(tagName)) skipDepth += 1;
    }
  }

  const tail = source.slice(cursor);
  out.push(skipDepth > 0 ? tail : linkifyTextNode(tail, matchers, state));

  return { html: out.join(''), links: state.links, count: state.links.length };
}

/**
 * Build the match surfaces, longest first so "Toronto Blue Jays" always beats
 * a shorter overlapping surface and partial words can never match.
 */
function buildMatchers(manifest, excludeUrls) {
  const excluded = new Set(excludeUrls.map((u) => String(u).replace(/\/+$/, '')));
  const matchers = [];

  const push = (entity, surface, priority) => {
    if (!surface) return;
    const pattern = nameMatchPattern(surface);
    if (!pattern) return;
    matchers.push({
      key: `${entity.kind}:${entity.sport}:${entity.id}`,
      entity,
      surface,
      priority,
      length: surface.length,
      re: new RegExp(`${LEADING_BOUNDARY}(?:${pattern})${TRAILING_BOUNDARY}`, 'g'),
    });
  };

  for (const team of manifest?.teams || []) {
    if (excluded.has(String(team.canonical_url).replace(/\/+$/, ''))) continue;
    for (const surface of linkSurfaces({ ...team, kind: 'team', abbr: team.abbreviation })) {
      push(team, surface, 1);
    }
  }
  for (const player of manifest?.players || []) {
    if (excluded.has(String(player.canonical_url).replace(/\/+$/, ''))) continue;
    push(player, player.name, 0);
    const surname = surnameSurface({ ...player, kind: 'player' });
    if (surname && surname.toLowerCase() !== String(player.name).toLowerCase()) {
      push(player, surname, 2);
    }
  }

  // Longest surface first; ties resolved by priority so full names outrank
  // surname fallbacks, and players outrank teams on identical text.
  matchers.sort((a, b) => (b.length - a.length) || (a.priority - b.priority));
  return matchers;
}

function linkifyTextNode(text, matchers, state) {
  if (!text || state.remaining <= 0) return text;
  if (!/[A-Za-z]/.test(text)) return text;

  let out = '';
  let pos = 0;

  while (pos < text.length && state.remaining > 0) {
    let best = null;

    for (const matcher of matchers) {
      if (state.linked.has(matcher.key)) continue;
      matcher.re.lastIndex = pos;
      const hit = matcher.re.exec(text);
      if (!hit) continue;
      if (
        !best
        || hit.index < best.index
        || (hit.index === best.index && hit[0].length > best.matched.length)
      ) {
        best = { index: hit.index, matched: hit[0], matcher };
      }
    }

    if (!best) break;

    out += text.slice(pos, best.index);
    out += renderEntityAnchor(best.matcher.entity, best.matched);
    state.linked.add(best.matcher.key);
    state.remaining -= 1;
    state.links.push({
      kind: best.matcher.entity.kind,
      id: best.matcher.entity.id,
      name: best.matcher.entity.name,
      url: best.matcher.entity.canonical_url,
      path: best.matcher.entity.path,
      anchor_text: best.matched,
      surface: best.matcher.surface,
    });
    pos = best.index + best.matched.length;
  }

  return out + text.slice(pos);
}

/**
 * A plain, crawlable internal link. No nofollow, no target, descriptive anchor
 * text that is exactly the words the editor wrote.
 */
export function renderEntityAnchor(entity, anchorText) {
  const href = escapeAttribute(entity.path || entity.canonical_url);
  const kind = entity.kind === 'team' ? 'team' : 'player';
  return `<a href="${href}" class="pbe-entity-link pbe-entity-link--${kind}"`
    + ` data-entity-kind="${kind}" data-entity-id="${escapeAttribute(entity.id)}"`
    + ` data-entity-sport="${escapeAttribute(entity.sport)}">${anchorText}</a>`;
}

function escapeAttribute(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export { escapeRegex };
