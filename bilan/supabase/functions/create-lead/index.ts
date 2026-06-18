// create-lead : capture email + réponses au PREMIER affichage du teaser (AVANT paiement, même sans achat).
// Service-role (bypass RLS) — le front ne touche jamais la table. Appelé par le front avec l'anon key.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { json, preflight } from "../_shared/cors.ts"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

Deno.serve(async (req) => {
  const pre = preflight(req)
  if (pre) return pre
  if (req.method !== "POST") return json({ error: "POST only" }, 405)

  let body: { prenom?: string; email?: string; answers?: unknown; teaser_text?: string }
  try { body = await req.json() } catch { return json({ error: "JSON invalide" }, 400) }

  const email = String(body.email ?? "").trim().toLowerCase()
  if (!EMAIL_RE.test(email)) return json({ error: "email invalide" }, 400)
  const prenom = typeof body.prenom === "string" ? body.prenom.trim().slice(0, 80) : null
  const answers = body.answers && typeof body.answers === "object" ? body.answers : {}
  const teaser_text = typeof body.teaser_text === "string" ? body.teaser_text.slice(0, 4000) : null

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const supabase = createClient(supabaseUrl, serviceKey)
  const { data, error } = await supabase
    .from("bilan_orders")
    .insert({ prenom, email, answers, teaser_text, status: "lead" })
    .select("id")
    .single()
  if (error) return json({ error: error.message }, 500)

  // Lead magnet "guide sommeil" : envoyer le guide par mail (server-à-serveur, voix du Fauve).
  // On AWAIT pour garantir l'envoi avant la fin de l'Edge runtime, mais on ne fait JAMAIS échouer la
  // capture du lead si l'email plante (le lead est déjà inséré ; send-guide-email est idempotent + rejouable).
  const source = (answers as Record<string, unknown>).source
  if (typeof source === "string" && source.startsWith("guide-")) {
    try {
      const r = await fetch(`${supabaseUrl}/functions/v1/send-guide-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify({ order_id: data.id }),
      })
      if (!r.ok) console.error("send-guide-email non-2xx:", r.status, await r.text().catch(() => ""))
    } catch (e) {
      console.error("send-guide-email appel échoué:", (e as Error).message)
    }
  }

  return json({ order_id: data.id })
})
