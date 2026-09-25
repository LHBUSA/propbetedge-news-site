// propbetedge.ai footer links PropBetEdge Learn from PROPBET_LINKS, at the canonical URL, once.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('PROPBET_LINKS.learn is canonical and the footer renders it once', () => {
  const cfg = fs.readFileSync(new URL('../src/ads-config.js', import.meta.url), 'utf8');
  assert.match(cfg, /learn:\s+'https:\/\/learn\.propbetedge\.ai\/'/);
  const footer = fs.readFileSync(new URL('../src/components/footer.js', import.meta.url), 'utf8');
  assert.equal(footer.split('PROPBET_LINKS.learn').length - 1, 1);
  assert.ok(!/learn\.propbetedge\.ai/.test(footer), 'footer uses the registry, not a raw URL');
});
