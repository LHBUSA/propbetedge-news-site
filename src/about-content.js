/**
 * /about model — composed ONLY from canonical sources (owner 2026-10-04: About kept going stale because it owned
 * its own hardcoded sport list and product copy). DOM-free: the client page (src/pages/about.js) and the Edge
 * crawler HTML (middleware.js) both render this, so they cannot drift.
 *
 *   network membership + order + URLs  src/network/family.json
 *   per-sport capability lines          src/pro-content.js SPORTS[].edge (the /pro truth)
 *   Predictions, All Access, upcoming   src/pro-content.js PREDICTIONS / ALL_ACCESS / UPCOMING_SPORTS
 *   operating loop                      src/pro-content.js OPERATING_SYSTEM_STAGES (+ Publish from research)
 *   newsrooms                           src/intelligence-cta.js INTELLIGENCE_SPORTS[].newsPath
 *
 * About may add presentation copy (headlines, the company-architecture explanation, the trust summary); it must
 * never add or describe a sport/product that the registries do not.
 */

import FAMILY from './network/family.json' with { type: 'json' };
import { SPORTS as PRO_SPORTS, PREDICTIONS, ALL_ACCESS, UPCOMING_SPORTS, OPERATING_SYSTEM_STAGES } from './pro-content.js';
import { INTELLIGENCE_SPORTS } from './intelligence-cta.js';
import { researchPage } from './research/registry.js';

const proByKey = new Map(PRO_SPORTS.map((s) => [s.key, s]));

export function aboutModel() {
  const sports = FAMILY.sports.map((s) => {
    const pro = proByKey.get(s.key);
    if (!pro) throw new Error(`about: no /pro capability line for family sport ${s.key}`);
    return { key: s.key, label: s.label, url: s.url, glyph: pro.glyph, line: pro.edge, newsPath: INTELLIGENCE_SPORTS[s.key]?.newsPath || null };
  });
  const publish = researchPage('/research/intelligence-systems').sections.find((x) => x.id === 'loop').steps.find(([k]) => k === 'Publish');
  return {
    sports,
    sportCount: sports.length,
    predictions: { name: PREDICTIONS.name, url: `${PREDICTIONS.url}/`, tagline: PREDICTIONS.tagline, line: PREDICTIONS.edge },
    allAccess: { name: ALL_ACCESS.name, price: `$${ALL_ACCESS.priceUsd}/${ALL_ACCESS.interval}`, href: '/pro' },
    upcoming: UPCOMING_SPORTS.map((u) => ({ label: u.label, eta: u.eta, line: u.edge })),
    stages: [...OPERATING_SYSTEM_STAGES.map((s) => ({ label: s.label, title: s.title, body: s.body })), { label: 'Publish', title: 'Connect the work to the evidence', body: publish[1] }],
    layers: [
      { name: 'PropBetEdge', role: 'The customer-facing intelligence and publication layer: ten sport products, PropBetEdge Predictions, the newsroom and All Access.' },
      { name: 'PropSports', role: 'The sports-data infrastructure layer that feeds parts of the network — canonical data, live state and the commercial sports APIs.' },
      { name: 'PropTechUSA.ai', role: 'The parent engineering organization that builds and operates the platforms.' },
    ],
    trust: [
      'Evidence is preserved.',
      'Research is labeled.',
      'Official model calls are frozen before outcomes.',
      'Missing data remains missing.',
      'Editorial judgment and automation are disclosed.',
      'Historical records are not rewritten after results.',
    ],
  };
}

export const ABOUT_META = Object.freeze({
  title: 'About PropBetEdge — The Sports Intelligence Network',
  description: 'PropBetEdge is a connected sports intelligence operating system: ten live sport intelligence products, PropBetEdge Predictions, a newsroom and permanent model records, built on the PropSports data platform.',
});
