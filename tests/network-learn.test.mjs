// propbetedge.ai footer links PropBetEdge Learn from PROPBET_LINKS, at the canonical URL, once.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('PROPBET_LINKS.learn is canonical and the footer renders it once', async () => {
  const cfg = fs.readFileSync(new URL('../src/ads-config.js', import.meta.url), 'utf8');
  assert.match(cfg, /learn:\s+'https:\/\/learn\.propbetedge\.ai\/'/);
  const src = fs.readFileSync(new URL('../src/components/footer.js', import.meta.url), 'utf8');
  assert.ok(!/learn\.propbetedge\.ai/.test(src), 'footer uses the registry, not a raw URL');
  const { renderFooter } = await import('../src/components/footer.js');
  const html = renderFooter({ cta: false });
  assert.equal((html.match(/href="https:\/\/learn\.propbetedge\.ai\/"/g) || []).length, 1, 'rendered once');
});
