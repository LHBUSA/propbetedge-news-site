const STORAGE_SCENE = 'pbe_background_scene_v1';
const STORAGE_AUTO = 'pbe_background_auto_v1';
const VALID_SCENES = new Set(['mlb', 'nfl', 'nba', 'nhl']);

const SCENES = {
  mlb: { label: 'MLB', name: 'Ballpark lights', note: 'Baseball after dark' },
  nfl: { label: 'NFL', name: 'Stadium night', note: 'Sunday under the lights' },
  nba: { label: 'NBA', name: 'Arena glow', note: 'Courtside atmosphere' },
  nhl: { label: 'NHL', name: 'Ice house', note: 'Cold rink intensity' },
};

let initialized = false;
let observer = null;
let routeSyncTimer = null;
let transitionTimer = null;
let manualScene = 'mlb';
let autoScene = true;

export function initBackgroundSelector() {
  if (initialized || typeof window === 'undefined' || typeof document === 'undefined') return;
  initialized = true;

  manualScene = readStoredScene() || 'mlb';
  autoScene = readStoredAuto();

  applyResolvedScene(false);
  ensureSelector();

  document.addEventListener('click', handleDocumentClick);
  document.addEventListener('keydown', handleKeydown);
  window.addEventListener('popstate', scheduleRouteSync);

  observer = new MutationObserver(() => {
    ensureSelector();
    scheduleRouteSync();
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
      <span class="pbe-scene-trigger-value">${escapeHtml(SCENES[currentScene()]?.label || 'MLB')}</span>
      <span class="pbe-scene-chevron" aria-hidden="true">▼</span>
    </button>
    <div class="pbe-scene-panel" id="pbe-scene-panel" role="dialog" aria-label="Choose your sports background" hidden>
      <div class="pbe-scene-panel-head">
        <div>
          <span class="pbe-scene-panel-kicker">YOUR PBE · YOUR ATMOSPHERE</span>
          <strong class="pbe-scene-panel-title">Choose the backdrop.</strong>
        </div>
        <button class="pbe-scene-close" type="button" aria-label="Close background selector">×</button>
      </div>
      <div class="pbe-scene-grid" role="group" aria-label="Sports backgrounds">
        ${Object.entries(SCENES).map(([key, scene]) => `
          <button class="pbe-scene-option" type="button" data-scene="${key}" aria-pressed="false">
            <span class="pbe-scene-preview" aria-hidden="true"><span class="pbe-scene-league">${scene.label}</span></span>
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
          <small>Automatically match MLB, NFL, NBA or NHL pages.</small>
        </span>
      </label>
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
  return autoScene ? (sportFromPath(window.location.pathname) || manualScene) : manualScene;
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
  const value = control.querySelector('.pbe-scene-trigger-value');
  if (value) value.textContent = SCENES[scene]?.label || 'MLB';

  control.querySelectorAll('.pbe-scene-option').forEach((button) => {
    button.setAttribute('aria-pressed', button.dataset.scene === scene ? 'true' : 'false');
  });

  const autoInput = control.querySelector('.pbe-scene-auto-input');
  if (autoInput) autoInput.checked = autoScene;
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

function scheduleRouteSync() {
  clearTimeout(routeSyncTimer);
  routeSyncTimer = setTimeout(() => {
    if (autoScene) applyResolvedScene(true);
    else document.querySelectorAll('.pbe-scene-control').forEach(syncControlState);
  }, 60);
}

function sportFromPath(pathname) {
  const match = String(pathname || '').match(/\/(?:news|games|leaders)\/(mlb|nfl|nba|nhl)(?:\/|$)/i);
  return match?.[1]?.toLowerCase() || null;
}

function readStoredScene() {
  try {
    const value = window.localStorage.getItem(STORAGE_SCENE);
    return VALID_SCENES.has(value) ? value : null;
  } catch {
    return null;
  }
}

function readStoredAuto() {
  try {
    const value = window.localStorage.getItem(STORAGE_AUTO);
    return value === null ? true : value !== '0';
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
