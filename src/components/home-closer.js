/**
 * src/components/home-closer.js
 * Homepage-only brand closer (owner brief 2026-10-04): sells WHY PropBetEdge exists — the decision pipeline —
 * instead of repeating navigation. Static markup (no data, no fabricated numbers), rendered in the homepage
 * shell before the footer, so it is in the first layout (zero CLS). The canonical footer renders the premium
 * network directory only; the retired generic pre-footer sales billboard no longer exists on any route.
 * Styles: src/styles/home-closer.css (imported by pages/home.js so this module stays importable in Node tests).
 */
const STAGES = [
  { n: '01', title: 'Live data', sub: 'Scores · roles · injuries · matchups', tag: 'Input' },
  { n: '02', title: 'PBE model', sub: 'Probability · confidence · why', tag: 'Frozen at lock' },
  { n: '03', title: 'Market check', sub: 'Kalshi · Polymarket · movement', tag: 'Observed, never averaged' },
  { n: '04', title: 'The record', sub: 'Result · grade · permanent history', tag: 'Append-only' },
];

export function renderHomeCloser() {
  return `
  <section class="pbe-closer" aria-labelledby="pbe-closer-h">
    <div class="pbe-closer__bg" aria-hidden="true"></div>
    <div class="container pbe-closer__inner">
      <div class="pbe-closer__copy">
        <p class="pbe-closer__eyebrow">The Prop Bet Edge</p>
        <h2 id="pbe-closer-h" class="pbe-closer__h">Sports information is everywhere. <em>Decision intelligence isn’t.</em></h2>
        <p class="pbe-closer__body">PropBetEdge connects live sports data, proprietary probability models, player and matchup intelligence, prediction-market movement and permanent results — so you can see the signal, understand the reasoning and see whether it was right.</p>
      </div>
      <div class="pbe-closer__pipewrap">
      <span class="pbe-closer__rail" aria-hidden="true"></span>
      <ol class="pbe-closer__pipe" aria-label="How a PropBetEdge call is made and kept">
        ${STAGES.map((s) => `
        <li class="pbe-closer__stage">
          <span class="pbe-closer__node" aria-hidden="true"></span>
          <span class="pbe-closer__n" aria-hidden="true">${s.n}</span>
          <div class="pbe-closer__stage-body">
            <h3 class="pbe-closer__t">${s.title}</h3>
            <p class="pbe-closer__s">${s.sub}</p>
          </div>
          <span class="pbe-closer__tag">${s.tag}</span>
        </li>`).join('')}
      </ol>
      </div>
      <div class="pbe-closer__close">
        <p class="pbe-closer__vow">No black-box pick. No rewritten history. The evidence stays with the call.</p>
        <div class="pbe-closer__ctas">
          <a class="pbe-closer__cta pbe-closer__cta--primary" href="/pro">Explore All Access <span aria-hidden="true">→</span></a>
          <a class="pbe-closer__cta pbe-closer__cta--ghost" href="/odds/history">See the track record <span aria-hidden="true">→</span></a>
        </div>
      </div>
    </div>
  </section>`;
}
