// order-status : polling léger post-paiement. Renvoie UNIQUEMENT {status, pdf_url} (jamais la PII).
// Pourquoi pas Realtime sur la table : RLS bloque l'anon (PII protégée) → on expose juste l'état via cette
// fonction service-role, par id de commande (uuid imprévisible). Le front poll toutes les ~3s jusqu'à 'delivered'.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { json, preflight } from "../_shared/cors.ts"

Deno.serve(async (req) => {
  const pre = preflight(req)
  if (pre) return pre

  const id = new URL(req.url).searchParams.get("id")
  if (!id) return json({ error: "id requis" }, 400)

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
  const { data, error } = await supabase
    .from("bilan_orders")
    .select("status, pdf_url")
    .eq("id", id)
    .single()
  if (error || !data) return json({ error: "introuvable" }, 404)

  return json({ status: data.status, pdf_url: data.pdf_url ?? null })
})
