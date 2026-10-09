import { intlHead, intlHtml, viaFrom } from '../global/intl-pages.js';

/* Global #67: /ja/pro, /ko/pro and the regional disclosures. The router hands a
 * route here only when <html lang> already matches it (a full page load, served
 * by Edge Middleware with the same HTML and head), so this renders the same bytes
 * and wires the one interactive control, the promo-code copy button. */
export function renderIntlPage(root, route, setMeta) {
  const head = intlHead(route);
  setMeta?.({ title: head.title, description: head.description, canonical: head.canonical, ogImage: head.image });
  root.innerHTML = intlHtml(route, { via: viaFrom(window.location.search) });
  for (const button of root.querySelectorAll('[data-pbe-copy]')) {
    const label = button.textContent;
    button.addEventListener('click', async () => {
      const code = button.getAttribute('data-pbe-copy');
      try {
        await navigator.clipboard.writeText(code);
        button.textContent = button.getAttribute('data-pbe-copy-done') || label;
        setTimeout(() => { button.textContent = label; }, 1800);
      } catch {
        button.textContent = code;
      }
    });
  }
}
