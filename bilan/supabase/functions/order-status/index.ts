// order-status : polling léger post-paiement. Renvoie {status, pdf_url, audio_url} — JAMAIS la PII.
// pdf_url/audio_url stockés en DB = object paths du bucket privé 'bilans'. On les signe ici (service-role)
// pour donner au client (qui a payé, l'uuid de commande est la capability) un lien temporaire utilisable.
// Pourquoi pas Realtime : RLS bloque l'anon (PII protégée) → on expose juste l'état via cette fonction.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { json, preflight } from "../_shared/cors.ts"

const BUCKET = "bilans"
const TTL = 60 * 60 * 24 * 7 // 7 jours côté front (l'email porte des liens 1 an)

Deno.serve(async (req) => {
  const pre = preflight(req)
  if (pre) return pre

  const id = new URL(req.url).searchParams.get("id")
  if (!id) return json({ error: "id requis" }, 400)

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
  const { data, error } = await supabase
    .from("bilan_orders")
    .select("status, pdf_url, audio_url")
    .eq("id", id)
    .single()
  if (error || !data) return json({ error: "introuvable" }, 404)

  // Signe les object paths présents (échec de signature → null, ne casse pas le polling).
  let pdf: string | null = null
  let audio: string | null = null
  // Prévisualisation inline (pas de download forcé) : le navigateur affiche le PDF / lit l'audio ; le viewer
  // natif offre le téléchargement. (iOS Safari ne lit pas l'ogg → le vocal doit être en mp3.)
  if (data.pdf_url) {
    const { data: s } = await supabase.storage.from(BUCKET).createSignedUrl(data.pdf_url, TTL)
    pdf = s?.signedUrl ?? null
  }
  if (data.audio_url) {
    const { data: s } = await supabase.storage.from(BUCKET).createSignedUrl(data.audio_url, TTL)
    audio = s?.signedUrl ?? null
  }

  return json({ status: data.status, pdf_url: pdf, audio_url: audio })
})
