/**
 * src/entity-graph/share-bar.js
 *
 * Compact article share controls, rendered identically on the edge and in the
 * browser.
 *
 * Every target uses the canonical article URL — a share can never mint a
 * query-string variant that competes with the canonical in search.
 *
 * Progressive enhancement: the network links are real anchors that work with
 * JavaScript off; Copy Link and the native share sheet are buttons that the
 * client upgrades. Confirmation is announced politely to screen readers rather
 * than shouted.
 */

export function renderShareBar(canonicalUrl, title, options = {}) {
  const url = String(canonicalUrl || '');
  if (!url) return '';
  const text = String(title || '').trim();
  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(text);
  const compact = options.compact !== false;

  const network = (href, label, glyph) => `<a class="pbe-share-btn pbe-share-btn--${label.toLowerCase()}"`
    + ` href="${attr(href)}" target="_blank" rel="noopener noreferrer nofollow"`
    + ` data-pbe-share="${attr(label.toLowerCase())}">`
    + `<span class="pbe-share-glyph" aria-hidden="true">${glyph}</span>`
    + `<span class="pbe-share-label">${esc(label)}</span>`
    + `<span class="pbe-visually-hidden"> (opens in a new tab)</span>`
    + `</a>`;

  return `<div class="pbe-share-bar${compact ? ' pbe-share-bar--compact' : ''}" data-pbe-share-bar`
    + ` data-share-url="${attr(url)}" data-share-title="${attr(text)}">`
    + `<span class="pbe-share-heading" id="pbe-share-heading">Share</span>`
    + `<div class="pbe-share-actions" role="group" aria-labelledby="pbe-share-heading">`
    + `<button type="button" class="pbe-share-btn pbe-share-btn--native" data-pbe-share-native hidden>`
    + `<span class="pbe-share-glyph" aria-hidden="true">↗</span>`
    + `<span class="pbe-share-label">Share</span>`
    + `</button>`
    + `<button type="button" class="pbe-share-btn pbe-share-btn--copy" data-pbe-share-copy>`
    + `<span class="pbe-share-glyph" aria-hidden="true">⧉</span>`
    + `<span class="pbe-share-label" data-pbe-copy-label>Copy link</span>`
    + `</button>`
    + network(`https://x.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`, 'X', '𝕏')
    + network(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, 'Facebook', 'f')
    + network(`https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedText}`, 'Reddit', 'r')
    + `</div>`
    + `<span class="pbe-share-status pbe-visually-hidden" role="status" aria-live="polite" data-pbe-share-status></span>`
    + `</div>`;
}

/**
 * Client behaviour for any share bars currently in the document.
 * Safe to call repeatedly; each bar is only wired once.
 */
export function mountShareBars(scope = document) {
  const bars = scope.querySelectorAll('[data-pbe-share-bar]:not([data-pbe-share-ready])');
  bars.forEach((bar) => {
    bar.setAttribute('data-pbe-share-ready', '1');
    const url = bar.getAttribute('data-share-url') || window.location.href;
    const title = bar.getAttribute('data-share-title') || document.title;
    const status = bar.querySelector('[data-pbe-share-status]');

    const announce = (message) => {
      if (status) status.textContent = message;
    };

    const nativeButton = bar.querySelector('[data-pbe-share-native]');
    if (nativeButton && typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      nativeButton.hidden = false;
      nativeButton.addEventListener('click', async () => {
        try {
          await navigator.share({ title, url });
          announce('Shared.');
        } catch {
          /* the reader dismissed the sheet — not an error */
        }
      });
    }

    const copyButton = bar.querySelector('[data-pbe-share-copy]');
    const copyLabel = bar.querySelector('[data-pbe-copy-label]');
    if (copyButton) {
      copyButton.addEventListener('click', async () => {
        const copied = await copyToClipboard(url);
        if (copyLabel) {
          copyLabel.textContent = copied ? 'Copied' : 'Copy failed';
          copyButton.setAttribute('data-copied', copied ? '1' : '0');
          setTimeout(() => {
            copyLabel.textContent = 'Copy link';
            copyButton.removeAttribute('data-copied');
          }, 2200);
        }
        announce(copied ? 'Link copied to clipboard.' : 'Could not copy the link.');
      });
    }
  });
}

async function copyToClipboard(value) {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch { /* fall through to the legacy path */ }

  try {
    const field = document.createElement('textarea');
    field.value = value;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(field);
    return ok;
  } catch {
    return false;
  }
}

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function attr(value) {
  return esc(value).replace(/"/g, '&quot;');
}
