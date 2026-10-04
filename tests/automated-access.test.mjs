import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyAutomatedAccess,
  DENIED_MODEL_CRAWLERS,
  SEARCH_DISCOVERY_CRAWLERS,
} from '../src/security/automated-access.js';

test('known model-development crawlers are denied', () => {
  for (const bot of DENIED_MODEL_CRAWLERS) {
    const result = classifyAutomatedAccess(`Mozilla/5.0 ${bot}/1.0`);
    assert.equal(result.action, 'deny', bot);
    assert.equal(result.category, 'model_development', bot);
  }
});

test('search discovery crawlers remain allowed', () => {
  for (const bot of SEARCH_DISCOVERY_CRAWLERS) {
    const result = classifyAutomatedAccess(`Mozilla/5.0 ${bot}/1.0`);
    assert.equal(result.action, 'allow', bot);
    assert.equal(result.category, 'search_discovery', bot);
  }
});

test('common automation signatures are observed, not blindly blocked', () => {
  for (const ua of [
    'Mozilla/5.0 HeadlessChrome/154.0',
    'python-requests/2.32.0',
    'curl/8.14.1',
    'Scrapy/2.13',
  ]) {
    assert.equal(classifyAutomatedAccess(ua).action, 'observe');
  }
});

test('ordinary browsers are allowed', () => {
  assert.deepEqual(
    classifyAutomatedAccess('Mozilla/5.0 AppleWebKit/537.36 Chrome/154 Safari/537.36'),
    { action: 'allow', category: 'ordinary', matched: null },
  );
});
