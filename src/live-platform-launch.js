/*
 * NBA + NHL launch authority.
 *
 * Some older publication surfaces still own legacy "coming soon" copy inside
 * large components. This small post-render layer makes the public state
 * consistent without coupling the news site to those components' internals.
 */

const LIVE = {
  nba: {
    label: 'NBA',
    emoji: '🏀',
    href: 'https://nba.propbetedge.ai',
    eyebrow: '🏀 PROPBETEDGE NBA · LIVE',
    title: 'Take this into NBA Intelligence.',
    sub: 'The basketball platform is live now and will keep sharpening into the season.',
    cta: 'Open NBA Intelligence →',
    blurb: 'Live basketball research, player context and market intelligence',
  },
  nhl: {
    label: 'NHL',
    emoji: '🏒',
    href: 'https://nhl.propbetedge.ai',
    eyebrow: '🏒 PROPBETEDGE NHL · LIVE',
    title: 'Take this into NHL Intelligence.',
    sub: 'The hockey platform is live now and will keep improving through preseason.',
    cta: 'Open NHL Intelligence →',
    blurb: 'Ice Board, PBE Cast, player research and hockey intelligence',
  },
};

const WNBA = {
  label: 'WNBA',
  emoji: '🏀',
  href: 'https://wnba.propbetedge.ai',
  blurb: 'Live women’s basketball intelligence and research',
};

let queued = false;

function activeSport() {
  const match = String(location.pathname || '').match(/\/(?:news|games|leaders|team|standings|player)\/(nba|nhl)(?:\/|$)/i);
  return match?.[1]?.toLowerCase() || null;
}

function setExternal(anchor, href) {
  if (!anchor) return;
  if (anchor.getAttribute('href') !== href) anchor.setAttribute('href', href);
  anchor.setAttribute('target', '_blank');
  anchor.setAttribute('rel', 'noopener');
}

function intelligenceOption(key, product) {
  return `
    <a class="pbe-intel-option" href="${product.href}" target="_blank" rel="noopener" role="menuitem" data-live-platform="${key}">
      <span class="pbe-intel-option-icon" aria-hidden="true">${product.emoji}</span>
      <span class="pbe-intel-option-copy"><strong>${product.label} Intelligence</strong><small>${product.blurb}</small></span>
      <span class="pbe-intel-option-live">LIVE</span>
      <span class="pbe-intel-option-arrow" aria-hidden="true">↗</span>
    </a>`;
}

function patchHeaderSwitcher() {
  const menu = document.querySelector('.pbe-intel-menu');
  if (!menu) return;

  for (const [key, product] of [...Object.entries(LIVE), ['wnba', WNBA]]) {
    if (!menu.querySelector(`[data-live-platform="${key}"]`) && !menu.querySelector(`a[href^="${product.href}"]`)) {
      menu.insertAdjacentHTML('beforeend', intelligenceOption(key, product));
    }
  }

  const sport = activeSport();
  if (!sport || !LIVE[sport]) return;
  const product = LIVE[sport];
  const summary = document.querySelector('.pbe-intel-summary');
  if (summary) {
    const icon = summary.querySelector('.pbe-intel-summary-sport');
    if (icon) icon.textContent = product.emoji;
    const label = [...summary.children].find(node => node.tagName === 'SPAN' && !node.classList.contains('pbe-intel-live-dot') && !node.classList.contains('pbe-intel-summary-sport') && !node.classList.contains('pbe-intel-chevron'));
    if (label) label.textContent = `${product.label} Intelligence`;
  }

  menu.querySelectorAll('.pbe-intel-option').forEach(option => option.classList.remove('is-active'));
  const active = menu.querySelector(`[data-live-platform="${sport}"]`) || menu.querySelector(`a[href^="${product.href}"]`);
  active?.classList.add('is-active');
}

function patchScoreStrip() {
  for (const [sport, config] of Object.entries(LIVE)) {
    document.querySelectorAll(`.pss-tile[data-sport="${sport}"]`).forEach(tile => {
      setExternal(tile, config.href);
      tile.title = `Open ${config.label} Intelligence · live platform`;
      const mini = tile.querySelector('.pss-cta-mini');
      if (mini) {
        mini.textContent = 'Live platform';
        mini.classList.remove('soon');
      }
    });
  }
}

function patchCampaignElement(root, sport) {
  const config = LIVE[sport];
  if (!root || !config) return;

  setExternal(root.matches?.('a') ? root : root.querySelector('a'), config.href);

  const eyebrow = root.querySelector('.ad-block-eyebrow, .ad-banner-eyebrow, .par-cta-eyebrow, .picks-cta-eyebrow');
  if (eyebrow && eyebrow.textContent !== config.eyebrow) eyebrow.textContent = config.eyebrow;

  const headline = root.querySelector('.ad-block-headline, .par-cta-title, .picks-cta-headline');
  if (headline && /coming|next on|basketball|hockey|intelligence/i.test(headline.textContent || '')) headline.textContent = config.title;

  const sub = root.querySelector('.ad-block-sub, .par-cta-sub, .picks-cta-sub');
  if (sub && /coming|follow|built|building|online|product|coverage|intelligence/i.test(sub.textContent || '')) sub.textContent = config.sub;

  const cta = root.querySelector('.ad-block-cta, .par-cta-btn, .picks-cta .btn-primary');
  if (cta) {
    cta.textContent = config.cta;
    setExternal(cta.matches?.('a') ? cta : null, config.href);
  }
}

function patchHouseAds() {
  for (const [sport, config] of Object.entries(LIVE)) {
    document.querySelectorAll(`[data-ad-brand="propbetedge_${sport}"]`).forEach(root => {
      setExternal(root.matches('a') ? root : root.querySelector('a'), config.href);
      const eyebrow = root.querySelector('.ad-block-eyebrow');
      if (eyebrow) eyebrow.textContent = config.eyebrow;
      const headline = root.querySelector('.ad-block-headline');
      if (headline) headline.textContent = sport === 'nba'
        ? 'Basketball intelligence is live now.'
        : 'Hockey intelligence is live now.';
      const sub = root.querySelector('.ad-block-sub');
      if (sub) sub.textContent = config.sub;
      const cta = root.querySelector('.ad-block-cta');
      if (cta) cta.textContent = config.cta;
    });

    document.querySelectorAll('.ad-banner').forEach(banner => {
      const eyebrow = banner.querySelector('.ad-banner-eyebrow');
      if (!eyebrow || !eyebrow.textContent?.toUpperCase().includes(config.label)) return;
      setExternal(banner, config.href);
      eyebrow.textContent = config.eyebrow;
      const cta = banner.querySelector('.ad-banner-cta');
      if (cta) cta.textContent = config.cta;
    });
  }

  document.querySelectorAll('[data-ad-brand="propbetedge_network"]').forEach(root => {
    const sub = root.querySelector('.ad-block-sub');
    if (sub) sub.textContent = 'MLB, NFL, NBA, WNBA, NHL and UFC now have live PropBetEdge intelligence platforms connected by the same data-first network.';
  });
}

function patchArticleSurfaces() {
  const sport = activeSport();
  if (!sport) return;

  const rail = document.querySelector('#pbe-article-rail .par-cta');
  if (rail && /COMING SOON|next on the intelligence network|follow .* coverage/i.test(rail.textContent || '')) {
    patchCampaignElement(rail, sport);
  }

  const end = document.querySelector('.article-page .picks-cta');
  if (end && /COMING SOON|next on the intelligence network|follow .* coverage/i.test(end.textContent || '')) {
    patchCampaignElement(end, sport);
  }
}

function sync() {
  queued = false;
  patchHeaderSwitcher();
  patchScoreStrip();
  patchHouseAds();
  patchArticleSurfaces();
}

function schedule() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(sync);
}

export function initLivePlatformLaunch() {
  schedule();
  window.addEventListener('popstate', schedule);
  window.addEventListener('hashchange', schedule);
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
}
