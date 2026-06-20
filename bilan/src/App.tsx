import { useEffect, useRef, useState } from "react"
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js"
import { QUESTIONS, type Answers, type Question } from "./questions"
import { buildTeaser, LOCKED_SECTIONS } from "./teaser"
import { hasPaymentConfig, getStripe, createLead, createPaymentIntent, getOrderStatus } from "./payment"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const stripePromise = getStripe()

// Suggestion de typo de DOMAINE email (gmial→gmail, hotmial→hotmail...). Levenshtein ≤2 sur le domaine.
// Le cas typo du DÉBUT (vansssa) est attrapé par la confirmation visuelle, pas ici.
const COMMON_EMAIL_DOMAINS = ["gmail.com", "hotmail.com", "hotmail.fr", "outlook.com", "outlook.fr", "yahoo.com", "yahoo.fr", "icloud.com", "live.fr", "orange.fr", "wanadoo.fr", "free.fr", "sfr.fr", "laposte.net", "bluewin.ch", "gmx.ch", "protonmail.com"]
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const d: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) d[i][0] = i
  for (let j = 0; j <= n; j++) d[0][j] = j
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return d[m][n]
}
function suggestEmail(email: string): string | null {
  const at = email.lastIndexOf("@")
  if (at < 1) return null
  const domain = email.slice(at + 1).toLowerCase()
  if (!domain || COMMON_EMAIL_DOMAINS.includes(domain)) return null
  let best: string | null = null, bestD = 3
  for (const dom of COMMON_EMAIL_DOMAINS) { const dist = levenshtein(domain, dom); if (dist > 0 && dist < bestD) { bestD = dist; best = dom } }
  return best ? email.slice(0, at + 1) + best : null
}

// Une question conditionnelle (choice + showIf) n'est visible que si AU MOINS une de ses conditions matche (OR).
// Toute autre question est toujours visible.
function isVisible(qq: Question, a: Answers): boolean {
  return !(qq.kind === "choice" && qq.showIf) || qq.showIf.some((c) => a[c.field] === c.value)
}

// Sérialisation des réponses pour le worker :
//  - STRIP des réponses des questions devenues cachées (ex: retour-arrière qui change l'objectif → données d'axe périmées)
//  - allergies (multi-select stocké en CSV interne) → array de slugs
function forApi(a: Answers): Record<string, unknown> {
  const visibleIds = new Set(QUESTIONS.filter((qq) => isVisible(qq, a)).map((qq) => qq.id))
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(a)) {
    if (!visibleIds.has(k)) continue
    out[k] = k === "allergies" ? v.split(",").filter(Boolean) : v
  }
  return out
}

// Thème du Payment Element accordé à l'identité Le Fauve (dark + terracotta).
const stripeAppearance = {
  theme: "night" as const,
  variables: {
    colorPrimary: "#C68A4B",
    colorBackground: "#2A1E14",
    colorText: "#F5EAD7",
    colorTextSecondary: "#D9A66E",
    fontFamily: "Inter, system-ui, sans-serif",
    borderRadius: "2px",
  },
}

export default function App() {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Answers>({})
  const [done, setDone] = useState(false)
  const [draft, setDraft] = useState("")
  const [err, setErr] = useState("")

  // Questions VISIBLES selon les réponses (gère les conditionnelles, ex: cycle affiché seulement si sexe=femme).
  const visible = QUESTIONS.filter((qq) => isVisible(qq, answers))
  const total = visible.length

  if (done) {
    return (
      <Teaser
        answers={answers}
        onEmailChange={(email) => setAnswers((a) => ({ ...a, email }))}
        onRestart={() => { setDone(false); setStep(0); setAnswers({}); setDraft(""); setErr("") }}
      />
    )
  }

  const q = visible[step]

  const goNext = (value: string) => {
    const next = { ...answers, [q.id]: value }
    // Si sexe repasse à non-femme, on purge une réponse cycle devenue caduque (pas envoyée au worker).
    if (q.id === "sexe" && value !== "femme") delete next.cycle
    setAnswers(next)
    setErr("")
    // Recalcule la liste visible avec les NOUVELLES réponses (le choix de sexe ajoute/retire cycle).
    const nextVisible = QUESTIONS.filter((qq) => isVisible(qq, next))
    if (step + 1 >= nextVisible.length) { setDone(true); return }
    const nq = nextVisible[step + 1]
    setStep(step + 1)
    setDraft(nq.kind !== "choice" ? (next[nq.id] ?? "") : "")
  }

  const goBack = () => {
    if (step === 0) return
    const prev = step - 1
    setStep(prev)
    setErr("")
    const pq = visible[prev]
    setDraft(pq.kind !== "choice" ? (answers[pq.id] ?? "") : "")
  }

  const submitField = () => {
    const v = draft.trim()
    if (q.kind === "text" && !v) { setErr("Dis-moi juste ça."); return }
    if (q.kind === "email" && !EMAIL_RE.test(v)) { setErr("Il me faut un email valide pour t'envoyer ton bilan."); return }
    goNext(v)
  }

  // Multi-select : toggle un slug dans answers[q.id] (CSV interne). `exclusive` (ex: "aucune") vide les autres
  // quand coché ; cocher un autre retire l'exclusif. On n'avance pas (l'utilisateur valide via "Continuer").
  const toggleMulti = (slug: string, exclusive?: string) => {
    setAnswers((prev) => {
      const set = new Set((prev[q.id] ?? "").split(",").filter(Boolean))
      if (set.has(slug)) set.delete(slug)
      else {
        if (exclusive) { if (slug === exclusive) set.clear(); else set.delete(exclusive) }
        set.add(slug)
      }
      return { ...prev, [q.id]: Array.from(set).join(",") }
    })
  }

  return (
    <div className="app">
      <div className="brand"><span className="brand-mark" />Le Fauve Pacifique</div>
      <div className="progress"><i style={{ width: `${(step / total) * 100}%` }} /></div>
      <div className="step-count">{step + 1} / {total}</div>

      <div className="stage" key={step}>
        <div className="q-anim">
          <div className="q-eyebrow">Ton bilan</div>
          <h1 className="q-prompt">{q.prompt}</h1>

          {q.kind === "choice" ? (
            <div className="choices">
              {q.choices.map((c) => (
                <button
                  key={c.value}
                  className={answers[q.id] === c.value ? "choice sel" : "choice"}
                  onClick={() => goNext(c.value)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          ) : q.kind === "multichoice" ? (
            <div className="field">
              <div className="choices">
                {q.choices.map((c) => (
                  <button
                    key={c.value}
                    className={(answers[q.id] ?? "").split(",").includes(c.value) ? "choice sel" : "choice"}
                    onClick={() => toggleMulti(c.value, q.exclusive)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <button className="btn btn-primary" style={{ marginTop: 4 }} onClick={() => goNext(answers[q.id] ?? "")}>
                Continuer <span className="arrow">→</span>
              </button>
            </div>
          ) : q.kind === "longtext" ? (
            <div className="field">
              <textarea
                placeholder={q.placeholder}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={4}
                autoFocus
              />
              <button className="btn btn-primary" onClick={() => goNext(draft.trim())} disabled={!draft.trim()}>
                Continuer <span className="arrow">→</span>
              </button>
              <div className="muted-note" onClick={() => goNext("")} style={{ cursor: "pointer" }}>Passer cette question</div>
            </div>
          ) : (
            <div className="field">
              <input
                type={q.kind === "email" ? "email" : "text"}
                inputMode={q.kind === "email" ? "email" : "text"}
                autoComplete={q.kind === "email" ? "email" : "given-name"}
                autoCapitalize={q.kind === "email" ? "off" : "words"}
                placeholder={q.placeholder}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submitField() }}
                autoFocus
              />
              <div className="err">{err}</div>
              <button className="btn btn-primary" onClick={submitField} disabled={!draft.trim()}>
                Continuer <span className="arrow">→</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="nav-row">
        <button className="back" onClick={goBack} disabled={step === 0}>← retour</button>
      </div>
    </div>
  )
}

type Phase = "preview" | "pay" | "processing"

function Teaser({ answers, onEmailChange, onRestart }: { answers: Answers; onEmailChange: (email: string) => void; onRestart: () => void }) {
  const teaserText = buildTeaser(answers)
  const paragraphs = teaserText.split("\n\n")

  // Confirmation visuelle de l'email avant paiement (anti-typo, protège le revenue). Édition inline → la correction
  // remonte dans answers.email → createLead repart avec le bon email (l'order pointe sur la bonne adresse).
  const [editingEmail, setEditingEmail] = useState(false)
  const [emailDraft, setEmailDraft] = useState(answers.email ?? "")
  const [emailErr, setEmailErr] = useState("")
  const emailSuggestion = suggestEmail(answers.email ?? "")

  const [phase, setPhase] = useState<Phase>("preview")
  const [orderId, setOrderId] = useState<string | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  const [placeholder, setPlaceholder] = useState(false) // sans config paiement : juste l'état "bientôt"
  const paywallRef = useRef<HTMLDivElement>(null) // cible du CTA sticky (scroll vers l'offre payante)

  // Capture du lead dès l'affichage du teaser (email + réponses + teaser), AVANT paiement.
  useEffect(() => {
    if (!hasPaymentConfig) return
    let cancelled = false
    createLead({ prenom: answers.prenom ?? "", email: answers.email ?? "", answers: forApi(answers), teaser_text: teaserText })
      .then((r) => { if (!cancelled) setOrderId(r.order_id) })
      .catch(() => { /* silencieux : le teaser reste affiché, on retentera au paiement */ })
    return () => { cancelled = true }
  }, [answers, teaserText])

  const unlock = async () => {
    if (!hasPaymentConfig) { setPlaceholder(true); return }
    setBusy(true); setErr("")
    try {
      let oid = orderId
      if (!oid) { oid = (await createLead({ prenom: answers.prenom ?? "", email: answers.email ?? "", answers: forApi(answers), teaser_text: teaserText })).order_id; setOrderId(oid) }
      const { client_secret } = await createPaymentIntent(oid)
      setClientSecret(client_secret)
      setPhase("pay")
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app">
      <div className="brand"><span className="brand-mark" />Le Fauve Pacifique</div>

      <div className="teaser">
        <div className="teaser-label">Ton diagnostic</div>
        <div className="diagnostic">
          {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
        </div>

        {phase === "preview" && (
          <>
            <div className="handoff">
              <p>Ça, c'est ce qui cloche. Maintenant, le plan pour en sortir. Écrit pour toi, pas pour tout le monde.</p>
              <p className="handoff-scroll">Fais défiler, voilà tout ce que tu débloques</p>
              <span className="handoff-arrow" aria-hidden="true">↓</span>
            </div>

            <div className="locked-head">
              <h2 className="locked-title">Ton bilan complet</h2>
              <p className="locked-sub">9 sections détaillées + le vocal du Fauve, écrites pour ta situation.</p>
            </div>
            <div className="locked-list">
              {LOCKED_SECTIONS.map((s, i) => (
                <div className="locked-item" key={i}>
                  <span className="lock">🔒</span>
                  <span className="lk-text">
                    <span className="lk-title">{s.title}</span>
                    <span className="lk-sub">{s.sub}</span>
                  </span>
                </div>
              ))}
            </div>

            <div className="paywall" ref={paywallRef}>
              <div className="price">5.-<small> EUR</small></div>
              <div className="pitch">Ton bilan complet : ton plan personnalisé, écrit pour ta situation, livré par mail. Plus un message vocal où je te parle directement. Pas un PDF générique. Le tien.</div>

              <div className="email-confirm" style={{ margin: "16px 0 4px", textAlign: "left", fontSize: 14, lineHeight: 1.55 }}>
                {editingEmail ? (
                  <>
                    <input
                      type="email" inputMode="email" autoComplete="email" autoCapitalize="off" spellCheck={false}
                      value={emailDraft}
                      onChange={(e) => { setEmailDraft(e.target.value); setEmailErr("") }}
                      placeholder="ton@email.com"
                      aria-label="Corrige ton email"
                      style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 2, border: "1px solid #C68A4B", background: "#2A1E14", color: "#F5EAD7", fontSize: 16 }}
                    />
                    <button
                      className="btn btn-primary" style={{ width: "100%", marginTop: 8 }}
                      onClick={() => { const v = emailDraft.trim(); if (!EMAIL_RE.test(v)) { setEmailErr("Il me faut un email valide."); return } onEmailChange(v); setEditingEmail(false) }}
                    >Valider cet email</button>
                    {emailErr && <div className="reassure" style={{ color: "#E0794B" }}>{emailErr}</div>}
                  </>
                ) : (
                  <>
                    <span style={{ color: "#D9A66E" }}>📩 On envoie ton bilan à&nbsp;:</span>{" "}
                    <strong style={{ color: "#F5EAD7", wordBreak: "break-all" }}>{answers.email}</strong>{" "}
                    <button
                      onClick={() => { setEmailDraft(answers.email ?? ""); setEmailErr(""); setEditingEmail(true) }}
                      style={{ background: "none", border: "none", color: "#C68A4B", textDecoration: "underline", cursor: "pointer", padding: 0, font: "inherit" }}
                    >modifier</button>
                    {emailSuggestion && (
                      <div style={{ marginTop: 6, color: "#E0794B" }}>
                        Tu voulais dire{" "}
                        <button
                          onClick={() => onEmailChange(emailSuggestion)}
                          style={{ background: "none", border: "none", color: "#E0794B", textDecoration: "underline", cursor: "pointer", padding: 0, font: "inherit", fontWeight: 600 }}
                        >{emailSuggestion}</button>&nbsp;?
                      </div>
                    )}
                  </>
                )}
              </div>

              <button className="btn btn-primary" onClick={() => void unlock()} disabled={busy || editingEmail}>
                {busy ? "…" : "Débloque ton bilan complet"}
              </button>
              {err && <div className="reassure" style={{ color: "#E0794B" }}>{err}</div>}
              <div className="reassure">
                {placeholder
                  ? "Paiement en cours de branchement (mode test). Le Fauve génère ton bilan dès que tu as payé."
                  : "Paiement sécurisé. Bilan livré en quelques minutes."}
              </div>
            </div>
          </>
        )}

        {phase === "pay" && clientSecret && (
          <Elements stripe={stripePromise} options={{ clientSecret, appearance: stripeAppearance }}>
            <PaymentStep onPaid={() => setPhase("processing")} onBack={() => setPhase("preview")} />
          </Elements>
        )}

        {phase === "processing" && orderId && <Processing orderId={orderId} />}

        <p className="disclaimer">
          Le Fauve n'est pas médecin. Ce bilan complète un suivi de santé, il ne le remplace pas.
        </p>

        {phase === "preview" && (
          <div className="muted-note" onClick={onRestart} style={{ cursor: "pointer" }}>↺ recommencer le test</div>
        )}
      </div>

      {/* CTA collant : signale l'offre payante pendant tout le teaser (les gens partaient sans scroller). */}
      {phase === "preview" && (
        <button
          type="button"
          className="sticky-cta"
          onClick={() => paywallRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
        >
          Débloque ton bilan complet <span className="sticky-cta-price">5€</span>
        </button>
      )}
    </div>
  )
}

function PaymentStep({ onPaid, onBack }: { onPaid: () => void; onBack: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")

  const pay = async () => {
    if (!stripe || !elements) return
    setBusy(true); setErr("")
    const { error, paymentIntent } = await stripe.confirmPayment({ elements, redirect: "if_required" })
    if (error) { setErr(error.message ?? "Paiement refusé, réessaie."); setBusy(false); return }
    if (paymentIntent && (paymentIntent.status === "succeeded" || paymentIntent.status === "processing")) { onPaid(); return }
    setBusy(false)
  }

  return (
    <div className="paywall">
      <div className="teaser-label" style={{ marginBottom: 16 }}>Paiement · 5.- EUR</div>
      <PaymentElement />
      <button className="btn btn-primary" style={{ width: "100%", marginTop: 18 }} onClick={() => void pay()} disabled={busy || !stripe}>
        {busy ? "Paiement…" : "Payer 5 EUR"}
      </button>
      {err && <div className="reassure" style={{ color: "#E0794B" }}>{err}</div>}
      <div className="muted-note" onClick={onBack} style={{ cursor: "pointer" }}>← retour</div>
    </div>
  )
}

// Suivi LIVE post-paiement (voix du Fauve, copy Oracle). Le statut transite paid→processing→generated→delivered
// (le worker cloud génère en ~2min). Titre + sous-message par étape ; pendant la génération, sous-messages
// "vivants" en rotation toutes les 8s. Le 🐺 est réservé au delivered.
const STAGE: Record<string, { title: string; sub: string }> = {
  paid: { title: "Paiement reçu.", sub: "Le Fauve s'installe pour t'écrire…" },
  processing: { title: "Le Fauve écrit ton bilan.", sub: "Rien que pour toi, à partir de ce que tu lui as dit. Une à deux minutes, reste là." },
  generated: { title: "Ton bilan est prêt.", sub: "Il prépare ta version…" },
}
const PROCESSING_SUBS = [
  "Rien que pour toi, à partir de ce que tu lui as dit. Une à deux minutes, reste là.",
  "Il regarde ta situation, dans le détail.",
  "Il écrit ton plan, dans l'ordre. Pas 15 trucs, les 3 qui comptent.",
  "Il enregistre ton message vocal…",
  "Le bon truc prend un peu de temps.",
]

function Processing({ orderId }: { orderId: string }) {
  const [status, setStatus] = useState("paid")
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [subIdx, setSubIdx] = useState(0)
  const [pct, setPct] = useState(6)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const poll = async () => {
      try {
        const r = await getOrderStatus(orderId)
        setStatus(r.status)
        if (r.pdf_url) setPdfUrl(r.pdf_url)
        if (r.audio_url) setAudioUrl(r.audio_url)
        // Dès que le bilan est PRÊT (pdf dispo), on stoppe le polling — MÊME si l'email n'est pas encore 'delivered'.
        // → le client récupère toujours son bilan ici, indépendamment de l'email (filet anti-email-foireux).
        if (r.pdf_url && timer.current) clearInterval(timer.current)
      } catch { /* on retente au prochain tick */ }
    }
    void poll()
    timer.current = setInterval(() => void poll(), 3000)
    return () => { if (timer.current) clearInterval(timer.current) }
  }, [orderId])

  // Sous-messages "vivants" pendant la génération (rotation toutes les 8s) → feeling live sur les ~2min.
  useEffect(() => {
    if (status !== "processing") return
    const id = setInterval(() => setSubIdx((i) => (i + 1) % PROCESSING_SUBS.length), 8000)
    return () => clearInterval(id)
  }, [status])

  // Barre de progression : avance vite au début puis ralentit en approchant 95% (ease asymptotique).
  // Honnête — elle ne touche jamais 100% tant que le PDF n'est pas prêt ; à ce moment on bascule sur l'écran
  // de téléchargement. But : rassurer "ça avance, t'inquiète, ton bilan arrive" pendant les ~2min.
  useEffect(() => {
    if (pdfUrl) return
    const id = setInterval(() => setPct((p) => (p < 95 ? p + Math.max(0.4, (95 - p) * 0.035) : p)), 700)
    return () => clearInterval(id)
  }, [pdfUrl])

  // Bilan PRÊT (pdf dispo) → on montre les boutons de téléchargement, que l'email soit parti ('delivered') ou
  // pas encore/échoué ('generated'). Le client repart TOUJOURS avec son bilan depuis cette page.
  if (pdfUrl) {
    return (
      <div className="paywall">
        <div className="pitch">Ton bilan t'attend. 🐺</div>
        <a className="btn btn-primary" style={{ width: "100%", marginTop: 6 }} href={pdfUrl} target="_blank" rel="noreferrer">📄 Télécharge ton bilan (PDF)</a>
        {audioUrl && <a className="btn btn-ghost" style={{ width: "100%", marginTop: 10 }} href={audioUrl} target="_blank" rel="noreferrer">🎧 Écoute le message du Fauve</a>}
        <div className="reassure">
          {status === "delivered"
            ? "Télécharge-le maintenant, et garde-le. On te l'a aussi envoyé par mail."
            : "Télécharge-le maintenant, et garde-le. (Ton email arrive aussi.)"}
        </div>
      </div>
    )
  }

  const stage = STAGE[status] ?? STAGE.processing
  const sub = status === "processing" ? PROCESSING_SUBS[subIdx] : stage.sub
  return (
    <div className="paywall">
      <div className="spinner" aria-hidden="true" />
      <div className="pitch">{stage.title}</div>
      <div className="progress-sub" key={status === "processing" ? subIdx : status}>{sub}</div>
      <div className="progress" style={{ maxWidth: "32ch", height: 6, borderRadius: 6, margin: "20px auto 0" }} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <i style={{ width: `${pct}%` }} />
      </div>
      <div className="reassure" style={{ marginTop: 8 }}>{Math.round(pct)}% · ne ferme pas cette page</div>
    </div>
  )
}
