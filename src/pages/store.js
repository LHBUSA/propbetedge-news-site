/**
 * src/pages/store.js
 *
 * /store — the collection landing page.
 *
 * Written to look like a collection rather than a merch tab bolted onto a
 * news site. Dark ground, gold rules, generous type, no ecommerce chrome.
 *
 * When fulfilment is not connected the page still ships. It shows the
 * collection honestly and says checkout is not open yet, because a store that
 * looks buyable and fails at the button is worse than one that tells you.
 */
import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { COLLECTIONS, featured, formatPrice, inCollection } from '../store/catalog.js';
import { loadShared, merge } from '../store/shared.js';
import { count as cartCount } from '../store/cart.js';
import { track } from '../store/analytics.js';
import { designPreview } from '../store/mockups.js';
import { injectSchemas, organizationSchema, breadcrumbSchema } from '../schema.js';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function card(p) {
  return `
    <a class="st-card" href="/store/${esc(p.slug)}" data-slug="${esc(p.slug)}">
      <span class="st-card-art">${designPreview(p)}</span>
      <span class="st-card-meta">
        <span class="st-card-name">${esc(p.name)}</span>
        <span class="st-card-price">${esc(formatPrice(p.retail_price, p.currency))}</span>
      </span>
    </a>`;
}

export async function renderStore(root, setMeta, params = {}) {
  const active = params.collection && COLLECTIONS.some((c) => c.slug === params.collection) ? params.collection : 'all';
  const products = inCollection(active);
  /* Availability is the shared catalog's answer, not this build's. */
  const cat = await loadShared();
  const open = [...cat.byslug.values()].some((x) => x.purchasable === true);

  if (setMeta) {
    setMeta({
      title: 'PropBetEdge Store — Wear the edge',
      description: 'The PropBetEdge collection: logo tees, hoodies, embroidered hats and mugs for people who read the number before the narrative. Made to order.',
      canonical: 'https://propbetedge.ai/store',
    });
  }

  injectSchemas([
    organizationSchema(),
    breadcrumbSchema([{ name: 'Home', url: 'https://propbetedge.ai/' }, { name: 'Store', url: 'https://propbetedge.ai/store' }]),
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'PropBetEdge Store',
      url: 'https://propbetedge.ai/store',
      description: 'The PropBetEdge collection. Made to order, printed and shipped by a third-party production partner.',
    },
  ]);

  root.innerHTML = `
    ${renderHeader()}
    <main class="st">
      <section class="st-hero">
        <div class="st-wrap">
          <p class="st-eyebrow">PropBetEdge Store</p>
          <h1>Wear the edge.</h1>
          <p class="st-lede">Built for people who read the number before the narrative. Ten pieces, made to order, no casino gift shop.</p>
          ${open ? '' : `<p class="st-notice"><b>Checkout opens soon.</b> ${cat.state === 'ok'
            ? 'The collection is finished; fulfilment is being connected. Nothing can be ordered yet, and nothing is being charged.'
            : 'Availability could not be confirmed with the shared catalog just now, so nothing can be ordered. Nothing is being charged.'}</p>`}
        </div>
      </section>

      <section class="st-wrap st-collections" aria-label="Collections">
        <a class="st-chip${active === 'all' ? ' on' : ''}" href="/store">All</a>
        ${COLLECTIONS.map((c) => `<a class="st-chip${active === c.slug ? ' on' : ''}" href="/store?c=${esc(c.slug)}">${esc(c.name)}</a>`).join('')}
      </section>

      ${active === 'all' ? `
      <section class="st-wrap st-featured" aria-label="Featured">
        <h2 class="st-h2">Featured</h2>
        <div class="st-grid st-grid-feature">${featured().map(card).join('')}</div>
      </section>` : ''}

      <section class="st-wrap st-all" aria-label="Products">
        <h2 class="st-h2">${active === 'all' ? 'The collection' : esc(COLLECTIONS.find((c) => c.slug === active).name)}</h2>
        ${active !== 'all' ? `<p class="st-collection-blurb">${esc(COLLECTIONS.find((c) => c.slug === active).blurb)}</p>` : ''}
        <div class="st-grid">${products.map(card).join('')}</div>
      </section>

      <section class="st-wrap st-made" aria-label="How it is made">
        <h2 class="st-h2">Made to order</h2>
        <p>Every piece is printed when you order it, by a third-party production partner, and shipped directly to you. Nothing sits in a warehouse and nothing is printed speculatively. That keeps the collection small and the quality consistent, and it means production takes a few days before your parcel ships.</p>
        <p class="st-fine">PropBetEdge does not hold inventory. Production and shipping are handled by our fulfilment partner. <a href="/store/policies">Shipping, returns and defect policy →</a></p>
      </section>
    </main>
    ${renderFooter()}
  `;

  track('store_view', { collection: active, products: products.length, purchasable: open });
  updateCartBadge();
}

export function updateCartBadge() {
  const n = cartCount();
  document.querySelectorAll('[data-cart-count]').forEach((el) => {
    el.textContent = n > 0 ? String(n) : '';
    el.hidden = n === 0;
  });
}
