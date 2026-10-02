import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ownedImage, licensedImage, thirdPartyImage, compositeImage, imageObject, creatorTypeFor,
} from '../src/image-metadata.js';
import { buildArticleSeo } from '../src/entity-graph/article-seo.js';
import { organizationSchema, newsArticleSchema } from '../src/schema.js';
import { proJsonLd } from '../src/pro-seo.js';

const images = (node, out = []) => {
  if (Array.isArray(node)) node.forEach((n) => images(n, out));
  else if (node && typeof node === 'object') {
    if (node['@type'] === 'ImageObject') out.push(node);
    Object.values(node).forEach((v) => images(v, out));
  }
  return out;
};

test('owned art: PropBetEdge creator and copyright', () => {
  const node = imageObject(ownedImage({ url: 'https://propbetedge.ai/x.png', width: 1200, height: 630, year: '2026-10-02T00:00:00Z' }));
  assert.deepEqual(node.creator, { '@type': 'Organization', name: 'PropBetEdge' });
  assert.equal(node.copyrightNotice, '© 2026 PropBetEdge');
  assert.equal(node.contentUrl, 'https://propbetedge.ai/x.png');
  assert.equal(node.width, 1200);
});

test('Commons photo: the photographer, never PropBetEdge', () => {
  const node = imageObject(licensedImage({
    url: 'https://x/p.webp', author: 'Bryan Berlin', license: 'CC BY-SA 4.0',
    license_url: 'https://creativecommons.org/licenses/by-sa/4.0', source_page: 'https://commons.wikimedia.org/wiki/File:X.jpg',
  }));
  assert.deepEqual(node.creator, { '@type': 'Person', name: 'Bryan Berlin' });
  assert.equal(node.copyrightNotice, 'Bryan Berlin / CC BY-SA 4.0');
  assert.equal(node.license, 'https://creativecommons.org/licenses/by-sa/4.0');
  assert.equal(node.acquireLicensePage, 'https://commons.wikimedia.org/wiki/File:X.jpg');
  assert.equal(creatorTypeFor('Gamecock Central'), 'Organization');
  assert.equal(creatorTypeFor('BDZ Sports'), 'Organization');
  assert.equal(creatorTypeFor('Lorie Shaull'), 'Person');
  assert.equal(creatorTypeFor('Lorie Shaull from St Paul, United States'), 'Person');
  assert.equal(creatorTypeFor('John Mac'), 'Person');
});

test('licensed photo with no recorded author is held, not guessed', () => {
  const node = imageObject(licensedImage({ url: 'https://x/p.webp', license: 'CC BY 2.0' }));
  assert.equal(node.creator, undefined);
  assert.equal(node.copyrightNotice, undefined);
});

test('third-party pixels are never claimed and the host is never guessed', () => {
  const node = imageObject(thirdPartyImage({ url: 'https://a.espncdn.com/i/headshots/nfl/players/full/1.png' }));
  assert.equal(node.creator, undefined);
  assert.equal(node.copyrightNotice, undefined);
  assert.equal(node.creditText, undefined);
});

test('composite: owned parts → owned; licensed part credited; unknown part held', () => {
  const photo = licensedImage({ url: 'p', author: 'BDZ Sports', license: 'CC BY-SA 4.0', license_url: 'https://creativecommons.org/licenses/by-sa/4.0', source_page: 'https://commons.wikimedia.org/wiki/File:A.jpg' });
  const credited = imageObject(compositeImage({ url: 'c', year: 2026, parts: [photo] }));
  assert.equal(credited.creator.name, 'PropBetEdge');
  assert.equal(credited.copyrightNotice, '© 2026 PropBetEdge. Photo: BDZ Sports / CC BY-SA 4.0');
  assert.equal(credited.license, 'https://creativecommons.org/licenses/by-sa/4.0');
  const held = imageObject(compositeImage({ url: 'c', parts: [thirdPartyImage({ url: 'https://cbsistatic.com/getty.png' })] }));
  assert.equal(held.creator, undefined);
  assert.equal(held.copyrightNotice, undefined);
  assert.equal(imageObject(compositeImage({ url: 'c', parts: [] })).copyrightNotice, '© 2026 PropBetEdge');
});

test('article card: league card owned; photo/headshot/team-mark cards held', () => {
  const article = { sport: 'nfl', slug: 's', title: 'A story', published_at: '2026-10-02T12:00:00Z' };
  const league = images(buildArticleSeo(article, { players: [], teams: [], games: [] }).jsonLd);
  assert.equal(league.length, 4);
  for (const node of league) {
    assert.equal(node.creator.name, 'PropBetEdge');
    assert.equal(node.copyrightNotice, '© 2026 PropBetEdge');
  }
  const photo = images(buildArticleSeo({ ...article, image_url: 'https://a4.espncdn.com/photo.jpg' }, { players: [], teams: [], games: [] }).jsonLd);
  assert.equal(photo.length, 4);
  for (const node of photo) {
    assert.equal(node.creator, undefined);
    assert.equal(node.copyrightNotice, undefined);
    assert.ok(node.contentUrl.startsWith('https://propbetedge.ai/api/social-card'));
  }
});

test('site-level images: logo and All Access card are owned; legacy article photo held', () => {
  const logo = organizationSchema().logo;
  assert.equal(logo.copyrightNotice, '© 2026 PropBetEdge');
  assert.equal(logo['@id'], 'https://propbetedge.ai/#logo');
  const pro = images(proJsonLd());
  assert.equal(pro.length, 1);
  assert.equal(pro[0].creator.name, 'PropBetEdge');
  const legacy = newsArticleSchema({ title: 't', image_url: 'https://a.espncdn.com/x.jpg', published_at: '2026-10-01' }, 'nfl', 's').image;
  assert.equal(legacy.copyrightNotice, undefined);
});
