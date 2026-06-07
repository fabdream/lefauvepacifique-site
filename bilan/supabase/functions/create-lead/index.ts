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

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
  const { data, error } = await supabase
    .from("bilan_orders")
    .insert({ prenom, email, answers, teaser_text, status: "lead" })
    .select("id")
    .single()
  if (error) return json({ error: error.message }, 500)
  return json({ order_id: data.id })
})
