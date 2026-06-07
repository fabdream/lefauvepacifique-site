// Pont paiement : charge Stripe (pk publique) + appelle les Edge Functions Supabase (create-lead,
// create-payment-intent, order-status). Tout est conditionné à la présence des clés : sans config,
// `hasPaymentConfig` = false → l'app garde le placeholder (le démo marche sans backend).
import { loadStripe, type Stripe } from "@stripe/stripe-js"
import type { Answers } from "./questions"

const PK = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined
const FUNCTIONS_URL = import.meta.env.VITE_FUNCTIONS_URL as string | undefined
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const hasPaymentConfig = Boolean(PK && FUNCTIONS_URL && ANON)

let stripePromise: Promise<Stripe | null> | null = null
export function getStripe(): Promise<Stripe | null> {
  if (!PK) return Promise.resolve(null)
  if (!stripePromise) stripePromise = loadStripe(PK)
  return stripePromise
}

async function callFn<T>(name: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${FUNCTIONS_URL}/${name}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON}`, ...(init.headers ?? {}) },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`)
  return body as T
}

// Capture le lead (email + réponses + teaser) AVANT paiement → renvoie l'order_id.
export function createLead(input: { prenom: string; email: string; answers: Answers; teaser_text: string }) {
  return callFn<{ order_id: string }>("create-lead", { method: "POST", body: JSON.stringify(input) })
}

// Crée le PaymentIntent pour cette commande → renvoie le client_secret (pour le Payment Element).
export function createPaymentIntent(order_id: string) {
  return callFn<{ client_secret: string }>("create-payment-intent", { method: "POST", body: JSON.stringify({ order_id }) })
}

// Polling de l'état (post-paiement) : lead | paid | delivered (+ pdf_url). PII jamais renvoyée.
export function getOrderStatus(order_id: string) {
  return callFn<{ status: string; pdf_url: string | null }>(`order-status?id=${encodeURIComponent(order_id)}`, { method: "GET" })
}
