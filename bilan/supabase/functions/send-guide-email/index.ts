// send-guide-email : envoie le LEAD MAGNET gratuit "4 plantes sommeil" par mail.
// Appelé SERVEUR-À-SERVEUR par create-lead (jamais par le navigateur) quand answers.source='guide-sommeil-4-plantes'.
// Envoie un LIEN STATIQUE public vers le guide (PAS de pièce jointe, PAS d'URL signée : le guide est un asset
// public du site), avec une copy à la voix du Fauve, via le même SMTP Infomaniak que send-bilan-email.
//
// Sécurité : auth = Bearer <SERVICE_ROLE_KEY> (seul create-lead/le worker l'a → bloque l'anon).
//   DÉPLOYER --no-verify-jwt (comme send-bilan-email). Le destinataire vient de la DB (jamais du payload) = pas de hijack.
// Idempotent : n'envoie que si answers.guide_sent_at est absent ; au succès, on merge guide_sent_at dans answers.
//   Un retry après envoi → no-op (already=true). Échec SMTP → answers inchangé (rejouable) + non-2xx.
//
// Secrets hérités du projet (déjà posés pour send-bilan-email — RIEN à reposer) :
//   SMTP_HOST · SMTP_PORT · SMTP_TLS · SMTP_USER · SMTP_PASS · SMTP_FROM · SMTP_FROM_NAME
//   SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY (auto-injectés)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts"
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts"

// Registre des guides gratuits (lead magnets). Clé = answers.source posé par le form du site.
// Pour ajouter un guide : 1 entrée ici + le PDF dans le site (assets/) + create-lead fire sur source^="guide-".
const GUIDES: Record<string, { url: string; subject: string; teaser: string }> = {
  "guide-sommeil-4-plantes": {
    url: "https://lefauvepacifique.com/assets/guide-4-plantes-sommeil.pdf",
    subject: "Tes 4 plantes pour dormir, comme promis 🐺",
    teaser: "4 plantes que la plupart des gens ignorent, et qui aident vraiment à retrouver un vrai sommeil. Pas des somnifères. Des trucs simples, que tu peux tester dès ce soir.",
  },
  "guide-os-aliments": {
    url: "https://lefauvepacifique.com/assets/guide-os-aliments.pdf",
    subject: "Tes aliments pour des os solides, comme promis 🐺",
    teaser: "Tout ce qui renforce vraiment tes os : les bons aliments, et le levier que presque personne ne connaît. Le lait n'est pas la réponse, et tu vas comprendre pourquoi.",
  },
  "guide-fruits-pesticides": {
    url: "https://lefauvepacifique.com/assets/guide-fruits-pesticides.pdf",
    subject: "Tes fruits propres, comme promis 🐺",
    teaser: "La liste des fruits à laver en priorité, et la méthode simple qui enlève les pesticides. Sans tout acheter bio.",
  },
  "guide-canicule": {
    url: "https://lefauvepacifique.com/assets/guide-canicule.pdf",
    subject: "Tes vrais gestes contre la chaleur, comme promis 🐺",
    teaser: "Les vrais gestes contre la canicule, ceux qu'on fait à l'envers sans le savoir. Comment rafraîchir ton corps, bien dormir, boire et manger juste. Et protéger les anciens autour de toi.",
  },
}

function err(msg: string, status: number) {
  return new Response(JSON.stringify({ ok: false, error: msg }), {
    status, headers: { "Content-Type": "application/json" },
  })
}
function ok(extra: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ ok: true, ...extra }), {
    status: 200, headers: { "Content-Type": "application/json" },
  })
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return err("POST only", 405)

  // Auth serveur-à-serveur par PRIVILÈGE (même logique que send-bilan-email) : on lit la row avec le token du
  // caller. Service-role bypass la RLS et voit la ligne ; anon/publishable voit 0 ligne → 401.
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim()
  if (!token) return err("unauthorized", 401)

  let body: { order_id?: string }
  try { body = await req.json() } catch { return err("JSON invalide", 400) }
  const orderId = String(body.order_id ?? "").trim()
  if (!orderId) return err("order_id requis", 400)

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, token, {
    auth: { persistSession: false },
  })

  const { data: row } = await supabase
    .from("bilan_orders")
    .select("id, prenom, email, answers")
    .eq("id", orderId)
    .maybeSingle()
  if (!row) return err("unauthorized ou lead introuvable", 401)

  const answers = (row.answers && typeof row.answers === "object" ? row.answers : {}) as Record<string, unknown>
  const guide = typeof answers.source === "string" ? GUIDES[answers.source] : undefined
  if (!guide) return err(`source '${answers.source}' inconnue (guides : ${Object.keys(GUIDES).join(", ")})`, 409)
  if (answers.guide_sent_at) return ok({ already: true }) // idempotent : déjà envoyé

  // --- Copy voix du Fauve (validée Fabio). Subject + teaser par guide, le reste templaté. ---
  const prenom = (row.prenom ?? "").toString().trim()
  const hi = prenom ? `${prenom},` : "Salut,"
  const subject = guide.subject

  const html = `<div style="font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#2b2620">
    <p>${hi}</p>
    <p>Tu m'as demandé le guide. Le voilà.</p>
    <p>${guide.teaser}</p>
    <div style="margin:28px 0 8px">
      <a href="${guide.url}" style="display:inline-block;background:#8A5A2B;color:#F5EAD7;text-decoration:none;padding:14px 26px;border-radius:4px;font-weight:600;font-size:15px">📄 Télécharger ton guide</a>
    </div>
    <p>Lis-le au calme. Garde cet email, le lien reste valable.</p>
    <p style="margin-top:22px">Le Fauve.</p>
    <p style="font-size:12px;color:#9a9286;margin-top:24px">Le Fauve n'est pas médecin. Ce guide complète un suivi de santé, il ne le remplace pas. · Le Fauve Pacifique · lefauvepacifique.com</p>
  </div>`
  const text = `${hi}\n\nTu m'as demandé le guide. Le voilà.\n\n${guide.teaser}\n\n📄 Télécharger ton guide : ${guide.url}\n\nLis-le au calme. Garde cet email, le lien reste valable.\n\nLe Fauve.\n\n—\nLe Fauve n'est pas médecin. Ce guide complète un suivi de santé, il ne le remplace pas. · Le Fauve Pacifique · lefauvepacifique.com\n`

  // --- Envoi SMTP (identique à send-bilan-email : base64 lossless pour ne pas casser le lien) ---
  const client = new SMTPClient({
    connection: {
      hostname: Deno.env.get("SMTP_HOST") ?? "mail.infomaniak.com",
      port: Number(Deno.env.get("SMTP_PORT") ?? "465"),
      tls: (Deno.env.get("SMTP_TLS") ?? "true") === "true",
      auth: { username: Deno.env.get("SMTP_USER")!, password: Deno.env.get("SMTP_PASS")! },
    },
  })
  const fromAddr = Deno.env.get("SMTP_FROM") ?? "contact@lefauvepacifique.com"
  const fromName = Deno.env.get("SMTP_FROM_NAME") ?? "Le Fauve"
  const b64utf8 = (s: string) => encodeBase64(new TextEncoder().encode(s))
  try {
    await client.send({
      from: `${fromName} <${fromAddr}>`,
      to: row.email,
      subject,
      mimeContent: [
        { mimeType: 'text/plain; charset="utf-8"', content: b64utf8(text), transferEncoding: "base64" },
        { mimeType: 'text/html; charset="utf-8"', content: b64utf8(html), transferEncoding: "base64" },
      ],
    })
  } catch (e) {
    try { await client.close() } catch { /* noop */ }
    return err(`SMTP: ${(e as Error).message}`, 502) // answers inchangé → rejouable
  }
  try { await client.close() } catch { /* noop */ }

  // Succès → marque l'idempotence (merge guide_sent_at). On NE touche PAS status (reste 'lead').
  const { error: updErr } = await supabase
    .from("bilan_orders")
    .update({ answers: { ...answers, guide_sent_at: new Date().toISOString() } })
    .eq("id", orderId)
  if (updErr) return ok({ warning: `email envoyé mais maj answers échouée: ${updErr.message}`, to: row.email })
  return ok({ delivered: true, to: row.email })
})
