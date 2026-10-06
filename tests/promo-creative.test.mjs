// Promotional / advertising creative never becomes editorial hero media (owner 2026-10-04). Real URLs from the
// 2026-10-04 NFL newsroom: the rejected ones are offer creative, the allowed ones ordinary game photography.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isPromotionalImageUrl, isPromotionalSourceUrl, isPromotionalHero } from '../src/editorial/promo-creative.js';

const KALSHI = 'https://sportshub.cbsistatic.com/i/r/2026/09/29/a90f0e22-5b54-4b88-8257-901a4e7cd93f/thumbnail/1200x675/115d1d08dab649b793e6d60efcb87b70/kalshi-promo-code-cbssports55.jpg';
const DK = 'https://sportshub.cbsistatic.com/i/2026/07/26/f6e09138-10e1-46d1-8a69-6cb1358224dd/draftkings-bet-5-get-150.jpg';
const FD_SRC = 'https://www.cbssports.com/betting/news/use-fanduel-promo-code-to-get-250-bonus-bets-cowboys-texans-chiefs-raiders-nfl-week-4/';
const FD_IMG = 'https://sportshub.cbsistatic.com/i/2026/09/20/d13a1e29-7c4b-469e-9dbb-b5c7e26a2c57/1920x1080.jpg';
const KALSHI_SRC = 'https://www.cbssports.com/prediction/news/kalshi-promo-code-cbssports55-texas-get-55-bonus-cowboys-texans-nfl-week-4-predictions/';
const ESPN_COLLINS = 'https://a3.espncdn.com/combiner/i?img=%2Fphoto%2F2024%2F1112%2Fr1413853_1296x729_16%2D9.jpg';

test('offer creative in the image URL is rejected', () => {
  assert.equal(isPromotionalImageUrl(KALSHI), true);
  assert.equal(isPromotionalImageUrl(DK), true);
  assert.equal(isPromotionalHero({ image_url: KALSHI, source_url: KALSHI_SRC }), true);
});

test('an image scraped from an affiliate promo page (same publisher) is rejected', () => {
  assert.equal(isPromotionalSourceUrl(FD_SRC), true);
  assert.equal(isPromotionalHero({ image_url: FD_IMG, source_url: FD_SRC }), true);
});

test('ordinary game photography passes, including a replacement image on an article whose source was a promo page', () => {
  for (const img of [
    'https://sportshub.cbsistatic.com/i/2026/10/04/42c01e15-c4ea-4b6d-8685-34cae0d0f595/lamb.jpg',
    'https://nbcsports.brightspotcdn.com/dims4/default/6091cb4/2147483647/strip/false/crop/4629x2604+0+0/resize/1920x1080!/quality/90/?url=https%3A%2F%2Fnbc-sports-production-nbc-sports.s3.us-east-1.amazonaws.com%2Fbrightspot%2Fe7%2Fba%2F215b298045c18162ce2f21cddf45%2F2298565060.jpg',
    'https://cdn.profootballrumors.com/files/2026/10/2025-12-04T060851Z_1527526618_MT1USATODAY27736082_RTRMADP_3_NFL-BUFFALO-BILLS-AT-PITTSBURGH-STEELERS-1024x683.jpg',
    ESPN_COLLINS,
  ]) assert.equal(isPromotionalImageUrl(img), false, img);
  assert.equal(isPromotionalHero({ image_url: 'https://sportshub.cbsistatic.com/i/2026/10/04/x/lamb.jpg', source_url: 'https://www.cbssports.com/nfl/news/ceedee-lamb-stats-cowboys-record-texans/' }), false);
  assert.equal(isPromotionalHero({ image_url: ESPN_COLLINS, source_url: KALSHI_SRC }), false, 'the 2026-10-04 replacement hero stays');
});

test('wired where articles enter the site: client normalizer and the Edge crawler HTML', () => {
  const api = fs.readFileSync(new URL('../src/api.js', import.meta.url), 'utf8');
  assert.match(api, /if \(isPromotionalHero\(article\)\) return \{ \.\.\.article, image_url: null, _image_url_rejected: 'promotional_creative' \};/);
  const mw = fs.readFileSync(new URL('../middleware.js', import.meta.url), 'utf8');
  assert.match(mw, /const article = withoutPromotionalHero\(applyArticlePublicationPolicy\(data\.article\)\);/);
  assert.match(mw, /pool\.push\(withoutPromotionalHero\(row\)\);/);
  assert.match(mw, /filterPublicArticles\(data\?\.articles \|\| \[\]\)\.map\(withoutPromotionalHero\)/);
});

test('canonical rule is hash-pinned: the newsroom enrich Worker vendors this exact file', async () => {
  // propbetedge-workers workers/propbet-news-enrich/src/promo-creative.js is a byte-identical copy (its own test pins
  // the same hash). Changing this file means: re-vendor into the Worker, update both pins, redeploy propbet-news-enrich.
  const { createHash } = await import('node:crypto');
  const sha = createHash('sha256').update(fs.readFileSync(new URL('../src/editorial/promo-creative.js', import.meta.url))).digest('hex');
  assert.equal(sha, '7992c8f08fec487d5740b8cae9439fb986347dca3e72f2b55e4af01b89c54564');
});
