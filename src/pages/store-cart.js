/**
 * src/pages/store-cart.js
 *
 * /store/cart — review and checkout.
 *
 * Prices shown here are resolved from the catalog at render time, never from
 * what the cart stored, and the server resolves them again before creating a
 * Stripe session. The cart is a list of intentions; it is not a quote.
 *
 * Shipping and tax are deliberately not estimated. Stripe computes tax from
 * the delivery address and shipping comes from the fulfilment provider, so
 * inventing a number here would only be wrong in a way the customer discovers
 * at the worst moment.
 */
import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { CATALOG_VERSION, formatPrice, providerConfigured } from '../store/catalog.js';
import { clear, detailed, remove, setQty, subtotal } from '../store/cart.js';
import { track } from '../store/analytics.js';
import { designPreview } from '../store/mockups.js';
import { updateCartBadge } from './store.js';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function rows() {
  const lines = detailed();
  if (!lines.length) {
    return `<div class="st-cart-empty"><p>Your cart is empty.</p><a class="btn gold" href="/store">Browse the collection →</a></div>`;
  }
  return `
    <div class="st-cart-list">
      ${lines.map((l) => `
        <div class="st-cart-row" data-slug="${esc(l.slug)}" data-size="${esc(l.size)}" data-color="${esc(l.color)}">
          <span class="st-cart-art">${designPreview(l.product, l.color)}</span>
          <span class="st-cart-info">
            <a class="st-cart-name" href="/store/${esc(l.slug)}">${esc(l.product.name)}</a>
            <span class="st-cart-var">${esc(l.size)} · ${esc(l.color)}</span>
            <button type="button" class="st-cart-remove" data-remove>Remove</button>
          </span>
          <span class="st-cart-qty">
            <button type="button" class="st-qty-btn" data-step="-1" aria-label="Decrease quantity">−</button>
            <input class="st-qty-input" type="number" min="0" max="20" value="${l.qty}" inputmode="numeric" aria-label="Quantity">
            <button type="button" class="st-qty-btn" data-step="1" aria-label="Increase quantity">+</button>
          </span>
          <span class="st-cart-price">${esc(formatPrice(l.lineTotal))}</span>
        </div>`).join('')}
    </div>`;
}

export async function renderStoreCart(root, setMeta) {
  if (setMeta) {
    setMeta({
      title: 'Cart — PropBetEdge Store',
      description: 'Your PropBetEdge Store cart.',
      canonical: 'https://propbetedge.ai/store/cart',
    });
  }
  const open = providerConfigured();

  root.innerHTML = `
    ${renderHeader()}
    <main class="st st-cart">
      <div class="st-wrap">
        <nav class="st-crumbs"><a href="/store">← The collection</a></nav>
        <h1>Cart</h1>
        <div data-cart-body>${rows()}</div>

        <div class="st-cart-foot" data-cart-foot>
          <div class="st-cart-totals">
            <div class="st-cart-line"><span>Subtotal</span><b data-subtotal>${esc(formatPrice(subtotal()))}</b></div>
            <div class="st-cart-line dim"><span>Shipping</span><b>Calculated at checkout</b></div>
            <div class="st-cart-line dim"><span>Tax</span><b>Calculated at checkout</b></div>
            <p class="st-fine">Shipping is quoted from your delivery address and tax is computed by Stripe. Neither is estimated here, because a guess would only be wrong at the moment it matters.</p>
          </div>
          <div class="st-cart-actions">
            <button type="button" class="st-add" data-checkout ${open ? '' : 'disabled'}>${open ? 'Checkout' : 'Checkout opens soon'}</button>
            <p class="st-add-msg" data-msg role="status" aria-live="polite">${open ? '' : 'The collection is finished and fulfilment is being connected. Nothing can be ordered yet.'}</p>
            <p class="st-fine">Made to order and shipped by our third-party production partner. <a href="/store/policies">Shipping &amp; returns →</a></p>
          </div>
        </div>
      </div>
    </main>
    ${renderFooter()}
  `;

  updateCartBadge();
  wire(root, open);
}

function wire(root, open) {
  const body = root.querySelector('[data-cart-body]');
  const msg = root.querySelector('[data-msg]');

  const refresh = () => {
    body.innerHTML = rows();
    root.querySelector('[data-subtotal]').textContent = formatPrice(subtotal());
    updateCartBadge();
    bindRows();
  };

  function lineOf(el) {
    const row = el.closest('.st-cart-row');
    return { slug: row.dataset.slug, size: row.dataset.size, color: row.dataset.color };
  }

  function bindRows() {
    root.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', () => {
      const l = lineOf(b);
      remove(l);
      track('remove_from_cart', l);
      refresh();
    }));
    root.querySelectorAll('.st-cart-row .st-qty-btn').forEach((b) => b.addEventListener('click', () => {
      const l = lineOf(b);
      const input = b.parentElement.querySelector('.st-qty-input');
      const next = Math.max(0, Math.min(20, (Number(input.value) || 0) + Number(b.dataset.step)));
      setQty(l, next);
      if (next === 0) track('remove_from_cart', l);
      refresh();
    }));
    root.querySelectorAll('.st-cart-row .st-qty-input').forEach((i) => i.addEventListener('change', () => {
      setQty(lineOf(i), i.value);
      refresh();
    }));
  }
  bindRows();

  const btn = root.querySelector('[data-checkout]');
  if (!btn || !open) return;
  btn.addEventListener('click', async () => {
    const lines = detailed();
    if (!lines.length) { msg.textContent = 'Your cart is empty.'; return; }
    btn.disabled = true;
    msg.textContent = 'Opening secure checkout…';
    track('checkout_started', { items: lines.length, subtotal: subtotal() });
    try {
      const res = await fetch('/api/store/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        /* Identity and quantity only. Deliberately no price: the server
         * resolves that, and sending one here would be rejected. */
        body: JSON.stringify({
          catalogVersion: CATALOG_VERSION,
          lines: lines.map((l) => ({ slug: l.slug, size: l.size, color: l.color, qty: l.qty })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) { window.location.href = data.url; return; }
      msg.textContent = data.error === 'PROVIDER_NOT_CONFIGURED'
        ? 'Checkout is not enabled yet. Nothing has been charged.'
        : `Checkout could not start (${data.error || res.status}). Nothing has been charged.`;
    } catch {
      msg.textContent = 'Checkout could not start. Nothing has been charged.';
    }
    btn.disabled = false;
  });
}

/* /store/thanks — shown after Stripe redirects back.
 *
 * This page never confirms fulfilment. The browser returning here proves only
 * that the customer came back; the order is created by the signed webhook, so
 * the copy says what is actually known and nothing more. */
export async function renderStoreThanks(root, setMeta) {
  if (setMeta) {
    setMeta({ title: 'Order received — PropBetEdge Store', description: 'Your PropBetEdge order has been received.', canonical: 'https://propbetedge.ai/store/thanks' });
  }
  clear();
  root.innerHTML = `
    ${renderHeader()}
    <main class="st"><div class="st-wrap st-thanks">
      <p class="st-eyebrow">PropBetEdge Store</p>
      <h1>Order received.</h1>
      <p class="st-lede">Thank you. A confirmation email is on its way, and your order goes into production with our fulfilment partner shortly after payment settles.</p>
      <p class="st-fine">Made to order, so production takes a few days before your parcel ships. Tracking follows by email once it does. Questions: <a href="mailto:sales@localhomebuyersusa.com">sales@localhomebuyersusa.com</a></p>
      <p><a class="btn gold" href="/store">Back to the collection →</a></p>
    </div></main>
    ${renderFooter()}
  `;
  updateCartBadge();
  track('purchase', {});
}
