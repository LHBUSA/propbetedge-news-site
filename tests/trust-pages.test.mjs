import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const router=fs.readFileSync(new URL('../src/router.js',import.meta.url),'utf8');
const page=fs.readFileSync(new URL('../src/pages/trust.js',import.meta.url),'utf8');
const sitemap=fs.readFileSync(new URL('../api/sitemap.js',import.meta.url),'utf8');
const { renderFooter } = await import('../src/components/footer.js');
const footer=renderFooter({ cta: false });
const robots=fs.readFileSync(new URL('../api/robots.js',import.meta.url),'utf8');

test('brand trust routes are canonical and discoverable',()=>{
 for(const p of ['privacy','terms','legal','support','media']){
  assert.ok(router.includes(`path === '/${p}'`));
  assert.ok(page.includes(`  ${p}: {`), `trust.js defines the ${p} page`);
  assert.match(page, new RegExp(`\\[[^\\]]*'${p}'[^\\]]*\\]\\.map\\(\\(key\\) => \`<a href="/\\$\\{key\\}"`), `trust tabs link /${p}`);
  assert.ok(sitemap.includes(`'/${p}'`));
  assert.ok(footer.includes(`href="/${p}"`));
 }
 assert.ok(page.includes('support@proptechusa.ai'));
 assert.ok(page.includes('press@proptechusa.ai'));
 assert.ok(page.includes('editorial@proptechusa.ai'));
});

test('terms clearly prohibit unauthorized scraping and AI training',()=>{
 assert.match(page,/No scraping, crawling or unauthorized automated access/);
 assert.match(page,/Automated extraction is not permitted/);
 assert.match(page,/Search indexing is allowed; AI training and dataset extraction are not/);
 assert.match(page,/train or fine-tune a generative-AI or machine-learning model/);
 assert.match(page,/Local Home Buyers LLC d\/b\/a PropTechUSA\.ai/);
 assert.match(page,/Ramsey County, Minnesota/);
});

test('trust pages use the current homepage closer instead of stale generic footer CTA',()=>{
 assert.match(page,/renderHomeCloser\(\)/);
 assert.match(page,/renderFooter\(\{ cta: false \}\)/);
});

test('robots keeps discovery crawlers open while training crawlers are blocked',()=>{
 for(const bot of ['Googlebot','Googlebot-News','Bingbot','OAI-SearchBot','Claude-SearchBot']){
   assert.ok(robots.includes(`'User-agent: ${bot}'`), `${bot} has an explicit discovery rule`);
 }
 for(const bot of ['GPTBot','ClaudeBot','Google-Extended','CCBot','Bytespider','meta-externalagent','Applebot-Extended']){
   const block=new RegExp(`User-agent: ${bot}[\\s\\S]{0,100}Disallow: /`);
   assert.match(robots,block,`${bot} is blocked from model-development crawling`);
 }
 assert.match(robots,/User-agent: \*'[\s\S]*Allow: \/'[\s\S]*Disallow: \/api\//);
});

test('privacy is a dedicated PropBetEdge policy, distinct from sports data and model records',()=>{
 assert.match(page,/ {2}privacy: \{\s+title: 'Privacy Policy — PropBetEdge'/);
 assert.match(page,/sports data shown in the product/);
 assert.match(page,/prediction, model and market records/);
 assert.match(page,/We do not sell personal information/);
 for(const s of ['Information we collect','How we use information','Subscriptions and billing','Service providers','Analytics, cookies and browser storage','Security','Retention','Your choices and rights','Children','Changes to this policy','Contact']) assert.ok(page.includes(`<h2>${s}</h2>`),s);
 assert.match(page,/<a href="\/privacy">PropBetEdge Privacy Policy<\/a>/,'legal points to the PropBetEdge policy');
 assert.doesNotMatch(page,/https:\/\/proptechusa\.ai\/privacy/,'no longer delegates to the PropTechUSA policy');
 const mw=fs.readFileSync(new URL('../middleware.js',import.meta.url),'utf8');
 assert.match(mw,/'\/privacy': \['Privacy Policy — PropBetEdge'/);
});

test('legal protections on /terms and /legal are unchanged by the privacy release',()=>{
 for(const h of ['Ownership and protected material','Automated access and crawler policy','AI and machine-learning use','Copyright and rights concerns','Security reports','Responsible gambling notice']) assert.ok(page.includes(`<h2>${h}</h2>`),h);
});


test('terms and support state the PropBetEdge no-refund digital membership policy', () => {
 const source=fs.readFileSync(new URL('../src/pages/trust.js',import.meta.url),'utf8');
 assert.match(source,/No-refund policy for digital sports intelligence/);
 assert.match(source,/subscription and membership charges are final and non-refundable once access is activated or made available/);
 assert.match(source,/Cancellation stops future renewal; it does not reverse or prorate the current billing period/);
 assert.match(source,/losing pick, incorrect prediction, revised model output/i);
 assert.match(source,/PropBetEdge memberships are non-refundable digital services/);
 assert.match(source,/duplicate charge/);
 assert.match(source,/verified billing\/access error/);
});
