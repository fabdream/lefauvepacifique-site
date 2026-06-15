// create-payment-intent : crée le PaymentIntent Stripe pour une commande 'lead' → renvoie le client_secret
// au front (qui monte le Payment Element). Prix SERVEUR-autoritaire (le client ne fixe jamais le montant).
import Stripe from "https://esm.sh/stripe@17?target=deno"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { json, preflight } from "../_shared/cors.ts"

// 5 EUR (décision Fabio 15/06/2026). Prix SERVEUR-autoritaire (changer AMOUNT_CENTS + CURRENCY ici + le label front).
const AMOUNT_CENTS = 500
const CURRENCY = "eur"

Deno.serve(async (req) => {
  const pre = preflight(req)
  if (pre) return pre
  if (req.method !== "POST") return json({ error: "POST only" }, 405)

  let body: { order_id?: string }
  try { body = await req.json() } catch { return json({ error: "JSON invalide" }, 400) }
  const orderId = String(body.order_id ?? "")
  if (!orderId) return json({ error: "order_id requis" }, 400)

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
  const { data: order, error } = await supabase
    .from("bilan_orders")
    .select("id, email, status")
    .eq("id", orderId)
    .single()
  if (error || !order) return json({ error: "commande introuvable" }, 404)
  if (order.status === "paid" || order.status === "delivered") return json({ error: "déjà réglé" }, 409)

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" })
  const pi = await stripe.paymentIntents.create({
    amount: AMOUNT_CENTS,
    currency: CURRENCY,
    receipt_email: order.email,
    metadata: { order_id: order.id, product: "bilan-du-fauve" },
    // allow_redirects: "never" → méthodes inline only (carte, Link inline). Pas de return_url requis côté
    // front (confirmPayment redirect:"if_required" marche directement). Funnel simple, paiement carte 1-page.
    automatic_payment_methods: { enabled: true, allow_redirects: "never" },
  })

  await supabase
    .from("bilan_orders")
    .update({ stripe_payment_intent_id: pi.id, amount_cents: AMOUNT_CENTS })
    .eq("id", order.id)

  return json({ client_secret: pi.client_secret })
})
