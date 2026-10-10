/* PropBetEdge Global (Issue #67): checkout attribution, shared by the English
 * /pro page and the localized All Access pages.
 *
 * The approved mechanism (M1) appends two Stripe Payment Link URL parameters to
 * the SAME existing Payment Link, and nothing else:
 *   - `locale`              opens Stripe Checkout in the reader's language;
 *   - `client_reference_id` a non-personal tag, pbe-<lang>-pro[-<via>], copied by
 *                           Stripe onto the Checkout Session; reported only in
 *                           aggregate by docs/global/sigma/08_locale_attribution.sql.
 * Neither changes the price, product, tax, billing or any Stripe configuration.
 * Stripe accepts letters, digits, '-' and '_' (<= 200 chars) in client_reference_id.
 *
 * Pure module: no DOM, no network, no imports (pro-content.js and intl-pages.js
 * both import it, so it must not import either). */

/* Sources a sport site may name with ?via= (anything else is ignored). */
export const VIA = Object.freeze(['golf', 'mlb', 'f1', 'soccer', 'ufc', 'nba', 'nfl', 'nhl', 'wnba', 'tennis', 'members', 'predictions', 'news']);

/* Languages that have no public All Access page yet but whose readers are sent to
 * the English /pro with ?lang=<code>&via=<sport>. The English page keeps its copy;
 * only its checkout link gains the tag (and Checkout opens in that language). */
export const EN_PRO_ATTRIBUTION_LANGS = Object.freeze(['es']);

const TAG = /^[A-Za-z0-9_-]{1,200}$/;

export function viaFrom(search) {
  try {
    const v = new URLSearchParams(String(search || '')).get('via');
    return VIA.includes(v) ? v : null;
  } catch { return null; }
}

/** The attribution tag, or throws when it would be dropped by Stripe. */
export function clientReferenceId(lang, via = null) {
  const ref = `pbe-${lang}-pro${via ? `-${via}` : ''}`;
  if (!TAG.test(ref)) throw new Error(`invalid client_reference_id: ${ref}`);
  return ref;
}

/** The existing Payment Link with the checkout language and the attribution tag. */
export function attributedCheckoutUrl(baseUrl, lang, via = null) {
  return `${baseUrl}?locale=${lang}&client_reference_id=${clientReferenceId(lang, via)}`;
}

/** Attribution for the English /pro page: { lang, via } when the visitor arrived
 *  from a Spanish edition (?lang=es[&via=<sport>]), else null. Unknown values are
 *  ignored; nothing personal is ever read or written. */
export function enProAttributionFrom(search) {
  try {
    const q = new URLSearchParams(String(search || ''));
    const lang = q.get('lang');
    if (!EN_PRO_ATTRIBUTION_LANGS.includes(lang)) return null;
    return { lang, via: viaFrom(search) };
  } catch { return null; }
}
