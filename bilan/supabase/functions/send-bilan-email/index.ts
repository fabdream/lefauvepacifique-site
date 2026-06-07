// send-bilan-email : dernier maillon du funnel. Appelé SERVEUR-À-SERVEUR par le worker d'Oracle
// (jamais par le navigateur) une fois le bilan généré + uploadé dans Storage 'bilans'.
// Envoie l'email au client (PDF en pièce jointe + liens signés PDF/vocal) via SMTP Infomaniak.
//
// Sécurité : auth = Bearer <SERVICE_ROLE_KEY> (seul le worker l'a → bloque l'anon). DÉPLOYER --no-verify-jwt.
// Idempotent + retry-safe : n'envoie que si status='generated' ; succès → 'delivered' ; échec SMTP → reste
//   'generated' (rejouable) + renvoie non-2xx. Le destinataire vient de la DB (jamais du payload) = pas de hijack.
//
// Secrets attendus (posés par Fabio/Bobby dans les secrets de la fonction, JAMAIS dans le repo/chat) :
//   SMTP_HOST (def. mail.infomaniak.com) · SMTP_PORT (def. 465) · SMTP_TLS (def. true)
//   SMTP_USER · SMTP_PASS · SMTP_FROM (def. contact@lefauvepacifique.com) · SMTP_FROM_NAME (def. Le Fauve)
//   SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY (auto-injectés par Supabase)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts"
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts"

const BUCKET = "bilans"
const SIGNED_TTL = 60 * 60 * 24 * 365 // 1 an : le client garde l'accès à ses livrables
const MAX_ATTACH_BYTES = 9_000_000 // au-delà → lien seul (évite un reject SMTP sur pièce jointe lourde)

function err(msg: string, status: number) {
  return new Response(JSON.stringify({ ok: false, error: msg }), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}
function ok(extra: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ ok: true, ...extra }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return err("POST only", 405)

  // Auth serveur-à-serveur SANS égalité stricte de clé : le worker peut présenter une clé service-role
  // valide d'une AUTRE forme que la SUPABASE_SERVICE_ROLE_KEY injectée (nouvelle API key sb_secret vs
  // JWT legacy = deux chaînes différentes pour le même privilège). On vérifie le PRIVILÈGE, pas la chaîne :
  // on lit la commande avec le token du caller. Service-role bypass la RLS et voit la row ; anon/publishable
  // voit 0 ligne (RLS active sans policy) → 401. Le token sert aussi pour storage/signature/update (worker = service-role).
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim()
  if (!token) return err("unauthorized", 401)

  let body: { order_id?: string; subject?: string; html?: string; text?: string }
  try { body = await req.json() } catch { return err("JSON invalide", 400) }
  const orderId = String(body.order_id ?? "").trim()
  if (!orderId) return err("order_id requis", 400)

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, token, {
    auth: { persistSession: false },
  })

  // Gate + row autoritaire en un seul appel : maybeSingle → null si la RLS cache tout (caller non service-role) → 401.
  const { data: row } = await supabase
    .from("bilan_orders")
    .select("id, prenom, email, status, pdf_url, audio_url")
    .eq("id", orderId)
    .maybeSingle()
  if (!row) return err("unauthorized ou commande introuvable", 401)

  if (row.status === "delivered") return ok({ already: true }) // idempotent : déjà envoyé
  if (row.status !== "generated") return err(`statut '${row.status}' (attendu 'generated')`, 409)
  if (!row.pdf_url) return err("pdf_url manquant sur une commande generated", 422)

  // Liens signés (PDF obligatoire, vocal optionnel) + téléchargement du PDF pour pièce jointe.
  const { data: pdfSigned } = await supabase.storage.from(BUCKET).createSignedUrl(row.pdf_url, SIGNED_TTL)
  let audioSignedUrl: string | null = null
  if (row.audio_url) {
    const { data: aud } = await supabase.storage.from(BUCKET).createSignedUrl(row.audio_url, SIGNED_TTL)
    audioSignedUrl = aud?.signedUrl ?? null
  }

  // Pièce jointe PDF (sous le seuil de taille).
  const attachments: { filename: string; contentType: string; encoding: "base64"; content: string }[] = []
  const { data: pdfBlob, error: dlErr } = await supabase.storage.from(BUCKET).download(row.pdf_url)
  if (dlErr || !pdfBlob) return err(`download PDF échoué: ${dlErr?.message ?? "vide"}`, 502)
  const pdfBytes = new Uint8Array(await pdfBlob.arrayBuffer())
  if (pdfBytes.byteLength <= MAX_ATTACH_BYTES) {
    attachments.push({
      filename: "bilan-du-fauve.pdf",
      contentType: "application/pdf",
      encoding: "base64",
      content: encodeBase64(pdfBytes),
    })
  }

  // Contenu : payload Oracle (voix du Fauve) sinon fallback sobre.
  const prenom = (row.prenom ?? "").trim()
  const subject = body.subject?.trim() || "Ton Bilan du Fauve est prêt"
  const bodyHtml = body.html?.trim() ||
    `<p>${prenom ? `${prenom},` : "Bonjour,"}</p>
     <p>Le Fauve a observé. Ton bilan personnel est prêt.</p>
     <p>Tu le trouveras en pièce jointe (PDF), et tu peux aussi écouter le message du Fauve.</p>`
  const bodyText = body.text?.trim() ||
    `${prenom ? `${prenom},` : "Bonjour,"}\n\nLe Fauve a observé. Ton bilan personnel est prêt.\nTu le trouveras en pièce jointe (PDF), et tu peux écouter le message du Fauve.\n`

  // Footer liens signés (toujours ajouté : backup si la pièce jointe est filtrée + accès au vocal).
  const linksHtml = `<hr style="border:none;border-top:1px solid #e5ded5;margin:24px 0"/>
    <p style="font-size:14px;color:#6b6358">
      📄 <a href="${pdfSigned?.signedUrl ?? "#"}">Télécharger ton bilan (PDF)</a>${
        audioSignedUrl ? `<br/>🔊 <a href="${audioSignedUrl}">Écouter le message du Fauve</a>` : ""
      }
    </p>
    <p style="font-size:12px;color:#9a9286">Le Fauve Pacifique · lefauvepacifique.com</p>`
  const linksText = `\n—\n📄 Ton bilan (PDF) : ${pdfSigned?.signedUrl ?? ""}${
    audioSignedUrl ? `\n🔊 Le message du Fauve : ${audioSignedUrl}` : ""
  }\nLe Fauve Pacifique · lefauvepacifique.com\n`

  // Envoi SMTP.
  const port = Number(Deno.env.get("SMTP_PORT") ?? "465")
  const tls = (Deno.env.get("SMTP_TLS") ?? "true") === "true"
  const fromAddr = Deno.env.get("SMTP_FROM") ?? "contact@lefauvepacifique.com"
  const fromName = Deno.env.get("SMTP_FROM_NAME") ?? "Le Fauve"
  const client = new SMTPClient({
    connection: {
      hostname: Deno.env.get("SMTP_HOST") ?? "mail.infomaniak.com",
      port,
      tls,
      auth: { username: Deno.env.get("SMTP_USER")!, password: Deno.env.get("SMTP_PASS")! },
    },
  })
  try {
    await client.send({
      from: `${fromName} <${fromAddr}>`,
      to: row.email,
      subject,
      content: bodyText + linksText,
      html: bodyHtml + linksHtml,
      attachments,
    })
  } catch (e) {
    try { await client.close() } catch { /* noop */ }
    // Échec SMTP → on NE touche PAS le statut (reste 'generated' = rejouable). Oracle retry.
    return err(`SMTP: ${(e as Error).message}`, 502)
  }
  try { await client.close() } catch { /* noop */ }

  // Succès → delivered (garde idempotente : seulement si encore 'generated').
  const { error: updErr } = await supabase
    .from("bilan_orders")
    .update({ status: "delivered", delivered_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("status", "generated")
  if (updErr) {
    // Email parti mais maj statut KO : on signale (Oracle peut re-POST → no-op idempotent 'delivered'...
    // mais ici on est encore 'generated' donc un retry renverrait l'email. On préfère 200 + flag pour
    // éviter le double-envoi : l'email EST parti). Bobby/Oracle corrige le statut à la main si ça arrive.
    return ok({ warning: `email envoyé mais maj statut échouée: ${updErr.message}` })
  }
  return ok({ delivered: true, to: row.email })
})
