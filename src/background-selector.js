const STORAGE_SCENE = 'pbe_background_scene_v2';
const STORAGE_AUTO = 'pbe_background_auto_v2';
const VALID_SPORTS = new Set(['mlb', 'nfl', 'nba', 'nhl']);

const PREVIEW_IMAGES = {
  mlb: 'https://images.unsplash.com/photo-1778050203444-90920c7a5652?auto=format&fit=crop&w=680&q=66',
  nfl: 'https://images.unsplash.com/photo-1781650104690-a5309d91a26b?auto=format&fit=crop&w=680&q=66',
  nba: 'https://images.unsplash.com/photo-1771882856158-c8e083134ee3?auto=format&fit=crop&w=680&q=66',
  nhl: 'https://images.unsplash.com/photo-1614239039918-3653d97bf483?auto=format&fit=crop&w=680&q=66',
};

// League-first ordering keeps the four core sports together, then presents
// alternate looks and finally the two PBE-wide atmospheres.
const SCENES = {
  mlb: { label: 'MLB', name: 'Ballpark Lights', note: 'Baseball after dark', preview: PREVIEW_IMAGES.mlb },
  nfl: { label: 'NFL', name: 'Stadium Night', note: 'Sunday under the lights', preview: PREVIEW_IMAGES.nfl },
  nba: { label: 'NBA', name: 'Arena Glow', note: 'Courtside atmosphere', preview: PREVIEW_IMAGES.nba },
  nhl: { label: 'NHL', name: 'Ice House', note: 'Cold rink intensity', preview: PREVIEW_IMAGES.nhl },
  'mlb-summer': { label: 'MLB', name: 'Summer Classic', note: 'Warm ballpark energy', preview: PREVIEW_IMAGES.mlb },
  'nfl-gridiron': { label: 'NFL', name: 'Gridiron Gold', note: 'Field-level football energy', preview: PREVIEW_IMAGES.nfl },
  'nba-hardwood': { label: 'NBA', name: 'Hardwood Night', note: 'Warm arena floor lights', preview: PREVIEW_IMAGES.nba },
  'nhl-blueline': { label: 'NHL', name: 'Blue Line', note: 'Clean rink-side atmosphere', preview: PREVIEW_IMAGES.nhl },
  network: { label: 'PBE', name: 'Network Night', note: 'Signature black + gold', preview: null },
  blackout: { label: 'PBE', name: 'Blackout', note: 'Maximum focus, minimal photo', preview: null },
};

const VALID_SCENES = new Set(Object.keys(SCENES));
const FOLLOW_SCENE = {
  mlb: 'mlb',
  nfl: 'nfl',
  nba: 'nba',
  nhl: 'nhl',
};

let initialized = false;
let observer = null;
let routeSyncTimer = null;
let transitionTimer = null;
let manualScene = 'network';
let autoScene = true;
let viewSportHint = null;
let lastPathname = '';

export function initBackgroundSelector() {
  if (initialized || typeof window === 'undefined' || typeof document === 'undefined') return;
  initialized = true;

  manualScene = readStoredScene() || readLegacyScene() || 'network';
  autoScene = readStoredAuto();
  lastPathname = window.location.pathname;

  patchHistorySignals();
  applyResolvedScene(false);
  ensureSelector();

  document.addEventListener('click', handleDocumentClick);
  document.addEventListener('keydown', handleKeydown);
  window.addEventListener('popstate', handleLocationChange);
  window.addEventListener('pbe:locationchange', handleLocationChange);
  window.addEventListener('pbe:sport-view', handleSportViewEvent);

  observer = new MutationObserver(() => {
    ensureSelector();
    if (window.location.pathname !== lastPathname) handleLocationChange();
    else scheduleRouteSync();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

function ensureSelector() {
  const nav = document.querySelector('.masthead-right');
  if (!nav || nav.querySelector('.pbe-scene-control')) return;

  const control = document.createElement('div');
  control.className = 'pbe-scene-control';
  control.innerHTML = `
    <button class="pbe-scene-trigger" type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="pbe-scene-panel">
      <span class="pbe-scene-trigger-icon" aria-hidden="true">◈</span>
      <span class="pbe-scene-trigger-label">Background</span>
      <span class="pbe-scene-trigger-value">${escapeHtml(triggerLabel())}</span>
      <span class="pbe-scene-chevron" aria-hidden="true">▼</span>
    </button>
    <div class="pbe-scene-panel" id="pbe-scene-panel" role="dialog" aria-label="Choose your sports background" hidden>
      <div class="pbe-scene-panel-head">
        <div>
          <span class="pbe-scene-panel-kicker">YOUR PBE · YOUR ATMOSPHERE</span>
          <strong class="pbe-scene-panel-title">Choose the backdrop.</strong>
          <span class="pbe-scene-panel-sub">Ten looks. Four leagues. One PropBetEdge system.</span>
        </div>
        <button class="pbe-scene-close" type="button" aria-label="Close background selector">×</button>
      </div>
      <div class="pbe-scene-grid" role="group" aria-label="Sports backgrounds">
        ${Object.entries(SCENES).map(([key, scene]) => `
          <button class="pbe-scene-option" type="button" data-scene="${key}" aria-pressed="false">
            <span class="pbe-scene-preview" aria-hidden="true"${scene.preview ? ` style="background-image:url('${escapeHtml(scene.preview)}')"` : ''}>
              <span class="pbe-scene-league">${scene.label}</span>
            </span>
            <span class="pbe-scene-copy">
              <strong>${scene.name}</strong>
              <small>${scene.note}</small>
            </span>
          </button>
        `).join('')}
      </div>
      <label class="pbe-scene-auto">
        <input class="pbe-scene-auto-input" type="checkbox" ${autoScene ? 'checked' : ''} />
        <span class="pbe-scene-auto-toggle" aria-hidden="true"></span>
        <span class="pbe-scene-auto-copy">
          <strong>Follow what I’m viewing</strong>
          <small>News, articles, leader pages and PBEcast sport filters automatically match MLB, NFL, NBA or NHL.</small>
        </span>
      </label>
      <div class="pbe-scene-follow-status" aria-live="polite"></div>
    </div>
  `;

  const cta = nav.querySelector('.nav-link.cta');
  if (cta) nav.insertBefore(control, cta);
  else nav.appendChild(control);

  control.querySelector('.pbe-scene-trigger')?.addEventListener('click', (event) => {
    event.stopPropagation();
    togglePanel(control);
  });

  control.querySelector('.pbe-scene-close')?.addEventListener('click', () => closePanel(control));

  control.querySelectorAll('.pbe-scene-option').forEach((button) => {
    button.addEventListener('click', () => {
      const scene = button.dataset.scene;
      if (!VALID_SCENES.has(scene)) return;
      manualScene = scene;
      autoScene = false;
      writeStorage(STORAGE_SCENE, manualScene);
      writeStorage(STORAGE_AUTO, '0');
      applyResolvedScene(true);
      syncControlState(control);
    });
  });

  control.querySelector('.pbe-scene-auto-input')?.addEventListener('change', (event) => {
    autoScene = Boolean(event.currentTarget.checked);
    writeStorage(STORAGE_AUTO, autoScene ? '1' : '0');
    applyResolvedScene(true);
    syncControlState(control);
  });

  syncControlState(control);
}

function currentScene() {
  if (!autoScene) return VALID_SCENES.has(manualScene) ? manualScene : 'network';
  const sport = viewedSport();
  return sport ? FOLLOW_SCENE[sport] : 'network';
}

function viewedSport() {
  const fromPath = sportFromPath(window.location.pathname);
  if (fromPath) return fromPath;
  if (VALID_SPORTS.has(viewSportHint)) return viewSportHint;
  return sportFromActiveControls();
}

function sportFromActiveControls() {
  const selectors = [
    '#gh5-sport-tabs [data-sport].active',
    '.sport-tabs [data-sport].active',
    '.odds-sport-tabs [data-sport].active',
    '[role="tab"][data-sport][aria-selected="true"]',
  ];

  for (const selector of selectors) {
    const node = document.querySelector(selector);
    const sport = String(node?.dataset?.sport || '').toLowerCase();
    if (VALID_SPORTS.has(sport)) return sport;
    if (sport === 'all') return null;
  }
  return null;
}

function applyResolvedScene(animate = true) {
  const scene = currentScene();
  if (!VALID_SCENES.has(scene)) return;

  if (animate && document.body.dataset.pbeScene && document.body.dataset.pbeScene !== scene) {
    document.body.classList.add('pbe-scene-transition');
    clearTimeout(transitionTimer);
    transitionTimer = setTimeout(() => {
      document.body.dataset.pbeScene = scene;
      requestAnimationFrame(() => document.body.classList.remove('pbe-scene-transition'));
    }, 115);
  } else {
    document.body.dataset.pbeScene = scene;
  }

  document.querySelectorAll('.pbe-scene-control').forEach(syncControlState);
}

function syncControlState(control) {
  if (!(control instanceof Element)) return;
  const scene = currentScene();
  const sceneMeta = SCENES[scene] || SCENES.network;
  const sport = viewedSport();
  const value = control.querySelector('.pbe-scene-trigger-value');
  if (value) value.textContent = triggerLabel();

  control.querySelectorAll('.pbe-scene-option').forEach((button) => {
    button.setAttribute('aria-pressed', button.dataset.scene === scene ? 'true' : 'false');
  });

  const autoInput = control.querySelector('.pbe-scene-auto-input');
  if (autoInput) autoInput.checked = autoScene;

  const status = control.querySelector('.pbe-scene-follow-status');
  if (status) {
    status.textContent = autoScene
      ? `AUTO · Following ${sport ? sport.toUpperCase() : 'the PBE network'} · ${sceneMeta.name}`
      : `MANUAL · ${sceneMeta.label} · ${sceneMeta.name}`;
    status.classList.toggle('is-auto', autoScene);
  }
}

function triggerLabel() {
  const scene = currentScene();
  const sceneMeta = SCENES[scene] || SCENES.network;
  return autoScene ? `AUTO · ${sceneMeta.label}` : sceneMeta.label;
}

function togglePanel(control) {
  const panel = control.querySelector('.pbe-scene-panel');
  const trigger = control.querySelector('.pbe-scene-trigger');
  if (!panel || !trigger) return;

  const opening = panel.hidden;
  closeAllPanels();
  panel.hidden = !opening;
  trigger.setAttribute('aria-expanded', opening ? 'true' : 'false');
  if (opening) syncControlState(control);
}

function closePanel(control) {
  const panel = control.querySelector('.pbe-scene-panel');
  const trigger = control.querySelector('.pbe-scene-trigger');
  if (panel) panel.hidden = true;
  if (trigger) trigger.setAttribute('aria-expanded', 'false');
}

function closeAllPanels() {
  document.querySelectorAll('.pbe-scene-control').forEach(closePanel);
}

function handleDocumentClick(event) {
  const sportControl = event.target.closest?.(
    '#gh5-sport-tabs [data-sport], .sport-tabs [data-sport], .odds-sport-tabs [data-sport], [role="tab"][data-sport]'
  );

  if (sportControl) {
    const sport = String(sportControl.dataset.sport || '').toLowerCase();
    viewSportHint = VALID_SPORTS.has(sport) ? sport : null;
    if (autoScene) setTimeout(() => applyResolvedScene(true), 0);
  }

  const internalLink = event.target.closest?.('a[href^="/"]');
  if (internalLink) setTimeout(handleLocationChange, 0);

  if (event.target.closest?.('.pbe-scene-control')) return;
  closeAllPanels();
}

function handleKeydown(event) {
  if (event.key !== 'Escape') return;
  const openControl = [...document.querySelectorAll('.pbe-scene-control')].find((control) => {
    const panel = control.querySelector('.pbe-scene-panel');
    return panel && !panel.hidden;
  });
  if (!openControl) return;
  closePanel(openControl);
  openControl.querySelector('.pbe-scene-trigger')?.focus();
}

function handleSportViewEvent(event) {
  const sport = String(event?.detail?.sport || '').toLowerCase();
  viewSportHint = VALID_SPORTS.has(sport) ? sport : null;
  if (autoScene) applyResolvedScene(true);
}

function handleLocationChange() {
  const pathChanged = window.location.pathname !== lastPathname;
  if (pathChanged) {
    lastPathname = window.location.pathname;
    viewSportHint = null;
  }
  scheduleRouteSync();
}

function scheduleRouteSync() {
  clearTimeout(routeSyncTimer);
  routeSyncTimer = setTimeout(() => {
    if (autoScene) applyResolvedScene(true);
    else document.querySelectorAll('.pbe-scene-control').forEach(syncControlState);
  }, 50);
}

function patchHistorySignals() {
  if (window.history.__pbeSceneSignalsPatched) return;
  window.history.__pbeSceneSignalsPatched = true;

  ['pushState', 'replaceState'].forEach((method) => {
    const original = window.history[method];
    if (typeof original !== 'function') return;
    window.history[method] = function pbeHistorySignal(...args) {
      const result = original.apply(this, args);
      window.dispatchEvent(new Event('pbe:locationchange'));
      return result;
    };
  });
}

function sportFromPath(pathname) {
  const path = String(pathname || '');
  const match = path.match(/\/(?:news|games|leaders)\/(mlb|nfl|nba|nhl)(?:\/|$)/i);
  if (match?.[1]) return match[1].toLowerCase();

  const standalone = path.match(/^\/(mlb|nfl|nba|nhl)(?:\/|$)/i);
  return standalone?.[1]?.toLowerCase() || null;
}

function readStoredScene() {
  try {
    const value = window.localStorage.getItem(STORAGE_SCENE);
    return VALID_SCENES.has(value) ? value : null;
  } catch {
    return null;
  }
}

function readLegacyScene() {
  try {
    const value = window.localStorage.getItem('pbe_background_scene_v1');
    return VALID_SCENES.has(value) ? value : null;
  } catch {
    return null;
  }
}

function readStoredAuto() {
  try {
    const value = window.localStorage.getItem(STORAGE_AUTO);
    if (value !== null) return value !== '0';
    // V2 turns follow mode on by default. Old manual state was the source of
    // the confusing "NFL background on an NBA page" behavior during rollout.
    return true;
  } catch {
    return true;
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Personalization remains available for the current page even when storage is blocked.
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
