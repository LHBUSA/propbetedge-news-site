import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { renderShareBar, mountShareBars } from '../entity-graph/share-bar.js';
import { buildProHtml, checkoutSucceeded, ALL_ACCESS } from '../pro-content.js';
import { proHeadMeta, proSocialTags, proJsonLd, PRO_CANONICAL, PRO_SHARE_TITLE } from '../pro-seo.js';

/* /pro — PropBetEdge All Access, the network membership page.
 * ?checkout=success is Stripe's success redirect for the live payment link.
 *
 * Head parity: Edge Middleware already served the authoritative title,
 * description, canonical, robots, Open Graph, Twitter and JSON-LD from
 * src/pro-seo.js. Hydration re-applies the SAME values (never the generic site
 * defaults) and updates the server schema in place, so a crawler and a browser
 * describe one product. */
export function renderPro(root, setMeta) {
  const checkoutSuccess = checkoutSucceeded(window.location.search);
  const head = proHeadMeta({ checkoutSuccess });
  setMeta?.({ title: head.title, description: head.description, canonical: head.canonical, ogImage: head.image.url });
  applyHeadContract(head);

  root.innerHTML = `
    ${renderHeader()}
    <main>
      <div class="container">
        ${buildProHtml({ checkoutSuccess, shareBar: renderShareBar(PRO_CANONICAL, PRO_SHARE_TITLE, { compact: true, subject: 'PropBetEdge All Access' }) })}
      </div>
    </main>
    ${renderFooter()}
  `;

  mountShareBars(root);
  wireCopyButtons(root);
  if (checkoutSuccess) trackSuccess();
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
