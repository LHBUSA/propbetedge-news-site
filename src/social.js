/**
 * src/social.js
 * PropBetEdge's own social identity and the network share card. One place, so
 * the X account can never drift again (it pointed at an MLB-only alerts
 * account until 2026-09-26). Third-party X links (leagues, teams, players,
 * reporters, sources) do NOT belong here.
 */

export const PROPBETEDGE_X_URL = 'https://x.com/PROPBETEDGE';
export const PROPBETEDGE_X_HANDLE = '@PROPBETEDGE';

/* Network default share card: static 1200x630 RGB PNG rendered from
   scripts/og/network-card.html. Bump ?v= whenever the PNG changes so X,
   LinkedIn, Slack and Discord refetch instead of serving their cached copy. */
const NETWORK_CARD = 'https://propbetedge.ai/og/propbetedge-network-1200x630.png?v=20260926';
export const NETWORK_SOCIAL_IMAGE = Object.freeze({
  url: NETWORK_CARD,
  secure_url: NETWORK_CARD,
  type: 'image/png',
  width: 1200,
  height: 630,
  alt: 'PropBetEdge — The Sports Intelligence Network. Live data, Player DNA, PBEcast and predictive models across MLB, NFL, NBA, WNBA, NHL and UFC.',
});

/** X share-intent URL (never the profile URL) with encoded text and url. */
export function xShareUrl({ text = '', url = '' } = {}) {
  const intent = new URL('https://x.com/intent/post');
  if (text) intent.searchParams.set('text', String(text));
  if (url) intent.searchParams.set('url', String(url));
  return intent.toString();
}
