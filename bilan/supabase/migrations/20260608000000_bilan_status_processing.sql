-- Le Bilan du Fauve — ajoute le statut 'processing' au check constraint de bilan_orders.
-- Sert de LOCK ATOMIQUE du worker : claim `update status='processing' where status='paid'` AVANT de générer
-- → empêche la double génération quand le worker Cloud Run (déclenché par le webhook Stripe) et l'autopilot
-- Mac (polling status='paid') tournent ensemble. Flow : paid → processing (lock) → generated (avec pdf_url) → delivered.
-- Additif + idempotent (rejouable). À exécuter sur qyaohs.

alter table public.bilan_orders drop constraint if exists bilan_orders_status_chk;
alter table public.bilan_orders
  add constraint bilan_orders_status_chk
  check (status in ('lead', 'paid', 'processing', 'generated', 'delivered', 'failed'));
