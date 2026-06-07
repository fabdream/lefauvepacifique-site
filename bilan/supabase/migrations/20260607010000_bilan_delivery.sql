-- Le Bilan du Fauve — leg LIVRAISON. Projet Supabase qyaohs.
-- À exécuter UNIQUEMENT après go migration explicite de Fabio (règle supabase-readonly).
-- Additif et idempotent : aucune donnée existante touchée, rejouable sans risque.
--
-- Cycle de vie de la commande après ce patch :
--   lead → paid → generated → delivered   (+ failed à tout moment)
--   • lead       : email + réponses captés (create-lead), avant paiement
--   • paid       : webhook Stripe (payment_intent.succeeded)
--   • generated  : worker Oracle a produit PDF + vocal et uploadé dans Storage 'bilans'
--   • delivered  : Edge Function send-bilan-email a envoyé l'email au client

-- 1) Colonne pour le vocal (le PDF a déjà pdf_url). On stocke l'OBJECT PATH du bucket 'bilans'
--    (ex: '<order_id>/vocal.ogg'), pas une URL — signée à la volée par les Edge Functions.
alter table public.bilan_orders
  add column if not exists audio_url text;

-- 2) Étendre le garde-fou de statut pour autoriser 'generated' (sinon l'update du worker plante).
alter table public.bilan_orders
  drop constraint if exists bilan_orders_status_chk;
alter table public.bilan_orders
  add constraint bilan_orders_status_chk
  check (status in ('lead', 'paid', 'generated', 'delivered', 'failed'));

-- 3) Bucket Storage privé pour les livrables. public=false + AUCUNE policy storage.objects
--    = accès service_role uniquement (worker Oracle upload, Edge Functions lisent/signent).
--    Le client ne touche jamais le bucket : il reçoit des signed URLs via order-status / l'email.
insert into storage.buckets (id, name, public)
values ('bilans', 'bilans', false)
on conflict (id) do nothing;
