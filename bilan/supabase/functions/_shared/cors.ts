// CORS partagé. Le funnel (lefauvepacifique.xx/bilan) appelle les Edge Functions (*.supabase.co) = cross-origin.
// ALLOWED_ORIGIN à restreindre au domaine Le Fauve en prod (laisser large en test). Réglable via env.
const ALLOWED = Deno.env.get("FUNNEL_ORIGIN") ?? "*"

export const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

export function preflight(req: Request): Response | null {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  return null
}
