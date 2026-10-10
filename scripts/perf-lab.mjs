#!/usr/bin/env node
// Local lab performance harness: Lighthouse against LOCAL production builds, cold and warm cache.
//
// Why local: scripted clients on the workstation IP trip the Vercel Security Checkpoint (403) on
// *.propbetedge.ai, and PSI's keyless quota is shared. So each site's origin/main is built locally and
// served by `serve` below, which emulates the Vercel edge closely enough for a lab number:
//   vercel.json headers / redirects / rewrites (path-to-regexp v6, has/missing) or legacy `routes`,
//   cleanUrls / trailingSlash, Routing Middleware (middleware.js run in-process, Web Request/Response,
//   `next()` + x-middleware-rewrite), Vercel Functions in api/ (edge-style and Node-style handlers),
//   external rewrites proxied, brotli compression, ETag + 304, default `public, max-age=0, must-revalidate`.
// Requests to Vercel-hosted production origins (DNS: *.vercel-dns-*.com / 216.150.0.0/16 / 76.76.21.0/24)
// are NEVER made: the server answers them 503 and Chrome blocks them (Lighthouse blockedUrlPatterns).
//
//   node scripts/perf-lab.mjs serve --site <id> [--config <lab-pages.json>] [--lab <dir with lighthouse>]
//   node scripts/perf-lab.mjs run --out <results.json> [--config ...] [--runs 3] [--modes mobile,desktop]
//        [--only id1,id2 | --sites root,golf] [--lab E:/Temp/claude/lab] [--raw <dir for gz LHRs>]
//
// `run` runs one Chrome at a time, in the foreground. Per page x mode x run it launches Chrome on a FRESH
// profile, runs Lighthouse once with the default storage reset (COLD: disk cache + origin storage cleared),
// then immediately runs Lighthouse again in the SAME browser with disableStorageReset (WARM: HTTP cache,
// service worker and storage from the cold navigation retained). Medians are per metric over the runs.
// Dependencies (lighthouse, chrome-launcher, path-to-regexp@6) resolve from --lab, not from this repo.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import os from 'node:os';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const argv = process.argv.slice(2);
const CMD = argv[0];
const args = Object.fromEntries(argv.slice(1).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : 'true']);
  return acc;
}, []));
const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONFIG = path.resolve(args.config || path.join(HERE, '../docs/global/perf/lab-2026-10-10/lab-pages.json'));
const LAB = path.resolve(args.lab || 'E:/Temp/claude/lab');
const labRequire = createRequire(path.join(LAB, 'package.json'));
const cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
const siteById = id => { const s = cfg.sites.find(x => x.id === id); if (!s) throw new Error(`unknown site ${id}`); return s; };

// ---------------------------------------------------------------- Vercel-hosted origin detection
const isVercelIp = ip => /^216\.150\./.test(ip) || /^76\.76\.21\./.test(ip);
const hostCache = new Map();
async function isVercelHost(host) {
  if (!host || /^(127\.|localhost)/.test(host)) return false;
  if (hostCache.has(host)) return hostCache.get(host);
  const p = (async () => {
    try { const c = await dns.resolveCname(host); if (c.some(x => /vercel-dns/.test(x))) return true; } catch {}
    try { return (await dns.resolve4(host)).some(isVercelIp); } catch { return false; }
  })();
  hostCache.set(host, p);
  return p;
}
async function vercelHostsIn(distDir) {
  const hosts = new Set();
  const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) { if (d === distDir || /assets|_astro|static/.test(e.name)) walk(f); }
    else if (/\.(js|css|html)$/.test(e.name) && fs.statSync(f).size < 8e6) for (const m of fs.readFileSync(f, 'utf8').matchAll(/https:\/\/([a-z0-9.-]+\.[a-z]{2,})/g)) hosts.add(m[1]);
  } };
  walk(distDir);
  for (const h of ['propbetedge.ai', 'www.propbetedge.ai', 'propsports.proptechusa.ai']) hosts.add(h);
  const out = [];
  for (const h of hosts) if (/propbetedge|proptechusa|vercel/.test(h) && await isVercelHost(h)) out.push(h);
  return out.sort();
}

// ---------------------------------------------------------------- serve (Vercel edge emulation)
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json', '.map': 'application/json', '.mp4': 'video/mp4', '.webm': 'video/webm' };
const COMPRESSIBLE = /^(text\/|application\/(json|javascript|xml|manifest\+json)|image\/svg)/;

async function serve(siteId, { quiet = false } = {}) {
  const site = siteById(siteId);
  const DIR = path.resolve(site.dir);
  const ROOT = path.join(DIR, site.dist || 'dist');
  const PORT = Number(args.port || site.port);
  const ORIGIN = `http://127.0.0.1:${PORT}`;
  const { pathToRegexp } = labRequire('path-to-regexp');
  const vj = fs.existsSync(path.join(DIR, 'vercel.json')) ? JSON.parse(fs.readFileSync(path.join(DIR, 'vercel.json'), 'utf8')) : {};
  const logFile = args.log || path.join(LAB, `serve-${siteId}.jsonl`);
  const log = rec => fs.appendFileSync(logFile, JSON.stringify({ t: new Date().toISOString(), ...rec }) + '\n');

  const rx = src => { const keys = []; const re = pathToRegexp(src, keys, { strict: true, sensitive: true, delimiter: '/' }); return { re, keys }; };
  const compiled = list => (list || []).map(r => ({ ...r, ...rx(r.source) }));
  const HEADERS = compiled(vj.headers);
  const REDIRECTS = compiled(vj.redirects);
  const REWRITES = compiled(Array.isArray(vj.rewrites) ? vj.rewrites : []);
  const ROUTES = vj.routes || null;

  const cookieOf = (req, k) => { const m = (req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${k}=([^;]*)`)); return m ? decodeURIComponent(m[1]) : undefined; };
  const condOk = (r, req, url) => {
    const test = c => {
      const v = c.type === 'cookie' ? cookieOf(req, c.key) : c.type === 'host' ? url.hostname : c.type === 'header' ? req.headers[String(c.key).toLowerCase()] : c.type === 'query' ? url.searchParams.get(c.key) ?? undefined : undefined;
      if (c.type === 'host') return c.value ? new RegExp(`^${c.value}$`).test(v) : true;
      if (v === undefined) return false;
      return c.value === undefined || new RegExp(`^${c.value}$`).test(v);
    };
    return (r.has || []).every(test) && !(r.missing || []).some(test);
  };
  const matchRule = (r, pathname) => { const m = r.re.exec(pathname); if (!m) return null; const p = {}; r.keys.forEach((k, i) => { p[k.name] = m[i + 1]; }); return { m, p }; };
  const fill = (dest, { m, p }) => {
    let out = dest.replace(/:([A-Za-z_][A-Za-z0-9_]*)\*?/g, (s, k) => (k in p ? (p[k] ?? '') : s));
    return out.replace(/\$(\d+)/g, (s, i) => m[Number(i)] ?? '');
  };

  // middleware
  let mw = null; let mwMatch = null;
  const mwFile = ['middleware.js', 'middleware.mjs', 'middleware.ts'].map(f => path.join(DIR, f)).find(f => fs.existsSync(f));
  if (mwFile) {
    const mod = await import(pathToFileURL(mwFile).href);
    mw = mod.default || mod.middleware;
    const matchers = [].concat(mod.config?.matcher || ['/(.*)']).map(s => rx(typeof s === 'string' ? s : s.source));
    mwMatch = p => matchers.some(r => r.re.test(p));
  }
  // functions
  const fnCache = new Map();
  const loadFn = async name => {
    if (!fnCache.has(name)) {
      const f = ['.js', '.mjs', '.ts'].map(e => path.join(DIR, 'api', name + e)).find(x => fs.existsSync(x));
      fnCache.set(name, f ? import(pathToFileURL(f).href) : Promise.resolve(null));
    }
    return fnCache.get(name);
  };

  // global fetch shim for in-process middleware / functions: same-origin -> internal router (no middleware,
  // as on Vercel); Vercel-hosted production origins -> 503 (never contacted).
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const req = input instanceof Request ? input : new Request(input, init);
    const u = new URL(req.url);
    if (u.origin === ORIGIN || u.hostname === 'localhost') return internal(req);
    if (await isVercelHost(u.hostname)) { log({ kind: 'blocked-server', url: req.url }); return new Response('{"lab":"vercel-host-blocked"}', { status: 503, headers: { 'content-type': 'application/json' } }); }
    return realFetch(input, init);
  };

  const fileFor = p => {
    let rel; try { rel = decodeURIComponent(p); } catch { return null; }
    const cands = [rel];
    if (rel.endsWith('/')) cands.push(rel + 'index.html'); else { if (vj.cleanUrls) cands.push(rel + '.html'); cands.push(rel + '/index.html'); }
    for (const c of cands) { const f = path.join(ROOT, c); if (f.startsWith(ROOT) && fs.existsSync(f) && fs.statSync(f).isFile()) return f; }
    return null;
  };
  const fileResponse = (f, status = 200) => new Response(fs.readFileSync(f), { status, headers: { 'content-type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream', 'x-lab-file': path.relative(ROOT, f) } });
  const notFound = () => { const f = path.join(ROOT, '404.html'); return fs.existsSync(f) ? fileResponse(f, 404) : new Response('not found', { status: 404 }); };

  async function proxy(dest, req) {
    const u = new URL(dest);
    if (await isVercelHost(u.hostname)) { log({ kind: 'blocked-proxy', url: dest }); return new Response('{"lab":"vercel-host-blocked"}', { status: 503, headers: { 'content-type': 'application/json' } }); }
    const h = new Headers(req.headers); h.delete('host'); h.delete('accept-encoding'); h.delete('connection');
    try {
      const r = await realFetch(dest, { method: req.method, headers: h, body: ['GET', 'HEAD'].includes(req.method) ? undefined : await req.arrayBuffer(), redirect: 'manual' });
      const oh = new Headers(r.headers); oh.delete('content-encoding'); oh.delete('content-length'); oh.delete('transfer-encoding');
      log({ kind: 'proxy', url: dest, status: r.status });
      return new Response(await r.arrayBuffer(), { status: r.status, headers: oh });
    } catch (e) { log({ kind: 'proxy-error', url: dest, error: String(e) }); return new Response('{}', { status: 502 }); }
  }

  async function runFunction(name, req, query) {
    const mod = await loadFn(name);
    if (!mod) return null;
    const handler = mod.default || mod.GET;
    try {
      if (mod.config?.runtime === 'edge' || handler.length < 2) {
        const r = await handler(req);
        return r instanceof Response ? r : new Response(null, { status: 204 });
      }
      // Node-style (req, res) with the Vercel helpers.
      return await new Promise((resolve, reject) => {
        const u = new URL(req.url);
        const q = Object.fromEntries(u.searchParams); Object.assign(q, query || {});
        const nreq = { method: req.method, url: u.pathname + u.search, headers: Object.fromEntries(req.headers), query: q, cookies: Object.fromEntries((req.headers.get('cookie') || '').split(/;\s*/).filter(Boolean).map(c => c.split('='))), body: undefined, on() {}, socket: {} };
        let status = 200; const headers = new Headers();
        const res = {
          statusCode: 200,
          status(c) { status = c; this.statusCode = c; return this; },
          setHeader(k, v) { headers.set(k, Array.isArray(v) ? v.join(', ') : String(v)); return this; },
          getHeader(k) { return headers.get(k); },
          writeHead(c, h) { status = c; for (const [k, v] of Object.entries(h || {})) headers.set(k, String(v)); return this; },
          json(o) { headers.set('content-type', 'application/json; charset=utf-8'); this.end(JSON.stringify(o)); },
          send(b) { if (typeof b === 'object' && !Buffer.isBuffer(b)) return this.json(b); this.end(b); },
          redirect(a, b) { const [c, l] = typeof a === 'number' ? [a, b] : [307, a]; status = c; headers.set('location', l); this.end(); },
          write(b) { (this._chunks ||= []).push(Buffer.from(b)); return true; },
          end(b) { if (b) this.write(b); resolve(new Response(this._chunks ? Buffer.concat(this._chunks) : null, { status: this.statusCode !== 200 ? this.statusCode : status, headers })); },
        };
        Promise.resolve(handler(nreq, res)).catch(reject);
      });
    } catch (e) { log({ kind: 'function-error', fn: name, error: String(e && e.stack || e).slice(0, 400) }); return new Response('{"lab":"function-error"}', { status: 500, headers: { 'content-type': 'application/json' } }); }
  }

  async function dispatch(target, req) {
    // target: path?query (internal) or absolute external URL
    if (/^https?:\/\//.test(target)) {
      const t = new URL(target); const src = new URL(req.url);
      for (const [k, v] of src.searchParams) if (!t.searchParams.has(k)) t.searchParams.set(k, v);
      return proxy(t.href, req);
    }
    const t = new URL(target, ORIGIN);
    const fm = t.pathname.match(/^\/api\/([^/?]+?)(?:\.js)?(?:\/.*)?$/);
    if (fm) {
      const src = new URL(req.url);
      for (const [k, v] of src.searchParams) if (!t.searchParams.has(k)) t.searchParams.set(k, v);
      const r = await runFunction(fm[1], new Request(t.href, req), Object.fromEntries(t.searchParams));
      if (r) return r;
    }
    const f = fileFor(t.pathname);
    return f ? fileResponse(f) : null;
  }

  // The router. skipMiddleware = the request came from middleware itself (Vercel: origin fetch).
  async function route(req, { skipMiddleware = false } = {}) {
    const url = new URL(req.url);
    let pathname = url.pathname;
    const extraHeaders = {};

    if (ROUTES) {
      let phase = 'pre'; let status = 0; let cur = pathname + url.search;
      for (const r of ROUTES) {
        if (r.handle === 'filesystem') { phase = 'fs'; const f = fileFor(new URL(cur, ORIGIN).pathname); if (f) return finish(fileResponse(f), extraHeaders); continue; }
        if (r.handle) continue;
        const re = new RegExp(r.src.startsWith('^') ? r.src : `^${r.src}$`, 'i');
        const m = re.exec(new URL(cur, ORIGIN).pathname); if (!m) continue;
        const sub = s => s.replace(/\$(\d+)/g, (x, i) => m[Number(i)] ?? '');
        for (const [k, v] of Object.entries(r.headers || {})) extraHeaders[k] = sub(v);
        if (r.status && extraHeaders.Location) return new Response(null, { status: r.status, headers: { location: extraHeaders.Location } });
        if (r.status) status = r.status;
        if (r.dest) {
          const d = sub(r.dest);
          if (/^https?:/.test(d)) return finish(await proxy(d, req), extraHeaders);
          const q = new URL(d, ORIGIN); for (const [k, v] of url.searchParams) if (!q.searchParams.has(k)) q.searchParams.set(k, v);
          cur = q.pathname + q.search;
          if (phase === 'fs' || !r.continue) {
            const out = await dispatch(cur, req);
            if (out) return finish(status ? new Response(out.body, { status, headers: out.headers }) : out, extraHeaders);
            if (phase === 'fs') return finish(notFound(), extraHeaders);
          }
        }
      }
      return finish(notFound(), extraHeaders);
    }

    if (!skipMiddleware) {
      if (vj.trailingSlash === false && pathname !== '/' && pathname.endsWith('/')) return new Response(null, { status: 308, headers: { location: pathname.replace(/\/+$/, '') + url.search } });
      if (vj.cleanUrls && /\.html$/.test(pathname)) return new Response(null, { status: 308, headers: { location: pathname.replace(/(\/index)?\.html$/, '') || '/' } });
      for (const r of REDIRECTS) { const mm = matchRule(r, pathname); if (mm && condOk(r, reqLike(req), url)) return new Response(null, { status: r.statusCode || (r.permanent === false ? 307 : 308), headers: { location: fill(r.destination, mm) } }); }
      if (mw && mwMatch(pathname)) {
        let res;
        try { res = await mw(req, { waitUntil() {} }); } catch (e) { log({ kind: 'middleware-error', path: pathname, error: String(e && e.stack || e).slice(0, 600) }); return new Response('middleware error', { status: 500 }); }
        if (res && !res.headers.get('x-middleware-next')) {
          const rw = res.headers.get('x-middleware-rewrite');
          if (rw) { const out = await dispatch(new URL(rw, ORIGIN).href.replace(ORIGIN, ''), req); return out || notFound(); }
          return res;
        }
      }
    }
    const f = fileFor(pathname);
    if (f) return fileResponse(f);
    for (const r of REWRITES) {
      const mm = matchRule(r, pathname);
      if (!mm || !condOk(r, reqLike(req), url)) continue;
      const out = await dispatch(fill(r.destination, mm), req);
      if (out) return out;
    }
    const fn = pathname.match(/^\/api\/([^/]+?)(?:\.js)?$/);
    if (fn) { const out = await dispatch(pathname + url.search, req); if (out) return out; }
    return notFound();
  }
  const reqLike = req => ({ headers: Object.fromEntries(req.headers) });
  const finish = (res, extra) => { if (!Object.keys(extra).length) return res; const h = new Headers(res.headers); for (const [k, v] of Object.entries(extra)) if (k.toLowerCase() !== 'location') h.set(k, v); return new Response(res.body, { status: res.status, headers: h }); };
  // Internal (middleware origin) fetches never carry the static-file marker, so a middleware-built document
  // gets no ETag / 304 (as on Vercel, where middleware runs on every request and answers 200).
  async function internal(req) { const r = await route(req, { skipMiddleware: true }); const h = new Headers(r.headers); h.delete('x-lab-file'); return new Response(r.body, { status: r.status, headers: h }); }

  const brCache = new Map();
  const server = http.createServer(async (nreq, nres) => {
    const started = Date.now();
    try {
      const url = new URL(nreq.url, ORIGIN);
      const chunks = []; for await (const c of nreq) chunks.push(c);
      const headers = new Headers(); for (const [k, v] of Object.entries(nreq.headers)) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
      const req = new Request(url, { method: nreq.method, headers, body: ['GET', 'HEAD'].includes(nreq.method) ? undefined : Buffer.concat(chunks) });
      const res = await route(req);
      const h = new Headers(res.headers);
      // vercel.json `headers` (applied to every response on a matching source)
      for (const r of HEADERS) if (r.re.test(url.pathname) && condOk(r, { headers: nreq.headers }, url)) for (const { key, value } of r.headers) h.set(key, value);
      if (!h.has('cache-control')) h.set('cache-control', 'public, max-age=0, must-revalidate');
      let body = res.body ? Buffer.from(await res.arrayBuffer()) : Buffer.alloc(0);
      const isFile = h.get('x-lab-file');
      h.delete('x-lab-file'); h.delete('content-length'); h.delete('content-encoding'); h.delete('transfer-encoding'); h.delete('x-middleware-next');
      if (res.status === 200 && body.length && isFile) {
        const etag = `"${crypto.createHash('sha1').update(body).digest('base64url').slice(0, 22)}"`;
        h.set('etag', etag);
        if ((nreq.headers['if-none-match'] || '') === etag) { const hh = Object.fromEntries(h); nres.writeHead(304, hh); nres.end(); log({ path: url.pathname + url.search, status: 304, ms: Date.now() - started }); return; }
      }
      const ct = h.get('content-type') || '';
      if (body.length > 512 && COMPRESSIBLE.test(ct) && /\bbr\b/.test(nreq.headers['accept-encoding'] || '')) {
        const key = isFile ? `${isFile}:${body.length}` : null;
        let c = key && brCache.get(key);
        if (!c) { c = zlib.brotliCompressSync(body, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: isFile ? 9 : 5 } }); if (key) brCache.set(key, c); }
        body = c; h.set('content-encoding', 'br'); h.append('vary', 'Accept-Encoding');
      }
      h.set('content-length', String(body.length));
      const out = {}; for (const [k, v] of h) out[k] = v;
      nres.writeHead(res.status, out);
      nres.end(nreq.method === 'HEAD' ? undefined : body);
      if (!quiet) log({ path: url.pathname + url.search, status: res.status, bytes: body.length, ms: Date.now() - started });
    } catch (e) {
      log({ kind: 'server-error', url: nreq.url, error: String(e && e.stack || e).slice(0, 600) });
      if (!nres.headersSent) nres.writeHead(500); nres.end('lab server error');
    }
  });
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  console.log(`[perf-lab] ${siteId} serving ${ROOT} at ${ORIGIN} (middleware: ${mw ? 'yes' : 'no'}, routes: ${ROUTES ? 'legacy' : 'rewrites'})`);
  return server;
}

// ---------------------------------------------------------------- Lighthouse runner
const median = xs => { const v = xs.filter(x => typeof x === 'number' && Number.isFinite(x)).sort((a, b) => a - b); if (!v.length) return null; const m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
const nv = (a, k) => { const x = a[k]?.numericValue; return typeof x === 'number' ? x : null; };

function trim(lhr, pageOrigin) {
  const a = lhr.audits;
  const net = a['network-requests']?.details?.items || [];
  const by = {}; let third = 0; let thirdReq = 0;
  const thirdOrigins = {};
  for (const r of net) {
    const t = (r.resourceType || 'Other').toLowerCase();
    by[t] = (by[t] || 0) + (r.transferSize || 0);
    let o = ''; try { o = new URL(r.url).origin; } catch {}
    if (o && o !== pageOrigin && !o.startsWith('data:')) { third += r.transferSize || 0; thirdReq++; thirdOrigins[o] = (thirdOrigins[o] || 0) + (r.transferSize || 0); }
  }
  const doc = net.find(r => r.resourceType === 'Document');
  const lcpEl = a['largest-contentful-paint-element']?.details?.items?.[0]?.items?.[0]?.node || null;
  // LCP resource: the element's src/poster/background as written in the DOM snippet, plus its network record.
  const lcpReq = (() => {
    const sn = lcpEl?.snippet || '';
    const m = sn.match(/\b(?:src|poster)="([^"]+)"/) || sn.match(/url\((?:&quot;|["'])?([^"')&]+)/);
    if (!m) return null;
    const src = m[1].replace(/&amp;/g, '&');
    const rec = net.find(r => r.url === src) || null;
    return { url: src, bytes: rec?.transferSize ?? null, priority: rec?.priority ?? null, status: rec?.statusCode ?? null };
  })();
  const discovery = a['lcp-discovery-insight']?.details?.items?.[0]?.items || null;
  const items = (k, n = 5) => (a[k]?.details?.items || []).slice(0, n);
  const shifts = (a['cls-culprits-insight']?.details?.items?.[0]?.items || []).filter(s => s.node?.type === 'node').slice(0, 5).map(s => ({ score: s.score, node: s.node.selector || null, snippet: (s.node.snippet || '').slice(0, 160), causes: (s.subItems?.items || []).map(c => `${c.cause || ''}${c.extra?.value ? ': ' + c.extra.value : ''}`).slice(0, 4) }));
  const shiftsLegacy = items('layout-shifts', 5).map(s => ({ score: s.score, node: s.node?.selector || s.node?.snippet || null, snippet: s.node?.snippet?.slice(0, 160) || null, causes: (s.subItems?.items || []).map(c => c.extra?.value || c.cause || null).filter(Boolean).slice(0, 3) }));
  const blocking = (a['render-blocking-insight']?.details?.items || a['render-blocking-resources']?.details?.items || []).slice(0, 6).map(r => ({ url: r.url, wastedMs: r.wastedMs ?? null, bytes: r.totalBytes ?? r.transferSize ?? null }));
  const bootup = items('bootup-time', 6).map(r => ({ url: r.url, total: Math.round(r.total), scripting: Math.round(r.scripting) }));
  const longTasks = items('long-tasks', 6).map(r => ({ url: r.url, duration: Math.round(r.duration), start: Math.round(r.startTime) }));
  const mainThread = items('mainthread-work-breakdown', 6).map(r => ({ group: r.groupLabel || r.group, ms: Math.round(r.duration) }));
  const unusedJs = items('unused-javascript', 5).map(r => ({ url: r.url, total: r.totalBytes, wasted: r.wastedBytes }));
  const thirdParty = items('third-party-summary', 8).map(r => ({ entity: typeof r.entity === 'string' ? r.entity : r.entity?.text, bytes: r.transferSize, blockingMs: Math.round(r.blockingTime || 0) }));
  const lcpPhases = (() => { const d = a['largest-contentful-paint-element']?.details?.items?.[1]?.items; if (!Array.isArray(d)) return null; const out = {}; for (const x of d) if (x && (x.phase || x.label || x.subpart)) out[x.phase || x.subpart || x.label] = Math.round(x.timing ?? x.duration ?? 0); return Object.keys(out).length ? out : null; })();
  const biggest = [...net].sort((x, y) => (y.transferSize || 0) - (x.transferSize || 0)).slice(0, 8).map(r => ({ url: r.url, type: r.resourceType, bytes: r.transferSize, status: r.statusCode }));
  const failed = net.filter(r => !(r.statusCode >= 200 && r.statusCode < 400) && r.statusCode !== 0 || r.statusCode === 0 && !/^data:/.test(r.url)).slice(0, 12).map(r => ({ url: r.url, status: r.statusCode }));
  const cached = net.filter(r => (r.transferSize || 0) === 0 && !/^data:/.test(r.url)).length;
  return {
    lcp_ms: nv(a, 'largest-contentful-paint'), cls: nv(a, 'cumulative-layout-shift'), tbt_ms: nv(a, 'total-blocking-time'),
    fcp_ms: nv(a, 'first-contentful-paint'), si_ms: nv(a, 'speed-index'), ttfb_ms: nv(a, 'server-response-time'), tti_ms: nv(a, 'interactive'),
    perf_score: lhr.categories?.performance?.score ?? null,
    bytes: nv(a, 'total-byte-weight'), requests: net.length, requests_zero_transfer: cached,
    js_bytes: by.script || 0, image_bytes: by.image || 0, css_bytes: by.stylesheet || 0, font_bytes: by.font || 0, doc_bytes: by.document || 0,
    other_bytes: Object.entries(by).filter(([k]) => !['script', 'image', 'stylesheet', 'font', 'document'].includes(k)).reduce((s, [, v]) => s + v, 0),
    third_party_bytes: third, third_party_requests: thirdReq,
    third_party_origins: Object.fromEntries(Object.entries(thirdOrigins).sort((x, y) => y[1] - x[1]).slice(0, 10)),
    doc_status: doc?.statusCode ?? null, final_url: lhr.finalDisplayedUrl,
    lcp_element: lcpEl ? { selector: lcpEl.selector || null, snippet: (lcpEl.snippet || '').slice(0, 240), label: lcpEl.nodeLabel || null } : null,
    lcp_resource: lcpReq, lcp_phases: lcpPhases, lcp_discovery: discovery ? Object.fromEntries(Object.entries(discovery).map(([k, v]) => [k, v.value])) : null,
    diagnostics: { layout_shifts: shifts.length ? shifts : shiftsLegacy, render_blocking: blocking, bootup, long_tasks: longTasks, main_thread: mainThread, unused_js: unusedJs, third_party: thirdParty, biggest, failed_requests: failed },
    benchmark_index: lhr.environment?.benchmarkIndex ?? null,
    warnings: lhr.runWarnings || [], runtime_error: lhr.runtimeError?.message || null,
  };
}

const METRICS = ['lcp_ms', 'cls', 'tbt_ms', 'fcp_ms', 'si_ms', 'ttfb_ms', 'tti_ms', 'perf_score', 'bytes', 'requests', 'requests_zero_transfer', 'js_bytes', 'image_bytes', 'css_bytes', 'font_bytes', 'doc_bytes', 'other_bytes', 'third_party_bytes', 'third_party_requests', 'benchmark_index'];
function summarize(runs) {
  const ok = runs.filter(r => r && !r.runtime_error && r.doc_status >= 200 && r.doc_status < 300);
  const med = {}; for (const k of METRICS) med[k] = median(ok.map(r => r[k]));
  // representative run = the one whose LCP is the median (diagnostics come from it)
  const rep = [...ok].sort((x, y) => (x.lcp_ms ?? 0) - (y.lcp_ms ?? 0))[ok.length >> 1] || null;
  return { n: ok.length, median: med, lcp_element: rep?.lcp_element || null, lcp_resource: rep?.lcp_resource || null, lcp_phases: rep?.lcp_phases || null, lcp_discovery: rep?.lcp_discovery || null, third_party_origins: rep?.third_party_origins || null, diagnostics: rep?.diagnostics || null, spread: { lcp_ms: [Math.min(...ok.map(r => r.lcp_ms)), Math.max(...ok.map(r => r.lcp_ms))], tbt_ms: [Math.min(...ok.map(r => r.tbt_ms)), Math.max(...ok.map(r => r.tbt_ms))], cls: [Math.min(...ok.map(r => r.cls)), Math.max(...ok.map(r => r.cls))] } };
}

async function run() {
  const OUT = args.out; if (!OUT) { console.error('--out required'); process.exit(2); }
  const RUNS = Number(args.runs || 3);
  const MODES = (args.modes || 'mobile,desktop').split(',');
  const ONLY = args.only ? new Set(args.only.split(',')) : null;
  const SITES = args.sites ? new Set(args.sites.split(',')) : null;
  const RAW = args.raw ? path.resolve(args.raw) : null; if (RAW) fs.mkdirSync(RAW, { recursive: true });
  const lighthouse = (await import(pathToFileURL(labRequire.resolve('lighthouse')).href)).default;
  const desktopConfig = (await import(pathToFileURL(path.join(path.dirname(labRequire.resolve('lighthouse/package.json')), 'core/config/desktop-config.js')).href)).default;
  const chromeLauncher = await import(pathToFileURL(labRequire.resolve('chrome-launcher')).href);
  const lhVersion = JSON.parse(fs.readFileSync(labRequire.resolve('lighthouse/package.json'), 'utf8')).version;
  const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null;
  const results = prev?.results ? prev.results.filter(r => !(ONLY ? ONLY.has(r.id) : SITES ? SITES.has(r.site) : true)) : [];
  const meta = { schema: 'pbe-perf-lab/1', generated_at: new Date().toISOString(), lighthouse: lhVersion, chrome: null, node: process.version, host: { cpus: os.cpus().length, cpu: os.cpus()[0]?.model, mem_gb: Math.round(os.totalmem() / 1e9) }, runs: RUNS, modes: MODES, blocked_hosts: {}, sites: {} };

  for (const site of cfg.sites) {
    const pages = cfg.pages.filter(p => p.site === site.id && (!ONLY || ONLY.has(p.id)) && (!SITES || SITES.has(site.id)));
    if (!pages.length) continue;
    const dir = path.resolve(site.dir);
    let commit = null; try { commit = fs.readFileSync(path.join(dir, '.git'), 'utf8'); } catch {}
    const blocked = await vercelHostsIn(path.join(dir, site.dist || 'dist'));
    meta.blocked_hosts[site.id] = blocked;
    // serve in a child process so a middleware crash never kills the runner and fetch shims stay isolated
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), 'serve', '--site', site.id, '--config', CONFIG, '--lab', LAB, '--log', path.join(RAW || LAB, `serve-${site.id}.jsonl`)], { stdio: ['ignore', 'pipe', 'inherit'] });
    await new Promise((res, rej) => { child.stdout.on('data', d => { process.stdout.write(d); if (/serving/.test(String(d))) res(); }); child.on('exit', c => rej(new Error(`serve exited ${c}`))); });
    const origin = `http://127.0.0.1:${site.port}`;
    try {
      for (const page of pages) {
        const url = origin + page.path;
        for (const mode of MODES) {
          const runs = { cold: [], warm: [] };
          for (let i = 0; i < RUNS; i++) {
            const profile = fs.mkdtempSync(path.join(LAB, 'profile-'));
            const chrome = await chromeLauncher.launch({ chromePath: args.chrome || undefined, userDataDir: profile, chromeFlags: ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-extensions'] });
            try {
              if (!meta.chrome) { try { meta.chrome = (await (await fetch(`http://127.0.0.1:${chrome.port}/json/version`)).json()).Browser; } catch {} }
              const flags = { port: chrome.port, output: 'json', logLevel: 'error', onlyCategories: ['performance'], blockedUrlPatterns: blocked.map(h => `*://${h}/*`) };
              const config = mode === 'desktop' ? desktopConfig : undefined;
              for (const cache of ['cold', 'warm']) {
                const t0 = Date.now();
                const r = await lighthouse(url, { ...flags, disableStorageReset: cache === 'warm' }, config);
                const lhr = r.lhr;
                if (RAW) fs.writeFileSync(path.join(RAW, `${page.id}.${mode}.${cache}.${i + 1}.json.gz`), zlib.gzipSync(JSON.stringify(lhr)));
                const t = trim(lhr, origin);
                runs[cache].push(t);
                console.log(`[perf-lab] ${page.id} ${mode} ${cache} #${i + 1}: LCP ${Math.round(t.lcp_ms)} CLS ${t.cls?.toFixed(3)} TBT ${Math.round(t.tbt_ms)} bytes ${t.bytes} req ${t.requests} doc ${t.doc_status} (${((Date.now() - t0) / 1000).toFixed(0)}s)${t.runtime_error ? ' ERR ' + t.runtime_error : ''}`);
              }
            } catch (e) {
              console.error(`[perf-lab] ${page.id} ${mode} run ${i + 1} failed: ${e.message}`);
              runs.cold.push(null); runs.warm.push(null);
            } finally {
              await chrome.kill(); try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5 }); } catch {}
            }
          }
          for (const cache of ['cold', 'warm']) results.push({ id: page.id, site: page.site, lang: page.lang, en: page.en || null, path: page.path, mode, cache, ...summarize(runs[cache]), runs: runs[cache].map(r => r && Object.fromEntries(['lcp_ms', 'cls', 'tbt_ms', 'fcp_ms', 'si_ms', 'bytes', 'requests', 'doc_status', 'benchmark_index'].map(k => [k, r[k]]))) });
          fs.writeFileSync(OUT, JSON.stringify({ ...(prev || {}), ...meta, results }, null, 1));
        }
      }
    } finally { child.kill(); }
  }
  fs.writeFileSync(OUT, JSON.stringify({ ...(prev || {}), ...meta, blocked_hosts: { ...(prev?.blocked_hosts || {}), ...meta.blocked_hosts }, results }, null, 1));
  console.log(`[perf-lab] wrote ${OUT} (${results.length} page x mode x cache rows)`);
}

// ---------------------------------------------------------------- report (compact markdown table)
function report() {
  const j = JSON.parse(fs.readFileSync(args.in, 'utf8'));
  const kb = b => (b == null ? 'UNKNOWN' : (b / 1024).toFixed(0));
  const sec = v => (v == null ? 'UNKNOWN' : (v / 1000).toFixed(2));
  const flag = (v, lim, fmt) => (v == null ? 'UNKNOWN' : fmt(v) + (v > lim ? ' ✗' : ''));
  const order = cfg.pages.map(p => p.id);
  const rows = [...j.results].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id) || b.mode.localeCompare(a.mode) || a.cache.localeCompare(b.cache));
  const out = ['| Page | Path | Mode | Cache | LCP s | CLS | TBT ms | FCP s | SI s | Transfer KB | JS KB | Img KB | Req | n |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const r of rows) {
    const m = r.median;
    out.push(`| ${r.id} | \`${r.path}\` | ${r.mode} | ${r.cache} | ${flag(m.lcp_ms, 2500, sec)} | ${flag(m.cls, 0.1, v => v.toFixed(3))} | ${flag(m.tbt_ms, 200, v => String(Math.round(v)))} | ${sec(m.fcp_ms)} | ${sec(m.si_ms)} | ${kb(m.bytes)} | ${kb(m.js_bytes)} | ${kb(m.image_bytes)} | ${m.requests ?? 'UNKNOWN'} | ${r.n} |`);
  }
  const md = out.join('\n') + '\n';
  if (args.out) fs.writeFileSync(args.out, md); else process.stdout.write(md);
}

if (CMD === 'report') { report(); }
else if (CMD === 'serve') { await serve(args.site); }
else if (CMD === 'run') { await run(); process.exit(0); }
else { console.error('usage: perf-lab.mjs report --in <results.json> [--out table.md] | serve --site <id> | run --out <file> [--runs 3] [--modes mobile,desktop] [--only ids] [--sites ids] [--lab dir] [--raw dir]'); process.exit(2); }
