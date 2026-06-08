import { useEffect, useRef, useState } from "react"
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js"
import { QUESTIONS, type Answers } from "./questions"
import { buildTeaser, LOCKED_SECTIONS } from "./teaser"
import { hasPaymentConfig, getStripe, createLead, createPaymentIntent, getOrderStatus } from "./payment"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const stripePromise = getStripe()

// Sérialisation des réponses pour le worker : allergies (multi-select stocké en CSV interne) → array de slugs.
function forApi(a: Answers): Record<string, unknown> {
  return a.allergies !== undefined ? { ...a, allergies: a.allergies.split(",").filter(Boolean) } : a
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
  const visible = QUESTIONS.filter((qq) => (qq.kind === "choice" && qq.showIf) ? answers[qq.showIf.field] === qq.showIf.value : true)
  const total = visible.length

  if (done) {
    return (
      <Teaser
        answers={answers}
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
    const nextVisible = QUESTIONS.filter((qq) => (qq.kind === "choice" && qq.showIf) ? next[qq.showIf.field] === qq.showIf.value : true)
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

function Teaser({ answers, onRestart }: { answers: Answers; onRestart: () => void }) {
  const teaserText = buildTeaser(answers)
  const paragraphs = teaserText.split("\n\n")

  const [phase, setPhase] = useState<Phase>("preview")
  const [orderId, setOrderId] = useState<string | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  const [placeholder, setPlaceholder] = useState(false) // sans config paiement : juste l'état "bientôt"

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
            <div className="locked-head"><span className="section-label">Ton bilan complet</span></div>
            <div className="locked-list">
              {LOCKED_SECTIONS.map((s, i) => (
                <div className="locked-item" key={i}>
                  <span className="lock">🔒</span>
                  <span className="txt">{s}</span>
                </div>
              ))}
            </div>

            <div className="paywall">
              <div className="price">29.-<small> CHF</small></div>
              <div className="pitch">Ton bilan complet, personnalisé, livré par mail. Plus le mot du Fauve en vocal.</div>
              <button className="btn btn-primary" onClick={() => void unlock()} disabled={busy}>
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
      <div className="teaser-label" style={{ marginBottom: 16 }}>Paiement · 29.- CHF</div>
      <PaymentElement />
      <button className="btn btn-primary" style={{ width: "100%", marginTop: 18 }} onClick={() => void pay()} disabled={busy || !stripe}>
        {busy ? "Paiement…" : "Payer 29 CHF"}
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
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const poll = async () => {
      try {
        const r = await getOrderStatus(orderId)
        setStatus(r.status)
        if (r.status === "delivered") {
          setPdfUrl(r.pdf_url)
          setAudioUrl(r.audio_url)
          if (timer.current) clearInterval(timer.current)
        }
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

  if (status === "delivered") {
    return (
      <div className="paywall">
        <div className="pitch">Ton bilan t'attend. 🐺</div>
        {pdfUrl && <a className="btn btn-primary" style={{ width: "100%" }} href={pdfUrl} target="_blank" rel="noreferrer">Voir mon bilan (PDF)</a>}
        {audioUrl && <a className="btn btn-ghost" style={{ width: "100%", marginTop: 10 }} href={audioUrl} target="_blank" rel="noreferrer">Écouter le message du Fauve</a>}
        <div className="reassure">Lis-le maintenant. On te l'a aussi envoyé par mail.</div>
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
    </div>
  )
}
