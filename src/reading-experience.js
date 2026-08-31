import { slugifyEntity } from './sport-config.js';

let installed = false;
let activeArticleKey = '';
let observer = null;
let frame = null;

export function initReadingExperience() {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  window.addEventListener('scroll', scheduleProgress, { passive: true });
  window.addEventListener('resize', scheduleProgress, { passive: true });
  window.addEventListener('popstate', scheduleSync);
  observer = new MutationObserver(scheduleSync);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  scheduleSync();
}

function scheduleSync() {
  window.clearTimeout(scheduleSync.timer);
  scheduleSync.timer = window.setTimeout(syncReadingExperience, 90);
}

function syncReadingExperience() {
  const match = window.location.pathname.match(/^\/news\/(mlb|nfl|nba|nhl)\/([^/]+)\/?$/i);
  if (!match) {
    activeArticleKey = '';
    removeReadingUI();
    return;
  }

  const sport = match[1].toLowerCase();
  const page = document.querySelector('.article-page');
  const hero = page?.querySelector('.article-hero');
  const bodySegments = [...(page?.querySelectorAll('.article-body') || [])];
  if (!page || !hero || !bodySegments.length) return;

  const key = `${sport}:${decodeURIComponent(match[2])}`;
  if (activeArticleKey === key && document.querySelector('.pbe-reading-progress')) {
    // Entity imagery is hydrated asynchronously by site-enhancements. Keep
    // checking the same article so team chips become real navigation as soon
    // as they arrive without rebuilding the rest of the reading UI.
    wireTeamEntityLinks(sport);
    if (!document.querySelector('.pbe-article-outline')) addOutline(page, bodySegments);
    scheduleProgress();
    return;
  }
  activeArticleKey = key;

  removeReadingUI();
  addProgressBar();
  addReadTime(hero, bodySegments);
  addOutline(page, bodySegments);
  wireTeamEntityLinks(sport);
  scheduleProgress();
}

function addProgressBar() {
  const bar = document.createElement('div');
  bar.className = 'pbe-reading-progress';
  bar.setAttribute('aria-hidden', 'true');
  bar.innerHTML = '<span></span>';
  document.body.appendChild(bar);
}

function addReadTime(hero, bodySegments) {
  if (hero.querySelector('.pbe-read-time')) return;
  const text = bodySegments.map((segment) => segment.textContent || '').join(' ');
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (!words) return;
  const minutes = Math.max(1, Math.round(words / 225));
  const byline = hero.querySelector('.article-byline');
  if (!byline) return;

  const separator = document.createElement('span');
  separator.className = 'pbe-read-time-separator';
  separator.textContent = '·';
  separator.style.color = 'var(--paper-subtle)';

  const readTime = document.createElement('span');
  readTime.className = 'pbe-read-time';
  readTime.textContent = `${minutes} min read`;
  byline.append(separator, readTime);
}

function addOutline(page, bodySegments) {
  if (page.querySelector('.pbe-article-outline')) return;
  const headings = bodySegments
    .flatMap((segment) => [...segment.querySelectorAll('h2, h3')])
    .filter((heading) => String(heading.textContent || '').trim().length > 2)
    .slice(0, 8);
  if (headings.length < 2) return;

  headings.forEach((heading, index) => {
    if (!heading.id) heading.id = `story-${slugifyEntity(heading.textContent) || `section-${index + 1}`}`;
  });

  const outline = document.createElement('details');
  outline.className = 'pbe-article-outline';
  outline.open = window.matchMedia('(min-width: 900px)').matches;
  outline.innerHTML = `
    <summary>
      <span><b>IN THIS STORY</b><strong>${headings.length} sections</strong></span>
      <i>+</i>
    </summary>
    <nav aria-label="Article sections">
      ${headings.map((heading, index) => `
        <a href="#${escapeAttr(heading.id)}" data-outline-index="${index}">
          <span>${String(index + 1).padStart(2, '0')}</span>${escapeHtml(heading.textContent.trim())}
        </a>
      `).join('')}
    </nav>
  `;

  outline.addEventListener('click', (event) => {
    const link = event.target?.closest?.('a[href^="#"]');
    if (!link) return;
    const target = document.getElementById(link.getAttribute('href').slice(1));
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    history.replaceState(history.state, '', `${window.location.pathname}${link.getAttribute('href')}`);
  });

  bodySegments[0].insertAdjacentElement('beforebegin', outline);
}

function wireTeamEntityLinks(sport) {
  document.querySelectorAll('.pbe-story-entity.team:not([data-pbe-entity-linked])').forEach((entity) => {
    const name = entity.querySelector('.pbe-story-entity-name')?.textContent?.trim();
    if (!name) return;
    entity.dataset.pbeEntityLinked = '1';
    entity.setAttribute('role', 'link');
    entity.setAttribute('tabindex', '0');
    entity.setAttribute('aria-label', `Open ${name} team intelligence`);
    const go = () => {
      const href = `/team/${sport}/${slugifyEntity(name)}`;
      window.history.pushState({}, '', href);
      window.dispatchEvent(new PopStateEvent('popstate'));
    };
    entity.addEventListener('click', go);
    entity.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        go();
      }
    });
  });
}

function scheduleProgress() {
  if (frame) cancelAnimationFrame(frame);
  frame = requestAnimationFrame(updateProgress);
}

function updateProgress() {
  frame = null;
  const page = document.querySelector('.article-page');
  const bar = document.querySelector('.pbe-reading-progress > span');
  if (!page || !bar) return;

  const rect = page.getBoundingClientRect();
  const absoluteTop = window.scrollY + rect.top;
  const start = absoluteTop + Math.min(260, rect.height * 0.12);
  const end = absoluteTop + Math.max(rect.height - window.innerHeight * 0.55, 1);
  const progress = end <= start ? 1 : clamp((window.scrollY - start) / (end - start), 0, 1);
  bar.style.transform = `scaleX(${progress})`;
}

function removeReadingUI() {
  document.querySelector('.pbe-reading-progress')?.remove();
  document.querySelector('.pbe-article-outline')?.remove();
  document.querySelectorAll('.pbe-read-time, .pbe-read-time-separator').forEach((node) => node.remove());
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function escapeAttr(value) {
  return escapeHtml(value);
}
