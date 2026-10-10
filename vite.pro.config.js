/* Second build pass: the lean All Access entries.
 *   src/pro-entry.js       -> dist/_shell/pro.html       (/pro)
 *   src/intl-pro-entry.js  -> dist/_shell/intl-pro.html  (/ja/pro, /ko/pro)
 *
 * Runs after the main build (package.json "build") into the same dist/, with
 * its own chunk graph so the main SPA bundle is untouched. Each shell is the
 * built dist/index.html (one head: consent, GA4, schema, fonts) with the SPA
 * script and stylesheet swapped for that entry's script, modulepreloads and
 * stylesheet. Edge Middleware serves the shells (middleware.js); they are never
 * public pages (vercel.json: noindex; the entries send a direct visit to /pro). */
import { defineConfig } from 'vite';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const OUT = 'dist';
const ENTRIES = { pro: 'src/pro-entry.js', 'intl-pro': 'src/intl-pro-entry.js' };

/* Every stylesheet the chunk graph below `fileName` imports, in load order. */
function cssOf(bundle, fileName, seen = new Set()) {
  if (seen.has(fileName)) return [];
  seen.add(fileName);
  const c = bundle[fileName];
  return [...c.imports.flatMap((f) => cssOf(bundle, f, seen)), ...(c.viteMetadata?.importedCss || [])];
}

function proShells() {
  const entries = [];
  return {
    name: 'pbe-pro-shells',
    generateBundle(_, bundle) {
      for (const c of Object.values(bundle)) {
        if (c.type !== 'chunk' || !c.isEntry) continue;
        entries.push({ name: c.name, js: c.fileName, css: [...new Set(cssOf(bundle, c.fileName))], imports: c.imports });
      }
      if (entries.length !== Object.keys(ENTRIES).length) throw new Error('pro shells: missing entry chunk');
    },
    writeBundle() {
      const indexHtml = readFileSync(resolve(OUT, 'index.html'), 'utf8');
      const script = /<script type="module" crossorigin src="\/assets\/[^"]+\.js"><\/script>/;
      const style = /<link rel="stylesheet" crossorigin href="\/assets\/[^"]+\.css">/g;
      if (!script.test(indexHtml) || (indexHtml.match(style) || []).length !== 1) {
        throw new Error('pro shell: dist/index.html does not have exactly one app script and stylesheet');
      }
      mkdirSync(resolve(OUT, '_shell'), { recursive: true });
      for (const entry of entries) {
        const preloads = entry.imports.map((f) => `<link rel="modulepreload" crossorigin href="/${f}">`).join('\n  ');
        const html = indexHtml
          .replace(/\s*<link rel="modulepreload"[^>]*>/g, '')
          .replace(script, `<script type="module" crossorigin src="/${entry.js}"></script>${preloads ? `\n  ${preloads}` : ''}`)
          .replace(style, entry.css.map((f) => `<link rel="stylesheet" crossorigin href="/${f}">`).join('\n  '));
        writeFileSync(resolve(OUT, '_shell', `${entry.name}.html`), html);
      }
    },
  };
}

export default defineConfig({
  publicDir: false,
  build: {
    outDir: OUT,
    emptyOutDir: false,
    sourcemap: false,
    target: 'es2020',
    rollupOptions: {
      input: ENTRIES,
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/pro-[hash].js',
        assetFileNames: 'assets/pro-[hash][extname]',
      },
    },
  },
  plugins: [proShells()],
});
