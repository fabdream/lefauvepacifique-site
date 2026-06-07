import { useEffect, useRef, useState } from "react"
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js"
import { QUESTIONS, type Answers } from "./questions"
import { buildTeaser, LOCKED_SECTIONS } from "./teaser"
import { hasPaymentConfig, getStripe, createLead, createPaymentIntent, getOrderStatus } from "./payment"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const stripePromise = getStripe()

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

  const total = QUESTIONS.length

  if (done) {
    return (
      <Teaser
        answers={answers}
        onRestart={() => { setDone(false); setStep(0); setAnswers({}); setDraft(""); setErr("") }}
      />
    )
  }

  const q = QUESTIONS[step]

  const goNext = (value: string) => {
    const next = { ...answers, [q.id]: value }
    setAnswers(next)
    setErr("")
    if (step + 1 >= total) { setDone(true); return }
    const nq = QUESTIONS[step + 1]
    setStep(step + 1)
    setDraft(nq.kind !== "choice" ? (next[nq.id] ?? "") : "")
  }

  const goBack = () => {
    if (step === 0) return
    const prev = step - 1
    setStep(prev)
    setErr("")
    setDraft(QUESTIONS[prev].kind !== "choice" ? (answers[QUESTIONS[prev].id] ?? "") : "")
  }

  const submitField = () => {
    const v = draft.trim()
    if (q.kind === "text" && !v) { setErr("Dis-moi juste ça."); return }
    if (q.kind === "email" && !EMAIL_RE.test(v)) { setErr("Il me faut un email valide pour t'envoyer ton bilan."); return }
    goNext(v)
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
    createLead({ prenom: answers.prenom ?? "", email: answers.email ?? "", answers, teaser_text: teaserText })
      .then((r) => { if (!cancelled) setOrderId(r.order_id) })
      .catch(() => { /* silencieux : le teaser reste affiché, on retentera au paiement */ })
    return () => { cancelled = true }
  }, [answers, teaserText])

  const unlock = async () => {
    if (!hasPaymentConfig) { setPlaceholder(true); return }
    setBusy(true); setErr("")
    try {
      let oid = orderId
      if (!oid) { oid = (await createLead({ prenom: answers.prenom ?? "", email: answers.email ?? "", answers, teaser_text: teaserText })).order_id; setOrderId(oid) }
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

function Processing({ orderId }: { orderId: string }) {
  const [status, setStatus] = useState("paid")
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
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

  return (
    <div className="paywall">
      {status !== "delivered" ? (
        <>
          <div className="price" style={{ fontSize: 40 }}>✓</div>
          <div className="pitch">Paiement reçu. Le Fauve prépare ton bilan complet, ça arrive…</div>
          <div className="reassure">Tu peux fermer cette page : tu le recevras aussi par mail.</div>
        </>
      ) : (
        <>
          <div className="pitch">Ton bilan est prêt 🐺</div>
          {pdfUrl && <a className="btn btn-primary" style={{ width: "100%" }} href={pdfUrl} target="_blank" rel="noreferrer">Ouvrir mon bilan</a>}
          {audioUrl && <a className="btn btn-ghost" style={{ width: "100%", marginTop: 10 }} href={audioUrl} target="_blank" rel="noreferrer">🔊 Écouter le message du Fauve</a>}
          <div className="reassure">Une copie t'a aussi été envoyée par mail.</div>
        </>
      )}
    </div>
  )
}
