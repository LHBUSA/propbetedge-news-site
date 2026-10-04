import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const router=fs.readFileSync(new URL('../src/router.js',import.meta.url),'utf8');
const page=fs.readFileSync(new URL('../src/pages/trust.js',import.meta.url),'utf8');
const sitemap=fs.readFileSync(new URL('../api/sitemap.js',import.meta.url),'utf8');
const footer=fs.readFileSync(new URL('../src/components/footer.js',import.meta.url),'utf8');

test('brand trust routes are canonical and discoverable',()=>{
 for(const p of ['terms','support','media']){
  assert.ok(router.includes(`path === '/${p}'`));
  // trust.js defines one content entry per page and builds its tab links from a key array
  // (['terms','support','media'].map((key) => `<a href="/${key}"...`)), so assert that structure, not literal paths.
  assert.ok(page.includes(`  ${p}: {`), `trust.js defines the ${p} page`);
  assert.match(page, new RegExp(`\\[[^\\]]*'${p}'[^\\]]*\\]\\.map\\(\\(key\\) => \`<a href="/\\$\\{key\\}"`), `trust tabs link /${p}`);
  assert.ok(sitemap.includes(`'/${p}'`));
  assert.ok(footer.includes(`href="/${p}"`));
 }
 assert.ok(page.includes('hello@proptechusa.ai'));
 assert.ok(page.includes('press@proptechusa.ai'));
 assert.ok(page.includes('editorial@proptechusa.ai'));
});
