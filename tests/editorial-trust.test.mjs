import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  AUTHOR_PROFILES,
  listNamedAuthors,
  listOperationalBylines,
} from '../src/editorial/authors-registry.js';
import { profilePageSchema } from '../src/schema.js';

const standards = fs.readFileSync(new URL('../src/pages/editorial-standards.js', import.meta.url), 'utf8');
const authorPage = fs.readFileSync(new URL('../src/pages/author.js', import.meta.url), 'utf8');
const authorsPage = fs.readFileSync(new URL('../src/pages/authors.js', import.meta.url), 'utf8');
const middleware = fs.readFileSync(new URL('../middleware.js', import.meta.url), 'utf8');

test('masthead separates named people from the operational newsroom byline', () => {
  assert.equal(listNamedAuthors().length, 3);
  assert.equal(listOperationalBylines().length, 1);
  assert.equal(AUTHOR_PROFILES['propbetedge-editorial-team'].kind, 'organization');
  assert.match(AUTHOR_PROFILES['propbetedge-editorial-team'].accountability, /not a human identity/i);
  for (const author of listNamedAuthors()) assert.equal(author.kind, 'person');
});

test('profile schema matches byline identity and NewsArticle author ids', () => {
  const justin = profilePageSchema('justin-erickson', AUTHOR_PROFILES['justin-erickson']);
  assert.equal(justin.mainEntity['@type'], 'Person');
  assert.equal(justin.mainEntity['@id'], 'https://propbetedge.ai/authors/justin-erickson#author');
  assert.equal(justin.mainEntity.worksFor['@id'], 'https://propbetedge.ai/#organization');

  const desk = profilePageSchema('propbetedge-editorial-team', AUTHOR_PROFILES['propbetedge-editorial-team']);
  assert.equal(desk.mainEntity['@type'], 'Organization');
  assert.equal(desk.mainEntity['@id'], 'https://propbetedge.ai/authors/propbetedge-editorial-team#author');
  assert.equal(desk.mainEntity.jobTitle, undefined);
});

test('editorial standards reflect the current network and transparent automation policy', () => {
  assert.match(standards, /MLB, NFL, NBA, WNBA, NHL, UFC, Tennis, Soccer, Golf and F1/);
  assert.match(standards, /operational newsroom byline, not a fictitious person/);
  assert.match(standards, /do <strong>not<\/strong> claim that a human manually writes or reviews every sentence/);
  assert.match(standards, /Founder-led analysis/);
  assert.match(standards, /every sentence was manually typed/);
  assert.match(standards, /Models are probabilistic/);
  assert.match(standards, /Publication timestamps/);
  assert.match(standards, /1-800-GAMBLER/);
  assert.match(standards, /October 4, 2026/);
  assert.doesNotMatch(standards, /all four major sports/i);
  assert.doesNotMatch(standards, /September 2, 2026/);
});

test('byline pages use the current homepage closer; Editorial Standards closes with accountability; none use the generic CTA', () => {
  for (const source of [authorPage, authorsPage]) assert.match(source, /renderHomeCloser\(\)/);
  assert.doesNotMatch(standards, /renderHomeCloser/, 'standards ends on accountability, not a sales closer');
  for (const source of [standards, authorPage, authorsPage]) assert.match(source, /renderFooter\(\{ cta: false \}\)/);
  assert.match(authorPage, /BYLINE ACCOUNTABILITY/);
  assert.match(authorsPage, /named contributors/i);
  assert.match(authorsPage, /operational bylines/i);
});

test('crawler-visible editorial pages use the canonical registry and SSR policy copy', () => {
  assert.match(middleware, /AUTHOR_PROFILES/);
  assert.match(middleware, /buildEditorialStandardsSchema/);
  assert.match(middleware, /buildServerEditorialStandardsHtml/);
  assert.match(middleware, /dateModified: '2026-10-04'/);
  assert.match(middleware, /operational newsroom byline, not a fictitious person/i);
  assert.match(middleware, /founder and CEO of PropTechUSA\.ai and founder and chief architect of PropBetEdge/i);
});

test('Justin Erickson profile reflects founder-led AI-native accountability', () => {
  const justin = AUTHOR_PROFILES['justin-erickson'];
  assert.equal(justin.role, 'Founder & CEO · Chief Architect');
  assert.match(justin.title, /Founder & CEO, PropTechUSA\.ai/);
  assert.match(justin.summary, /data infrastructure, APIs, models, editorial systems/i);
  assert.match(justin.bio, /not intended to make him look like a traditional beat writer/i);
  assert.match(justin.bio, /AI-native and engineering-led/i);
  assert.match(justin.accountability, /owns the thesis, editorial judgment and conclusions/i);
  assert.match(justin.accountability, /not a claim that every word was manually written/i);
});
