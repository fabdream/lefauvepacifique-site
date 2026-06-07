# Le Bilan du Fauve — déploiement backend (Bobby)

Projet Supabase : **qyaohs** (`qyaohsredwcaqohlyrru`). MODE TEST d'abord. À faire APRÈS go direct Fabio.

## 1. Secrets Edge Functions (à set sur qyaohs — Cody ne les possède jamais)
```
supabase secrets set STRIPE_SECRET_KEY=rk_test_xxx           # clé restreinte (pas la full secret)
supabase secrets set STRIPE_WEBHOOK_SIGNING_SECRET=whsec_xxx # obtenu à l'étape 4
# optionnel : restreindre le CORS au domaine Le Fauve
supabase secrets set FUNNEL_ORIGIN=https://lefauvepacifique.xx
```
`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` sont auto-injectés par Supabase, rien à set.

## 2. Migration (DDL → go migration explicite Fabio requis)
Applique `migrations/20260607000000_bilan_orders.sql` sur qyaohs (`supabase db push`, ou colle le SQL dans le SQL editor). Table `bilan_orders`, RLS ON sans policy = anon zéro accès, service-role only.

## 3. Déploiement des fonctions
```
supabase functions deploy create-lead
supabase functions deploy create-payment-intent
supabase functions deploy order-status
supabase functions deploy stripe-webhook --no-verify-jwt   # Stripe n'envoie pas de JWT
```
(create-lead / create-payment-intent / order-status : le front les appelle avec l'anon key → JWT par défaut OK.)

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
form fini → `create-lead` (status=lead, capture email+answers+teaser) → "Débloque" → `create-payment-intent` → Payment Element → paiement → Stripe → `stripe-webhook` (lead→paid) → worker Oracle (paid→delivered + pdf_url) → front poll `order-status` → affiche "ton bilan est prêt".

Génération chère = QUE post-paiement (worker sur status='paid'). Non-payeurs = juste une row 'lead', coût ≈ 0.
