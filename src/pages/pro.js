import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { renderShareBar, mountShareBars } from '../entity-graph/share-bar.js';
import { buildProHtml, checkoutSucceeded, memberStateFrom, ALL_ACCESS } from '../pro-content.js';
import { proHeadMeta, proSocialTags, proJsonLd, PRO_CANONICAL, PRO_SHARE_TITLE } from '../pro-seo.js';
import { proAlternates } from '../global/intl-pages.js';
import { enProAttributionFrom } from '../global/attribution.js';

/* /pro — PropBetEdge All Access, the network membership page.
 * ?checkout=success is Stripe's success redirect for the live payment link.
 *
 * Membership: the page first renders the public sales page, then asks the
 * network auth server (auth.propbetedge.ai/membership, credentialed CORS) who
 * the visitor is. Only a server verdict of all_access or owner swaps the
 * purchase CTAs for Command Center; signed-out, sport-only, free, errors and
 * timeouts all keep the public page. Nothing is read from the URL or storage.
 *
 * Head parity: Edge Middleware already served the authoritative title,
 * description, canonical, robots, Open Graph, Twitter and JSON-LD from
 * src/pro-seo.js. Hydration re-applies the SAME values (never the generic site
 * defaults) and updates the server schema in place, so a crawler and a browser
 * describe one product. */
export function renderPro(root, setMeta) {
  const checkoutSuccess = checkoutSucceeded(window.location.search);
  // Global #67: readers from a Spanish edition keep their attribution tag on checkout.
  const attribution = enProAttributionFrom(window.location.search);
  const head = proHeadMeta({ checkoutSuccess });
  setMeta?.({ title: head.title, description: head.description, canonical: head.canonical, ogImage: head.image.url });
  applyHeadContract(head);

  const shareBar = renderShareBar(PRO_CANONICAL, PRO_SHARE_TITLE, { compact: true, subject: 'PropBetEdge All Access' });
  root.innerHTML = `
    ${renderHeader()}
    <main class="pbe-pro-main">
      ${buildProHtml({ checkoutSuccess, shareBar, attribution })}
    </main>
    ${renderFooter()}
  `;

  mountShareBars(root);
  wireCopyButtons(root);
  if (checkoutSuccess) { trackSuccess(); return; }

  readMembership().then((member) => {
    const page = root.querySelector('.pbe-pro');
    if (!member || !page || !page.isConnected) return;
    page.outerHTML = buildProHtml({ shareBar, member, attribution });
    mountShareBars(root);
    wireCopyButtons(root);
  });
}

const MEMBERSHIP_URL = 'https://auth.propbetedge.ai/membership?product=predictions';

/* Server verdict only. Resolves to 'all_access' | 'owner' | null. */
async function readMembership() {
  try {
    const res = await fetch(MEMBERSHIP_URL, {
      credentials: 'include',
      headers: { accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout?.(4000),
    });
    if (!res.ok) return null;
    return memberStateFrom(await res.json());
  } catch {
    return null;
  }
}

/* Robots + the full social set + the connected JSON-LD graph, identical to the
   server's. Managed tags are replaced in place; nothing is appended twice. */
function applyHeadContract(head) {
  upsertMeta('name', 'robots', head.robots);
  for (const [name, content] of proSocialTags()) {
    upsertMeta(name.startsWith('twitter:') ? 'name' : 'property', name, content);
  }
  document.querySelectorAll('script[type="application/ld+json"][data-managed="jsonld-pro"]').forEach((el) => el.remove());
  let script = document.getElementById('pbe-server-primary-schema');
  if (!script) {
    script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'pbe-server-primary-schema';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(proJsonLd());
  // Reciprocal hreflang with /ja/pro and /ko/pro (Global #67), as the server emits it.
  document.querySelectorAll('link[rel="alternate"][hreflang]').forEach((el) => el.remove());
  if (head.robots === 'noindex, follow') return;
  for (const a of proAlternates()) {
    const link = document.createElement('link');
    link.rel = 'alternate';
    link.hreflang = a.hreflang;
    link.href = a.url;
    document.head.appendChild(link);
  }
}

function upsertMeta(attr, name, value) {
  const all = document.querySelectorAll(`meta[${attr}="${name}"]`);
  all.forEach((el, i) => { if (i > 0) el.remove(); });
  let el = all[0];
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', value);
}

function wireCopyButtons(root) {
  for (const button of root.querySelectorAll('[data-pbe-copy]')) {
    button.addEventListener('click', async () => {
      const code = button.getAttribute('data-pbe-copy') || ALL_ACCESS.promoCode;
      try {
        await navigator.clipboard.writeText(code);
        button.textContent = 'Copied';
        button.classList.add('is-copied');
        setTimeout(() => { button.textContent = 'Copy'; button.classList.remove('is-copied'); }, 1800);
      } catch {
        button.textContent = code;
      }
    });
  }
}

function trackSuccess() {
  try {
    window.gtag?.('event', 'all_access_checkout_success', { pbe_surface: 'hub', product_key: ALL_ACCESS.productKey });
  } catch { /* analytics is optional */ }
}
