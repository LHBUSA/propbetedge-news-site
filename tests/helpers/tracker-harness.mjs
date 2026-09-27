// Loads supabase/functions/free-picks-tracker/index.ts under Node (type stripping) with an in-memory ledger and
// injectable upstream fixtures, so the REAL tracker capture/grade/record code is exercised by tests.
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const SRC = new URL('../../supabase/functions/free-picks-tracker/index.ts', import.meta.url);

export async function loadTracker() {
  globalThis.__TRACKER_ENV = { SUPABASE_URL: 'https://sb.test', SUPABASE_SERVICE_ROLE_KEY: 'k' };
  let code = readFileSync(SRC, 'utf8').replace(/\r\n/g, '\n');
  code = code.replace(/^import "jsr:[^"]+";\n/m, '');
  code = code.replace(/Deno\.env\.get\("([A-Z_]+)"\)!/g, 'String(globalThis.__TRACKER_ENV?.$1 ?? "")');
  const serve = code.indexOf('Deno.serve(');
  code = code.slice(0, serve) + '\nexport { captureCurrent, resolvePending, responsePayload, productOf, recordClass, stableIdentity, PRODUCTS };\n';
  const dir = mkdtempSync(join(tmpdir(), 'tracker-'));
  const file = join(dir, `tracker-${Date.now()}-${Math.random().toString(16).slice(2)}.ts`);
  writeFileSync(file, code);
  return import(pathToFileURL(file).href);
}

/** In-memory PostgREST for pbe_free_pick_tracker + fixture upstreams. */
export function installFetch({ rows = [], upstream = {} } = {}) {
  globalThis.__TRACKER_ENV = { SUPABASE_URL: 'https://sb.test', SUPABASE_SERVICE_ROLE_KEY: 'k' };
  let seq = rows.length;
  const table = rows.map((r, i) => ({ id: r.id || `row-${i}`, evidence: {}, snapshot: {}, ...r }));
  const calls = [];
  const ok = (body, status = 200) => ({ ok: status < 400, status, text: async () => JSON.stringify(body), json: async () => body });
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, method: init.method || 'GET' });
    if (url.startsWith('https://sb.test/rest/v1/pbe_free_pick_tracker')) {
      const q = new URL(url).searchParams;
      if ((init.method || 'GET') === 'POST') {
        const row = JSON.parse(init.body);
        table.push({ id: `row-${seq++}`, ...row });
        return ok(null, 201);
      }
      if (init.method === 'PATCH') {
        const id = q.get('id').replace(/^eq\./, '');
        const row = table.find((r) => r.id === id);
        Object.assign(row, JSON.parse(init.body));
        return ok(null, 204);
      }
      let out = table;
      if (q.get('result')?.startsWith('eq.')) out = out.filter((r) => (r.result || 'PENDING') === q.get('result').slice(3));
      if (q.get('result')?.startsWith('in.(')) {
        const allowed = q.get('result').slice(4, -1).split(',');
        out = out.filter((r) => allowed.includes(r.result));
      }
      if (q.get('sport')?.startsWith('eq.')) out = out.filter((r) => r.sport === q.get('sport').slice(3));
      return ok(out.map((r) => ({ ...r })));
    }
    for (const [prefix, body] of Object.entries(upstream)) {
      if (url.startsWith(prefix)) {
        const value = typeof body === 'function' ? body(url) : body;
        if (value instanceof Error) return ok({ error: value.message }, 500);
        return ok(value);
      }
    }
    return ok({}, 404);
  };
  return { table, calls };
}
