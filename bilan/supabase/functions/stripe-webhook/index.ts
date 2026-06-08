// stripe-webhook : appelé par Stripe (serveur-à-serveur). Vérif SIGNATURE obligatoire. Sur payment_intent.succeeded
// → bilan_orders 'lead' → 'paid' (idempotent), PUIS déclenche le worker Cloud Run (génération PDF+vocal → email)
// en FIRE-AND-FORGET (la génération dure ~60-120s : on ne l'attend pas, sinon timeout Stripe). Le Mac autopilot
// reste un filet (il consomme aussi status='paid'). DÉPLOYER --no-verify-jwt (Stripe n'envoie pas de JWT Supabase).
// Secrets : STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SIGNING_SECRET, WORKER_TRIGGER_SECRET, WORKER_GENERATE_URL.
import Stripe from "https://esm.sh/stripe@17?target=deno"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const WORKER_URL = Deno.env.get("WORKER_GENERATE_URL") ??
  "https://bilan-worker-517167123411.europe-west6.run.app/generate"

// Déclenche le worker Cloud Run. Ne throw JAMAIS : un échec ici = le filet Mac (polling status=paid) prend le relais.
async function triggerWorker(orderId: string): Promise<void> {
  const secret = Deno.env.get("WORKER_TRIGGER_SECRET")
  if (!secret) { console.error("WORKER_TRIGGER_SECRET manquant → trigger sauté (filet Mac prendra le relais)"); return }
  try {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Worker-Secret": secret },
      body: JSON.stringify({ order_id: orderId }),
    })
    if (!res.ok) console.error(`worker trigger ${res.status}: ${await res.text().catch(() => "")}`)
  } catch (e) {
    console.error("worker trigger échec (filet Mac prendra le relais):", (e as Error).message)
  }
}

// Garde la tâche vivante APRÈS la réponse (le worker bloque ~60-120s) sans bloquer le 200 renvoyé à Stripe.
function keepAlive(p: Promise<unknown>): void {
  const er = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime
  if (er?.waitUntil) er.waitUntil(p)
  // sinon (hors runtime Edge), la promesse tourne en best-effort ; en prod Supabase, waitUntil existe toujours.
}

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
    // idempotent : lead → paid uniquement. .select() → on sait si CETTE requête a fait la transition ; un retry
    // Stripe (déjà 'paid') matche 0 row → on NE re-déclenche PAS le worker (pas de double génération).
    const { data: updated, error } = await supabase
      .from("bilan_orders")
      .update({ status: "paid" })
      .eq("stripe_payment_intent_id", pi.id)
      .eq("status", "lead")
      .select("id")
    if (error) return new Response(`db: ${error.message}`, { status: 500 }) // Stripe retentera
    if (updated && updated.length > 0) {
      // 1re transition lead→paid → génération cloud immédiate (fire-and-forget, ne bloque pas la réponse Stripe).
      keepAlive(triggerWorker(updated[0].id as string))
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
})
