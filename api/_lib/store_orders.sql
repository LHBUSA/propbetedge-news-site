-- PropBetEdge Store order ledger.
--
-- Apply once against the Supabase project that holds STORE orders before
-- enabling checkout. The webhook refuses to acknowledge a paid session when
-- this table is unreachable, so a missing migration fails loudly rather than
-- losing an order.

create table if not exists public.store_orders (
  id uuid primary key default gen_random_uuid(),

  -- Idempotency. A Stripe webhook is delivered at least once and retried on
  -- any non-2xx, so redelivery is normal traffic, not an error. The unique
  -- constraint is what makes a second delivery a no-op; a read-then-write
  -- check would have a race in the middle that produces two shirts.
  stripe_event_id text not null unique,
  stripe_checkout_session_id text not null,
  stripe_payment_intent_id text,

  customer_email text,

  -- What was bought, as resolved server-side at checkout: slug, size, colour,
  -- quantity and the provider variant id. No card data is ever stored.
  items jsonb not null default '[]'::jsonb,

  subtotal integer,
  shipping integer,
  tax integer,
  total integer,
  currency text not null default 'usd',

  -- Our lifecycle, distinct from the provider's.
  --   paid                          money captured, nothing sent yet
  --   submitted                     handed to the provider
  --   FULFILLMENT_REVIEW_REQUIRED   paid but not fulfillable; a human must look
  status text not null default 'paid'
    check (status in ('paid', 'submitted', 'FULFILLMENT_REVIEW_REQUIRED', 'cancelled')),

  fulfillment_provider text not null default 'printful',
  provider_order_id text,
  provider_status text
    check (provider_status is null or provider_status in ('pending', 'draft', 'in_production', 'shipped', 'delivered', 'failed', 'unknown')),

  tracking_number text,
  tracking_url text,

  failure_reason text,

  created_at timestamptz not null default now(),
  paid_at timestamptz,
  submitted_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists store_orders_session_idx on public.store_orders (stripe_checkout_session_id);
create index if not exists store_orders_status_idx on public.store_orders (status);
create index if not exists store_orders_created_idx on public.store_orders (created_at desc);

-- Orders are staff-only. The service role bypasses RLS; enabling it with no
-- permissive policy means the anon key can never read customer emails or
-- addresses even if it leaks into the bundle.
alter table public.store_orders enable row level security;

comment on table public.store_orders is
  'PropBetEdge Store orders. Written only by the signature-verified Stripe webhook. Never stores card data.';
comment on column public.store_orders.stripe_event_id is
  'Unique. The idempotency key for webhook redelivery: the second insert is rejected by the database, not by application logic.';
comment on column public.store_orders.status is
  'FULFILLMENT_REVIEW_REQUIRED means the customer paid and the provider order did not succeed. Never delete these rows.';
