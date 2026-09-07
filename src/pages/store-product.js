/**
 * src/pages/store-product.js
 *
 * /store/:slug — one product.
 *
 * Mobile first: the art stacks above the buy panel below 900px and every
 * control is a real button with a real hit area. Size and colour are chosen
 * before anything can be added, because a cart line without a variant cannot
 * be fulfilled and there is no sensible default to guess.
 */
import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { bySlug, formatPrice } from '../store/catalog.js';
import { canBuy, loadShared, merge } from '../store/shared.js';
import { add } from '../store/cart.js';
import { track } from '../store/analytics.js';
import { productArt } from '../store/mockups.js';
import { updateCartBadge } from './store.js';
import { injectSchemas, organizationSchema, breadcrumbSchema } from '../schema.js';
import { renderNotFound } from './404.js';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export async function renderStoreProduct(root, setMeta, slug) {
  const local = bySlug(slug);
  if (!local) return renderNotFound(root, setMeta);

  /* Price, options and availability are re-resolved from the authoritative
   * records at render time. The build-time file supplies copy only; it cannot
   * know what has been provisioned since it shipped. */
  const cat = await loadShared();
  const p = merge(local, cat.byslug.get(slug));
  const open = p.purchasable;
  const art = productArt(local);

  if (setMeta) {
    setMeta({
      title: `${p.name} — PropBetEdge Store`,
      description: p.description.slice(0, 160),
      canonical: `https://propbetedge.ai/store/${p.slug}`,
    });
  }

  injectSchemas([
    organizationSchema(),
    breadcrumbSchema([
      { name: 'Home', url: 'https://propbetedge.ai/' },
      { name: 'Store', url: 'https://propbetedge.ai/store' },
      { name: p.name, url: `https://propbetedge.ai/store/${p.slug}` },
    ]),
    {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: p.name,
      description: p.description,
      brand: { '@type': 'Brand', name: 'PropBetEdge' },
      /* Availability is asserted only when we can actually fulfil. Claiming
       * InStock for a made-to-order item with no provider mapping would be a
       * false structured-data claim. */
      offers: {
        '@type': 'Offer',
        price: (p.retail_price / 100).toFixed(2),
        priceCurrency: p.currency.toUpperCase(),
        url: `https://propbetedge.ai/store/${p.slug}`,
        availability: open ? 'https://schema.org/MadeToOrder' : 'https://schema.org/PreOrder',
      },
    },
  ]);

  root.innerHTML = `
    ${renderHeader()}
    <main class="st st-pdp">
      <div class="st-wrap">
        <nav class="st-crumbs"><a href="/store">← The collection</a></nav>
        <div class="st-pdp-grid">
          <figure class="st-pdp-art">
            ${art.html}
            <figcaption class="st-art-label${art.isProvider ? ' is-provider' : ''}">${esc(art.label)}</figcaption>
          </figure>

          <div class="st-pdp-buy">
            <p class="st-eyebrow">${esc(p.collection === 'fight-dna' ? 'Fight DNA' : p.collection === 'data' ? 'Data & Model' : 'PropBetEdge')}</p>
            <h1>${esc(p.name)}</h1>
            <p class="st-price">${esc(formatPrice(p.retail_price, p.currency))}</p>
            <p class="st-desc">${esc(p.description)}</p>

            <div class="st-field">
              <label class="st-label" for="st-color">Colour</label>
              <div class="st-opts" id="st-color" role="radiogroup" aria-label="Colour">
                ${p.colors.map((c, i) => `<button type="button" class="st-opt${i === 0 ? ' on' : ''}" role="radio" aria-checked="${i === 0}" data-color="${esc(c)}">${esc(c)}</button>`).join('')}
              </div>
            </div>

            <div class="st-field">
              <label class="st-label" for="st-size">Size</label>
              <div class="st-opts" id="st-size" role="radiogroup" aria-label="Size">
                ${p.sizes.map((s) => `<button type="button" class="st-opt" role="radio" aria-checked="false" data-size="${esc(s)}">${esc(s)}</button>`).join('')}
              </div>
            </div>

            <div class="st-field st-qty-field">
              <label class="st-label" for="st-qty">Quantity</label>
              <div class="st-qty">
                <button type="button" class="st-qty-btn" data-step="-1" aria-label="Decrease quantity">−</button>
                <input id="st-qty" class="st-qty-input" type="number" min="1" max="20" value="1" inputmode="numeric">
                <button type="button" class="st-qty-btn" data-step="1" aria-label="Increase quantity">+</button>
              </div>
            </div>

            <button type="button" class="st-add" data-add ${open ? '' : 'disabled'}>
              ${open ? 'Add to cart' : esc(p.unavailable_reason || (cat.state === 'ok' ? 'Not on sale yet' : 'Availability unavailable'))}
            </button>
            <p class="st-add-msg" data-msg role="status" aria-live="polite"></p>

            <ul class="st-notes">
              <li><b>Made to order.</b> Printed for you by our third-party production partner, then shipped directly. Production usually adds a few days before dispatch.</li>
              <li><b>Shipping</b> is calculated at checkout from your address. We do not offer blanket free worldwide shipping because it is not honest about the cost.</li>
              <li><a href="/store/policies">Returns, defects and replacements →</a></li>
            </ul>
          </div>
        </div>
      </div>
    </main>
    ${renderFooter()}
  `;

  track('product_view', { slug: p.slug, collection: p.collection, price: p.retail_price });
  updateCartBadge();
  wire(root, p, open);
}

function wire(root, p, open) {
  let color = p.colors[0];
  let size = null;
  const msg = root.querySelector('[data-msg]');
  const addBtn = root.querySelector('[data-add]');

  const pick = (group, attr, set) => {
    root.querySelectorAll(`#${group} .st-opt`).forEach((b) => {
      b.addEventListener('click', () => {
        root.querySelectorAll(`#${group} .st-opt`).forEach((x) => { x.classList.remove('on'); x.setAttribute('aria-checked', 'false'); });
        b.classList.add('on');
        b.setAttribute('aria-checked', 'true');
        set(b.dataset[attr]);
        if (msg) msg.textContent = '';
      });
    });
  };
  pick('st-color', 'color', (v) => { color = v; });
  pick('st-size', 'size', (v) => { size = v; });

  const qtyInput = root.querySelector('#st-qty');
  root.querySelectorAll('.st-qty-btn').forEach((b) => b.addEventListener('click', () => {
    const next = Math.max(1, Math.min(20, (Number(qtyInput.value) || 1) + Number(b.dataset.step)));
    qtyInput.value = String(next);
  }));

  if (!addBtn) return;
  addBtn.addEventListener('click', () => {
    if (!open) return;
    if (!size) {
      msg.textContent = 'Choose a size first.';
      return;
    }
    if (!canBuy(p, size, color)) {
      msg.textContent = 'That size and colour is not available yet.';
      return;
    }
    const qty = Math.max(1, Math.min(20, Number(qtyInput.value) || 1));
    add({ slug: p.slug, size, color, qty });
    track('add_to_cart', { slug: p.slug, size, color, qty, price: p.retail_price });
    updateCartBadge();
    msg.innerHTML = `Added. <a href="/store/cart">View cart →</a>`;
  });
}
