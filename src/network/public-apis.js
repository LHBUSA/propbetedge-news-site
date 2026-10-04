/**
 * Public / sellable PropTechUSA sports APIs — the one catalog for /developers and the footer (DOM-free).
 *
 * Inclusion rule (owner 2026-10-04): only products with a live public portal, documentation and a way to buy
 * access. Backend existence does not make something a public API: internal Workers, gateways and product
 * backends are never listed. Audited 2026-10-04 against the live portals:
 *   - propsports.proptechusa.ai  "PropSports Sports APIs" — docs, reference, pricing, flat monthly plans
 *   - ufc.proptechusa.ai         "UFC Intelligence API" — separate commercial product
 *   - RapidAPI listing           "PropBetEdge Sports News API"
 * No route counts here: they change; the portals carry the current numbers.
 */

export const API_CONTACT = 'sales@proptechusa.ai';

export const PUBLIC_APIS = Object.freeze([
  Object.freeze({
    key: 'propsports',
    name: 'PropSports API',
    footerLabel: 'PropSports API',
    href: 'https://propsports.proptechusa.ai',
    docs: 'https://propsports.proptechusa.ai/docs',
    reference: 'https://propsports.proptechusa.ai/reference',
    pricing: 'https://propsports.proptechusa.ai/pricing',
    summary: 'Sports data and intelligence on one API key: live game state, player and game intelligence, model outputs and historical context.',
    coverage: Object.freeze([
      ['MLB', 'https://propsports.proptechusa.ai/sports/mlb'],
      ['NFL', 'https://propsports.proptechusa.ai/sports/nfl'],
      ['NBA', 'https://propsports.proptechusa.ai/sports/nba'],
      ['WNBA', 'https://propsports.proptechusa.ai/sports/wnba'],
      ['NHL', 'https://propsports.proptechusa.ai/sports/nhl'],
      ['UFC', 'https://propsports.proptechusa.ai/sports/ufc'],
      ['Tennis', 'https://propsports.proptechusa.ai/sports/tennis'],
      ['Soccer', 'https://propsports.proptechusa.ai/sports/soccer'],
    ]),
    access: 'Flat monthly plans (single sport through all sports), no per-call fees.',
  }),
  Object.freeze({
    key: 'ufc',
    name: 'UFC Intelligence API',
    footerLabel: 'UFC Intelligence API',
    href: 'https://ufc.proptechusa.ai',
    docs: 'https://ufc.proptechusa.ai',
    summary: 'Fighter and matchup intelligence: Fight DNA, Matchup DNA, cards, rankings and fight records.',
    access: 'Commercial API with its own portal and documentation.',
  }),
  Object.freeze({
    key: 'news',
    name: 'PropBetEdge Sports News API',
    footerLabel: 'Sports News API',
    href: 'https://rapidapi.com/propdata-propdata-default/api/propbetedge-sports-news-api',
    docs: 'https://rapidapi.com/propdata-propdata-default/api/propbetedge-sports-news-api',
    summary: 'PropBetEdge newsroom content as structured data: articles, sports, entities and publication metadata.',
    access: 'Available on RapidAPI with its published plans.',
  }),
]);

export const API_DOCS_URL = PUBLIC_APIS[0].docs;
