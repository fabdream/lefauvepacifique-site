# Le Bilan du Fauve — déploiement backend (Bobby)

Projet Supabase : **qyaohs** (`qyaohsredwcaqohlyrru`). MODE TEST d'abord. À faire APRÈS go direct Fabio.

## 1. Secrets Edge Functions (à set sur qyaohs — Cody ne les possède jamais)
```
supabase secrets set STRIPE_SECRET_KEY=rk_test_xxx           # clé restreinte (pas la full secret)
supabase secrets set STRIPE_WEBHOOK_SIGNING_SECRET=whsec_xxx # obtenu à l'étape 4
# optionnel : restreindre le CORS au domaine Le Fauve
supabase secrets set FUNNEL_ORIGIN=https://lefauvepacifique.com

# LIVRAISON EMAIL (fonction send-bilan-email) — SMTP Infomaniak, creds de Fabio, JAMAIS dans le repo/chat
supabase secrets set SMTP_USER=contact@lefauvepacifique.com
supabase secrets set SMTP_PASS=<mot-de-passe-application-infomaniak>
supabase secrets set SMTP_FROM=contact@lefauvepacifique.com
supabase secrets set SMTP_FROM_NAME="Le Fauve"
# défauts OK si non set : SMTP_HOST=mail.infomaniak.com · SMTP_PORT=465 · SMTP_TLS=true
```
`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` sont auto-injectés par Supabase, rien à set.

## 2. Migrations (DDL → go migration explicite Fabio requis)
Applique dans l'ordre sur qyaohs (`supabase db push`, ou colle le SQL dans le SQL editor) :
1. `migrations/20260607000000_bilan_orders.sql` — table `bilan_orders`, RLS ON sans policy = anon zéro accès, service-role only.
2. `migrations/20260607010000_bilan_delivery.sql` — **leg livraison** : colonne `audio_url`, statut `generated` ajouté au check constraint (`lead→paid→generated→delivered`), bucket Storage privé `bilans` (service-role only). Additif + idempotent.

## 3. Déploiement des fonctions
```
supabase functions deploy create-lead
supabase functions deploy create-payment-intent
supabase functions deploy order-status
supabase functions deploy stripe-webhook    --no-verify-jwt   # Stripe n'envoie pas de JWT
supabase functions deploy send-bilan-email  --no-verify-jwt   # appelée par le worker Oracle (Bearer = service-role)
```
(create-lead / create-payment-intent / order-status : le front les appelle avec l'anon key → JWT par défaut OK.)
(send-bilan-email : auth = `Authorization: Bearer <service-role-key>` vérifiée DANS la fonction → seul le worker Oracle peut déclencher l'envoi. Nécessite les secrets SMTP de l'étape 1.)

## 4. Webhook Stripe (dashboard, mode test)
Endpoint → `https://qyaohsredwcaqohlyrru.supabase.co/functions/v1/stripe-webhook`
Événement → `payment_intent.succeeded`. Récupère le signing secret (whsec_...) → étape 1.

## 5. Front (env build Netlify) — clés PUBLIQUES (safe)
```
VITE_SUPABASE_URL=https://qyaohsredwcaqohlyrru.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...            # anon (public OK, RLS protège)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
VITE_FUNCTIONS_URL=https://qyaohsredwcaqohlyrru.supabase.co/functions/v1
```

## Flow runtime
form fini → `create-lead` (status=lead, capture email+answers+teaser) → "Débloque" → `create-payment-intent` → Payment Element → paiement → Stripe → `stripe-webhook` (lead→paid) → **worker Oracle** : génère PDF+vocal, upload Storage `bilans/<id>/`, set `status=generated` + `pdf_url` + `audio_url`, puis POST `send-bilan-email {order_id, subject, html, text}` → `send-bilan-email` envoie l'email (PDF en pièce jointe + liens signés) → `status=delivered` → front poll `order-status` → "ton bilan est prêt" (liens signés PDF + vocal).

Génération chère = QUE post-paiement (worker sur status='paid'). Non-payeurs = juste une row 'lead', coût ≈ 0.
Idempotent + retry-safe : `send-bilan-email` n'envoie que si `status=generated` ; succès → `delivered` ; échec SMTP → reste `generated` (rejouable) + non-2xx → le worker retry. Destinataire = l'email de la row (jamais le payload).

## 6. Front — bulle "Le bilan" sur la home (déploiement Netlify, pas Supabase)
La landing `index.html` (racine) a maintenant une entrée vers le funnel : bulle flottante `🐺 Fais ton bilan`, lien nav accent "Le bilan", lien footer — tous → `/bilan/`. Pur statique, livré par le build Netlify (`netlify-build.sh` copie `index.html` tel quel). Va live au merge sur `master` (go Fabio requis). Aucune dépendance Supabase.
