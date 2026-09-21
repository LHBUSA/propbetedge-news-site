/**
 * src/entity-graph/share-bar.js
 *
 * Article share controls, rendered identically on the edge and in the browser.
 *
 * Set: Share (native) · Copy link · X · LinkedIn.
 * Facebook, Reddit and Bluesky are deliberately absent — PropBetEdge does not
 * maintain those surfaces, and a share row that promotes a platform we are not
 * on is an invitation to send readers somewhere we cannot follow.
 *
 * Every target uses the canonical article URL. No campaign parameters, no
 * tracking suffixes: a shared link must never mint a query-string variant that
 * competes with the canonical in search.
 *
 * Progressive enhancement is preserved from the original implementation:
 * the network targets are real anchors that work with JavaScript off, while
 * Copy link and the native share sheet are buttons the client upgrades.
 */

/**
 * Inline SVG, 16px, currentColor. Five tiny icons do not justify an icon font
 * or a third-party library, and inlining keeps them crisp and themable.
 * Each is aria-hidden because the visible label already names the action.
 */
const ICONS = {
  share: '<path d="M12 2.5l4.2 4.2-1.4 1.4-1.8-1.8V14h-2V6.3L9.2 8.1 7.8 6.7 12 2.5z"/>'
    + '<path d="M5 12v7h14v-7h2v9H3v-9h2z"/>',

  link: '<path d="M9.9 14.1a3.5 3.5 0 010-4.95l2.83-2.83a3.5 3.5 0 014.95 4.95l-1.42 1.41-1.41-1.41 1.41-1.42a1.5 1.5 0 10-2.12-2.12l-2.83 2.83a1.5 1.5 0 000 2.12l-1.41 1.42z"/>'
    + '<path d="M14.1 9.9a3.5 3.5 0 010 4.95l-2.83 2.83a3.5 3.5 0 01-4.95-4.95l1.42-1.41 1.41 1.41-1.41 1.42a1.5 1.5 0 102.12 2.12l2.83-2.83a1.5 1.5 0 000-2.12l1.41-1.42z"/>',

  // Official X mark.
  x: '<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.451-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644z"/>',

  // LinkedIn "in" mark.
  linkedin: '<path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>',
};

function icon(name) {
  return `<svg class="pbe-share-icon" viewBox="0 0 24 24" width="16" height="16"`
    + ` fill="currentColor" aria-hidden="true" focusable="false">${ICONS[name]}</svg>`;
}

export function renderShareBar(canonicalUrl, title, options = {}) {
  const url = String(canonicalUrl || '');
  if (!url) return '';
  const text = String(title || '').trim();
  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(text);
  const compact = options.compact !== false;

  // LinkedIn's share flow reads the destination's OpenGraph tags rather than a
  // title parameter, which is exactly why the article OG set has to be right.
  const targets = [
    {
      key: 'x',
      label: 'X',
      href: `https://x.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
      accessible: `Share this article on X`,
    },
    {
      key: 'linkedin',
      label: 'LinkedIn',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      accessible: `Share this article on LinkedIn`,
    },
  ];

  const networks = targets.map((target) => `<a class="pbe-share-btn pbe-share-btn--${target.key}"`
    + ` href="${attr(target.href)}" target="_blank" rel="noopener noreferrer nofollow"`
    + ` data-pbe-share="${attr(target.key)}" aria-label="${attr(target.accessible)} (opens in a new tab)">`
    + icon(target.key)
    + `<span class="pbe-share-label">${esc(target.label)}</span>`
    + `</a>`).join('');

  return `<div class="pbe-share-bar${compact ? ' pbe-share-bar--compact' : ''}" data-pbe-share-bar`
    + ` data-share-url="${attr(url)}" data-share-title="${attr(text)}">`
    + `<span class="pbe-share-heading" aria-hidden="true">Share</span>`
    // aria-label rather than aria-labelledby: two share bars can legitimately
    // exist in one document (server markup and client render overlapping), and
    // a duplicated id would be invalid DOM.
    + `<div class="pbe-share-actions" role="group" aria-label="Share this article">`
    + `<button type="button" class="pbe-share-btn pbe-share-btn--native" data-pbe-share-native hidden>`
    + icon('share')
    + `<span class="pbe-share-label">Share</span>`
    + `</button>`
    + `<button type="button" class="pbe-share-btn pbe-share-btn--copy" data-pbe-share-copy>`
    + icon('link')
    + `<span class="pbe-share-label" data-pbe-copy-label>Copy link</span>`
    + `</button>`
    + networks
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

    // Only revealed where the platform actually supports it — a dead button is
    // worse than no button.
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

export { ICONS };
