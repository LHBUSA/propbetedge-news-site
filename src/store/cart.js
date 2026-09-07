/**
 * src/store/cart.js
 *
 * A deliberately small cart. No framework, no state library: this site is a
 * vanilla Vite SPA and a shop with ten products does not justify changing
 * that.
 *
 * The cart stores identity and quantity only - slug, size, colour, qty. It
 * does NOT store price. Price is resolved from the catalog for display and
 * resolved again, server-side, at checkout. Anything a customer can edit in
 * devtools is something the server must not believe, and the simplest way to
 * guarantee that is to never write a price down here at all.
 *
 * Persistence is localStorage, which can throw in private windows and when a
 * browser blocks site data, so every access is guarded and a failure degrades
 * to an empty in-memory cart rather than a broken page.
 */
import { bySlug, formatPrice } from './catalog.js';

const KEY = 'pbe.store.cart.v1';
const listeners = new Set();
let memory = null;

function read() {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(KEY);
    memory = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(memory)) memory = [];
  } catch {
    memory = [];
  }
  return memory;
}

function write(next) {
  memory = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* Private window or blocked storage. The cart still works for this page
     * view; it simply will not survive a reload. That is a better outcome
     * than throwing in the middle of an add-to-cart. */
  }
  for (const fn of listeners) {
    try { fn(next); } catch { /* a bad subscriber must not break the cart */ }
  }
}

export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

export const lines = () => read().slice();

export const count = () => read().reduce((n, l) => n + l.qty, 0);

const sameLine = (a, b) => a.slug === b.slug && a.size === b.size && a.color === b.color;

export function add({ slug, size, color, qty = 1 }) {
  if (!bySlug(slug) || !size || !color) return false;
  const next = read().slice();
  const hit = next.find((l) => sameLine(l, { slug, size, color }));
  if (hit) hit.qty = Math.min(20, hit.qty + qty);
  else next.push({ slug, size, color, qty: Math.min(20, Math.max(1, qty)) });
  write(next);
  return true;
}

export function setQty({ slug, size, color }, qty) {
  const n = Math.max(0, Math.min(20, Number(qty) || 0));
  const next = read().filter((l) => !(sameLine(l, { slug, size, color }) && n === 0));
  const hit = next.find((l) => sameLine(l, { slug, size, color }));
  if (hit) hit.qty = n;
  write(next);
}

export function remove({ slug, size, color }) {
  write(read().filter((l) => !sameLine(l, { slug, size, color })));
}

export const clear = () => write([]);

/**
 * Display-only pricing. Resolved fresh from the catalog on every call so a
 * price change takes effect immediately and a stale cart cannot quote an old
 * number. The server does this again and is the only authority.
 */
export function detailed() {
  const out = [];
  for (const l of read()) {
    const p = bySlug(l.slug);
    if (!p) continue;   // product withdrawn since it was added
    out.push({ ...l, product: p, unit: p.retail_price, lineTotal: p.retail_price * l.qty });
  }
  return out;
}

export function subtotal() {
  return detailed().reduce((n, l) => n + l.lineTotal, 0);
}

export const subtotalLabel = () => formatPrice(subtotal());
