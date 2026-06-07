-- Le Bilan du Fauve — queue commerce. Projet Supabase qyaohs.
-- À exécuter UNIQUEMENT après go migration explicite de Fabio (règle supabase-readonly).
-- Token-safe : writes service-role ONLY (Edge Functions). Anon = ZÉRO accès direct (RLS sans policy).

create table if not exists public.bilan_orders (
  id                       uuid primary key default gen_random_uuid(),
  created_at               timestamptz not null default now(),
  prenom                   text,
  email                    text not null,
  answers                  jsonb not null default '{}'::jsonb,
  teaser_text              text,
  stripe_payment_intent_id text unique,          -- rempli à la création du PaymentIntent (Payment Element)
  amount_cents             integer,
  status                   text not null default 'lead',  -- lead | paid | delivered | failed
  pdf_url                  text,
  delivered_at             timestamptz
);

create index if not exists bilan_orders_status_idx on public.bilan_orders (status);
create index if not exists bilan_orders_pi_idx on public.bilan_orders (stripe_payment_intent_id);

-- RLS ON, AUCUNE policy → anon/authenticated = zéro accès. Seul le service_role (Edge Functions) lit/écrit (bypass RLS).
-- Le front ne touche JAMAIS la table en direct : il passe par les Edge Functions (create-lead, create-payment-intent,
-- order-status). Le worker de génération d'Oracle lit aussi en service_role. PII (email/answers) jamais exposée au client.
alter table public.bilan_orders enable row level security;

-- Contrôle de cohérence du statut (garde-fou).
alter table public.bilan_orders
  add constraint bilan_orders_status_chk
  check (status in ('lead', 'paid', 'delivered', 'failed'));
