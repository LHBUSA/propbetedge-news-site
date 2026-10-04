import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const router=fs.readFileSync(new URL('../src/router.js',import.meta.url),'utf8');
const page=fs.readFileSync(new URL('../src/pages/trust.js',import.meta.url),'utf8');
const sitemap=fs.readFileSync(new URL('../api/sitemap.js',import.meta.url),'utf8');
const footer=fs.readFileSync(new URL('../src/components/footer.js',import.meta.url),'utf8');
const robots=fs.readFileSync(new URL('../api/robots.js',import.meta.url),'utf8');

test('brand trust routes are canonical and discoverable',()=>{
 for(const p of ['terms','legal','support','media']){
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
