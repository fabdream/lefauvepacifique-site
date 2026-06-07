// stripe-webhook : appelé par Stripe (serveur-à-serveur). Vérif SIGNATURE obligatoire. Sur payment_intent.succeeded
// → bilan_orders status 'lead' → 'paid' (idempotent). Le worker d'Oracle consomme ensuite status='paid'.
// DÉPLOYER avec --no-verify-jwt (Stripe n'envoie pas de JWT Supabase). Pas de CORS (pas appelé par le navigateur).
import Stripe from "https://esm.sh/stripe@17?target=deno"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 })

  const sig = req.headers.get("stripe-signature")
  const whsec = Deno.env.get("STRIPE_WEBHOOK_SIGNING_SECRET")
  if (!sig || !whsec) return new Response("config manquante", { status: 400 })

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" })
  const raw = await req.text()

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig, whsec)
  } catch (e) {
    return new Response(`signature invalide: ${(e as Error).message}`, { status: 400 })
  }

  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object as Stripe.PaymentIntent
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
    // idempotent : lead → paid uniquement (ne réécrit jamais un paid/delivered). Match par PaymentIntent id.
    const { error } = await supabase
      .from("bilan_orders")
      .update({ status: "paid" })
      .eq("stripe_payment_intent_id", pi.id)
      .eq("status", "lead")
    if (error) return new Response(`db: ${error.message}`, { status: 500 }) // Stripe retentera
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
})
