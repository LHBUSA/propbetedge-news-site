/* Search on pages served without the full app (src/pro-entry.js).
 *
 * The palette (src/search-palette.js) carries the entity dictionary, so it is
 * loaded on first use instead of with the page. The same three triggers open
 * it: a [data-pbe-search-open] control, Cmd/Ctrl+K and '/' outside a text
 * field, and the 'pbe:open-search' event. After the module loads it installs
 * its own listeners and these stand down. */
let loading = null;
let ready = false;

function openPalette() {
  if (!loading) {
    loading = import('./search-palette.js').then((m) => {
      m.initSearchPalette();
      ready = true;
      return m;
    });
  }
  return loading.then(() => window.dispatchEvent(new Event('pbe:open-search')));
}

function onClick(event) {
  if (ready) return;
  const trigger = event.target?.closest?.('[data-pbe-search-open]');
  if (!trigger) return;
  event.preventDefault();
  openPalette();
}

function onKeydown(event) {
  if (ready) return;
  const target = event.target;
  const editing = target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
    || target?.isContentEditable;
  if (editing) return;
  const commandK = (event.metaKey || event.ctrlKey) && String(event.key).toLowerCase() === 'k';
  const slash = event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey;
  if (!commandK && !slash) return;
  event.preventDefault();
  openPalette();
}

function onOpenEvent() {
  if (!ready) openPalette();
}

export function initLazySearch() {
  if (typeof document === 'undefined') return;
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKeydown, true);
  window.addEventListener('pbe:open-search', onOpenEvent);
}
