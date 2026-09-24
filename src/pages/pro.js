import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { organizationSchema, websiteSchema, breadcrumbSchema, injectSchemas } from '../schema.js';
import { buildProHtml, proMeta, proSchema, checkoutSucceeded, ALL_ACCESS } from '../pro-content.js';

/* /pro — PropBetEdge All Access, the network membership page.
 * ?checkout=success is Stripe's success redirect for the live payment link. */
export function renderPro(root, setMeta) {
  const checkoutSuccess = checkoutSucceeded(window.location.search);
  setMeta?.(proMeta({ checkoutSuccess }));

  injectSchemas([
    organizationSchema(),
    websiteSchema(),
    breadcrumbSchema([
      { name: 'Home', url: '/' },
      { name: 'All Access' },
    ]),
    proSchema(),
  ], 'jsonld-pro');

  root.innerHTML = `
    ${renderHeader()}
    <main>
      <div class="container">
        ${buildProHtml({ checkoutSuccess })}
      </div>
    </main>
    ${renderFooter()}
  `;

  wireCopyButtons(root);
  if (checkoutSuccess) trackSuccess();
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
