/**
 * src/pages/404.js
 */

import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';

export function renderNotFound(root) {
  root.innerHTML = `
    ${renderHeader()}
    <main>
      <div class="container-narrow" style="padding:100px 0;text-align:center">
        <div class="kicker kicker-gold" style="margin-bottom:18px">404 · Off the Box Score</div>
        <h1 style="font-family:var(--font-serif);font-size:clamp(40px,6vw,72px);font-weight:900;letter-spacing:-0.025em;margin:0 0 18px;line-height:1.05">
          Page <em style="font-style:italic;color:var(--gold)">not found.</em>
        </h1>
        <p style="font-family:var(--font-serif);font-style:italic;font-size:20px;color:var(--paper-dim);margin:0 auto 36px;max-width:520px;line-height:1.5">
          The story you were looking for has either been moved, archived, or never existed.
        </p>
        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
          <a href="/news" class="btn btn-primary">Browse News →</a>
          <a href="https://mlb.propbetedge.ai" class="btn btn-ghost" target="_blank" rel="noopener">MLB Picks</a>
        </div>
      </div>
    </main>
    ${renderFooter()}
  `;
}
