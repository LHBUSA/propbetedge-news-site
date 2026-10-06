/**
 * Promotional / advertising creative must never become editorial hero media (owner 2026-10-04: a Cowboys–Texans
 * story surfaced a Kalshi "promo code CBSSPORTS55" graphic as its hero, then the founder profile elevated it).
 *
 * DOM-free and dependency-free: the client article normalizer (src/api.js), the Edge crawler HTML (middleware.js)
 * and the newsroom enrich Worker's copy of this rule all ask the same question. A rejected image is treated
 * exactly like a missing one (media-backfill / sport fallback), never replaced with a guess.
 *
 * Signals are deliberately specific — offer language in the image URL, or an affiliate promo page as the image's
 * source — so ordinary game photography from the same publishers passes.
 */

const OFFER = /(promo[-_ ]?code|bonus[-_ ]?bets?|sign[-_ ]?up[-_ ]?bonus|deposit[-_ ]?match|risk[-_ ]?free[-_ ]?bet|no[-_ ]?sweat|bet[-_ ]?\d+[-_ ]?get[-_ ]?\d+|get[-_ ]?\$?\d+[-_ ]?(in[-_ ]?)?bonus|odds[-_ ]?boost[-_ ]?promo|sponsored|advertorial)/i;
const BOOK_OFFER = /(draftkings|fanduel|betmgm|caesars|bet365|fanatics|espn[-_ ]?bet|hard[-_ ]?rock[-_ ]?bet|betrivers|prizepicks|underdog|kalshi|polymarket|novig|sleeper)[-_ ]?(promo|bonus|offer|code|referral)/i;
// Affiliate promo pages on publisher sites (the source the image was scraped from).
const PROMO_SOURCE = /\/(betting|prediction|picks)\/news\/[^/?#]*(promo[-_]?code|bonus|use-[a-z0-9-]+-promo)/i;

export function isPromotionalImageUrl(url) {
  if (!url) return false;
  let s = String(url);
  try { s = decodeURIComponent(s); } catch { /* keep raw */ }
  return OFFER.test(s) || BOOK_OFFER.test(s);
}

export function isPromotionalSourceUrl(url) {
  return !!url && PROMO_SOURCE.test(String(url));
}

// SOURCE QUALITY GATE (owner 2026-10-06): a sportsbook / prediction-market promo or affiliate page is never a news
// source. 2026-10-06 MLB: "use-draftkings-promo-code-to-claim-150-bonus-bets-braves-dodgers..." and "use-betmgm-bonus-
// code-cbssports..." pages were rewritten into normal-looking Braves-Dodgers analysis. Strong offer language only:
// a plain "signing bonus" / "bonus" in contract news, or an ordinary betting picks/odds column, is not promotional.
const SOURCE_OFFER = /(promo[-_ ]?codes?|bonus[-_ ]?codes?|bonus[-_ ]?bets?|sign[-_ ]?up[-_ ]?(bonus|offer|promo)|deposit[-_ ]?match|first[-_ ]?bet[-_ ]?(offer|insurance|safety[-_ ]?net)|no[-_ ]?sweat[-_ ]?bets?|risk[-_ ]?free[-_ ]?bets?|bet[-_ ]?\$?\d+[-_ ,]*get[-_ ]?\$?\d+|referral[-_ ]?code)/i;
// Affiliate landing sections (path segments), e.g. /sportsbooks/promos/, /betting-promos/, /sportsbook-reviews/.
const AFFILIATE_PATH = /\/(promo[-_]?codes?|promos|bonus[-_]?codes?|betting[-_]?promos?|sportsbook[-_]?(promos?|bonus(es)?|reviews?|offers?))(\/|$)/i;

/** Why an article's SOURCE is promotional/affiliate (the gate reason), else null. Looks at the source URL and the
 *  source's own headline; the image is judged separately (isPromotionalHero). */
export function promotionalSourceReason(article) {
  const url = String(article?.source_url || '');
  let path = url;
  try { path = decodeURIComponent(new URL(url).pathname); } catch { /* keep raw */ }
  if (url && (PROMO_SOURCE.test(url) || SOURCE_OFFER.test(path) || BOOK_OFFER.test(path) || AFFILIATE_PATH.test(path))) return 'PROMOTIONAL_SOURCE';
  const head = String(article?.source_title || '');
  if (head && (SOURCE_OFFER.test(head) || BOOK_OFFER.test(head))) return 'PROMOTIONAL_SOURCE';
  return null;
}

export const isPromotionalSource = (article) => promotionalSourceReason(article) !== null;

// Publisher family of a host: publishers serve page images from their own CDNs (cbssports.com -> cbsistatic.com).
const FAMILY = [[/(^|\.)cbs(sports|istatic)\.com$/, 'cbs'], [/(^|\.)nbcsports(\.brightspotcdn)?\.com$/, 'nbcsports'], [/(^|\.)espn(cdn)?\.com$/, 'espn'], [/(^|\.)foxsports\.com$|(^|\.)fssta\.com$/, 'fox'], [/(^|\.)yahoo\.com$|(^|\.)yimg\.com$/, 'yahoo']];
export function publisherFamily(url) {
  let host = '';
  try { host = new URL(String(url)).hostname.toLowerCase(); } catch { return null; }
  for (const [re, fam] of FAMILY) if (re.test(host)) return fam;
  return host.split('.').slice(-2).join('.');
}

/** An article's hero is promotional creative when the image itself carries offer language, or when the image was
 *  taken from an affiliate promo page (same publisher as the promo source_url). A replacement image from another
 *  publisher on an article whose source was a promo page is not promotional creative. */
export function isPromotionalHero(article) {
  if (!article?.image_url) return false;
  if (isPromotionalImageUrl(article.image_url)) return true;
  if (!isPromotionalSourceUrl(article.source_url)) return false;
  const img = publisherFamily(article.image_url);
  return !!img && img === publisherFamily(article.source_url);
}
