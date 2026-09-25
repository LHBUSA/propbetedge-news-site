/**
 * src/entity-graph/text.js
 *
 * Text primitives for the PropBetEdge content graph. Pure, dependency-free and
 * identical on the edge and in the browser — every other module in the graph
 * normalizes through here so SSR and client resolution can never disagree.
 */

// Characters editors and wire services actually use for the same glyph.
const APOSTROPHES = "'‘’ʼ´`";
const HYPHENS = '-‐‑‒–—―−';

// Compiled once (normalizeName runs for every name in every index build).
const COMBINING = /[̀-ͯ]/g;
const APOSTROPHE_RE = new RegExp(`[${escapeClass(APOSTROPHES)}]`, 'g');
const HYPHEN_RE = new RegExp(`[${escapeClass(HYPHENS)}]`, 'g');
const PERIOD = /\./g;
const AMPERSAND = /&/g;
const NON_ALNUM = /[^a-z0-9]+/g;
const ASCII_ONLY = /^[\x20-\x7e]*$/;
// In pure ASCII: apostrophe, backtick and period are dropped; "-" becomes a
// separator, which NON_ALNUM already does.
const ASCII_DROP = /['`.]/g;

/**
 * Canonical matching key for a name. Punctuation is dissolved rather than
 * preserved so "A.J. Brown", "AJ Brown", "D'Angelo Russell", "DAngelo Russell"
 * and "Smith-Schuster" / "Smith Schuster" all converge.
 */
export function normalizeName(value) {
  const input = String(value || '');
  // Fast path for plain ASCII lower/upper-case names (the vast majority): no
  // Unicode normalization needed. Output is identical to the full path.
  if (ASCII_ONLY.test(input)) {
    return input
      .toLowerCase()
      .replace(ASCII_DROP, '')
      .replace(AMPERSAND, ' and ')
      .replace(NON_ALNUM, ' ')
      .trim();
  }
  return input
    .normalize('NFKD')
    .replace(COMBINING, '')
    .toLowerCase()
    .replace(APOSTROPHE_RE, '')
    .replace(PERIOD, '')
    .replace(HYPHEN_RE, ' ')
    .replace(AMPERSAND, ' and ')
    .replace(NON_ALNUM, ' ')
    .trim();
}

/** Route slug form. Must stay byte-identical to sport-config.js slugifyEntity. */
export function slugifyEntity(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function normalizeTokens(value) {
  const normalized = normalizeName(value);
  return normalized ? normalized.split(' ') : [];
}

/** Surname key used to index the roster without scanning every player. */
export function surnameKey(fullName) {
  const tokens = normalizeTokens(fullName);
  if (!tokens.length) return '';
  // Drop generational suffixes so "Ken Griffey Jr" keys on "griffey".
  const SUFFIX = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v']);
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (!SUFFIX.has(tokens[i])) return tokens[i];
  }
  return tokens[tokens.length - 1];
}

function escapeClass(chars) {
  return chars.replace(/[\\\]^-]/g, '\\$&');
}

export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build a regex source that matches how this name is actually written in copy:
 * straight or curly apostrophes (raw or HTML-escaped), any hyphen glyph,
 * optional periods after initials, and flexible spacing between tokens.
 */
export function nameMatchPattern(name) {
  const apostropheAlternatives = `(?:[${escapeClass(APOSTROPHES)}]|&(?:#39|#x27|apos|rsquo|lsquo);)`;
  const hyphenAlternatives = `(?:[${escapeClass(HYPHENS)}]|&(?:ndash|mdash|#8211|#8212);)`;

  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return null;

  const encodedParts = parts.map((part) => {
    let out = '';
    for (const char of part) {
      if (APOSTROPHES.includes(char)) out += `${apostropheAlternatives}?`;
      else if (HYPHENS.includes(char)) out += `${hyphenAlternatives}`;
      else if (char === '.') out += '\\.?\\s*';
      else if (char === '&') out += '(?:&amp;|&)';
      else out += escapeRegex(char);
    }
    return out;
  });

  return encodedParts.join('\\s+');
}

/**
 * Word boundaries that respect names rather than \b. A trailing apostrophe is
 * allowed through so "Mahomes' pass" still resolves to Mahomes, while
 * "Mahomesian" and "McMahomes" never match.
 */
export const LEADING_BOUNDARY = `(?<![A-Za-z0-9${escapeClass(APOSTROPHES)}${escapeClass(HYPHENS)}])`;
export const TRAILING_BOUNDARY = `(?![A-Za-z0-9]|${`[${escapeClass(HYPHENS)}]`}[A-Za-z])`;

/**
 * Generational suffixes, stripped when comparing two spellings of one person.
 */
export const NAME_SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v']);

/**
 * Team nicknames that are ordinary English often enough that a capitalized
 * occurrence is genuinely not a team reference: "heat check", "wild card",
 * "Magic Johnson", "storm the field", "the Stars aligned".
 *
 * A team on this list is still a first-class entity — it still gets its chip in
 * the In this story bar and its schema node. It simply never wins a bare
 * nickname link in body copy; it needs "Seattle Storm" or "Miami Heat".
 *
 * Measured against the live corpus: 58 of 86 team mentions are nickname-only,
 * so this list is kept deliberately tight rather than blanket-banning
 * nicknames, which would leave most stories with no team link at all.
 */
export const RISKY_TEAM_NICKNAMES = new Set([
  'heat', 'storm', 'wild', 'magic', 'jazz', 'thunder', 'lightning',
  'avalanche', 'stars', 'kings', 'capitals', 'nationals', 'angels',
  'senators', 'blues', 'flames', 'devils', 'suns', 'nets', 'bills',
  'giants', 'rangers', 'islanders', 'wizards', 'guardians', 'athletics',
]);
