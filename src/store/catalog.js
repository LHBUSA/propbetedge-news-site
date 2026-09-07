/**
 * src/store/catalog.js
 *
 * The canonical PropBetEdge Store product manifest.
 *
 * This file is the single source of truth for what exists and what it costs.
 * The browser is never trusted for price: the checkout endpoint resolves every
 * line item back to this manifest server-side, so a tampered cart cannot buy a
 * hoodie for a dollar. Anything the storefront shows is derived from here.
 *
 * Provider ids are deliberately null until a real Printful catalog exists.
 * Inventing them would produce a store that looks finished and fails at the
 * only moment that matters, so `providerConfigured()` reports the truth and
 * the UI says the collection is not yet purchasable rather than pretending.
 *
 * Prices are in cents to avoid float drift through Stripe.
 */

export const CATALOG_VERSION = '2026-09-07.1';

export const COLLECTIONS = [
  { slug: 'core', name: 'PropBetEdge', blurb: 'The house marks. Quiet, and correct.' },
  { slug: 'data', name: 'Data & Model', blurb: 'For people who read the number before the narrative.' },
  { slug: 'fight-dna', name: 'Fight DNA', blurb: 'Evidence over takes.' },
];

/* Garment sizing is provider-defined; these mirror the Printful base products
 * we intend to use (Bella+Canvas 3001 tee, Gildan 18500 hoodie). They are
 * presentational until real variant ids arrive. */
const TEE_SIZES = ['S', 'M', 'L', 'XL', '2XL'];
const HOODIE_SIZES = ['S', 'M', 'L', 'XL', '2XL'];

const TEE = { type: 'tee', sizes: TEE_SIZES, colors: ['Black', 'Vintage White'], retail_price: 3200 };
const HOODIE = { type: 'hoodie', sizes: HOODIE_SIZES, colors: ['Black', 'Charcoal'], retail_price: 6500 };
const HAT = { type: 'hat', sizes: ['One size'], colors: ['Black'], retail_price: 3800 };
const MUG = { type: 'mug', sizes: ['11oz'], colors: ['White'], retail_price: 1900 };

/**
 * Every product carries its own provider mapping. `provider_variant_ids` maps
 * "Size / Color" to a Printful variant id. Until those are filled in, the
 * product is `active: true` for display but not purchasable, which is the
 * distinction `isPurchasable()` enforces.
 */
export const PRODUCTS = [
  {
    slug: 'propbetedge-logo-tee',
    name: 'PropBetEdge Logo Tee',
    collection: 'core',
    slogan: null,
    description:
      'The house mark, set small on the chest in gold on a heavyweight cotton tee. No wordmark across the back, no loud graphics. It reads as a brand, not a billboard.',
    ...TEE,
    featured: true,
    sort_order: 10,
  },
  {
    slug: 'propbetedge-hoodie',
    name: 'PropBetEdge Premium Hoodie',
    collection: 'core',
    slogan: null,
    description:
      'Heavyweight fleece with an embroidered mark at the left chest. Built for a newsroom in winter and a long Sunday slate.',
    ...HOODIE,
    featured: true,
    sort_order: 20,
  },
  {
    slug: 'propbetedge-hat',
    name: 'PropBetEdge Embroidered Hat',
    collection: 'core',
    slogan: null,
    description:
      'Structured six-panel cap with the mark embroidered in gold thread. Understated enough to wear anywhere.',
    ...HAT,
    featured: true,
    sort_order: 30,
  },
  {
    slug: 'propbetedge-mug',
    name: 'PropBetEdge Mug',
    collection: 'core',
    slogan: null,
    description:
      'Eleven ounces of ceramic for the hours before the number moves. Mark on one side, nothing on the other.',
    ...MUG,
    featured: false,
    sort_order: 40,
  },
  {
    slug: 'trust-the-data-tee',
    name: 'Trust the Data. Question the Price.',
    collection: 'data',
    slogan: 'Trust the Data. Question the Price.',
    description:
      'Set in the same typeface the site uses for headlines. The whole thesis of the product, printed small enough to be a statement rather than a shout.',
    ...TEE,
    featured: true,
    sort_order: 50,
  },
  {
    slug: 'no-vibes-just-variance-tee',
    name: 'No Vibes. Just Variance.',
    collection: 'data',
    slogan: 'No Vibes. Just Variance.',
    description:
      'For anyone who has been told they are overthinking it, by someone who was about to lose.',
    ...TEE,
    featured: false,
    sort_order: 60,
  },
  {
    slug: 'my-model-said-no-tee',
    name: 'My Model Said No.',
    collection: 'data',
    slogan: 'My Model Said No.',
    description:
      'Three words that have saved more money than any tout has ever made. Small chest print, gold on black.',
    ...TEE,
    featured: true,
    sort_order: 70,
  },
  {
    slug: 'spreadsheet-for-this-mug',
    name: 'I Have A Spreadsheet For This',
    collection: 'data',
    slogan: 'I Have A Spreadsheet For This.',
    description:
      'A mug for the person at the table who is not guessing, and who everyone else quietly checks with.',
    ...MUG,
    featured: false,
    sort_order: 80,
  },
  {
    slug: 'fight-dna-tee',
    name: 'Fight DNA Tee',
    collection: 'fight-dna',
    slogan: null,
    description:
      'The Fight DNA mark from the UFC product, rendered as a clean chest graphic. Reads as a lab, not a locker room.',
    ...TEE,
    featured: true,
    sort_order: 90,
  },
  {
    slug: 'fight-dna-over-fight-takes-tee',
    name: 'Fight DNA > Fight Takes.',
    collection: 'fight-dna',
    slogan: 'Fight DNA > Fight Takes.',
    description:
      'Evidence beats opinion, and the shirt is shorter than the argument.',
    ...TEE,
    featured: false,
    sort_order: 100,
  },
].map((p) => ({
  provider: 'printful',
  provider_product_id: null,
  provider_variant_ids: {},
  mockups: [],
  active: true,
  currency: 'usd',
  ...p,
}));

export const bySlug = (slug) => PRODUCTS.find((p) => p.slug === slug && p.active) || null;

export const inCollection = (c) =>
  PRODUCTS.filter((p) => p.active && (!c || c === 'all' || p.collection === c)).sort((a, b) => a.sort_order - b.sort_order);

export const featured = () => PRODUCTS.filter((p) => p.active && p.featured).sort((a, b) => a.sort_order - b.sort_order);

/** "M / Black" — the key a Printful variant id is stored under. */
export const variantKey = (size, color) => `${size} / ${color}`;

/**
 * A product can be shown before it can be sold. Purchasable means we can
 * actually hand Printful a variant id for the exact size and colour chosen.
 */
export function isPurchasable(product, size, color) {
  if (!product || !product.active) return false;
  const id = product.provider_variant_ids?.[variantKey(size, color)];
  return Boolean(product.provider_product_id && id);
}

/** True when any product in the catalog can actually be fulfilled. */
export function providerConfigured() {
  return PRODUCTS.some((p) => p.provider_product_id && Object.keys(p.provider_variant_ids || {}).length > 0);
}

export const formatPrice = (cents, currency = 'usd') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
