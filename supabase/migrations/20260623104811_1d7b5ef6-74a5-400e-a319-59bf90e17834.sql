
create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  environment text not null,
  payload_summary jsonb,
  received_at timestamptz not null default now()
);
grant select on public.stripe_webhook_events to authenticated;
grant all on public.stripe_webhook_events to service_role;
alter table public.stripe_webhook_events enable row level security;
create policy "service role manages webhook events"
  on public.stripe_webhook_events for all to service_role using (true) with check (true);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  stripe_subscription_id text not null unique,
  stripe_customer_id text not null,
  product_id text,
  price_id text,
  status text not null default 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  environment text not null default 'sandbox',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_subscriptions_user_id on public.subscriptions(user_id);
create index if not exists idx_subscriptions_stripe_id on public.subscriptions(stripe_subscription_id);
grant select on public.subscriptions to authenticated;
grant all on public.subscriptions to service_role;
alter table public.subscriptions enable row level security;
create policy "Users can view own subscription"
  on public.subscriptions for select to authenticated using (auth.uid() = user_id);
create policy "Service role manages subscriptions"
  on public.subscriptions for all to service_role using (true) with check (true);
