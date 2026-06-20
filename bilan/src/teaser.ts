// Teaser = TEMPLATE (mapping réponse→phrase fourni par Oracle/Le Fauve). Zéro API, interpolation instantanée.
// Règle : n'inclure QUE les réponses "problème" (skip les positives), ordre de priorité, max 5 phrases,
// puis la phrase Q9 (ce qui pèse) + la clôture Q10 (objectif). Voix du Fauve.

import type { Answers } from "./questions"

const PROBLEM: Record<string, Record<string, string>> = {
  sommeil: {
    "reveil-nuit": "Tu te réveilles en pleine nuit, souvent vers 3-4h, et t'as du mal à repartir.",
    endormissement: "Le soir, tu tournes dans le lit, ta tête s'arrête pas.",
    "reveil-fatigue": "Tu te réveilles déjà vidé, comme si la nuit avait servi à rien.",
  },
  energie: {
    "barre-aprem": "Et chaque après-midi, le mur : un coup de barre que le café règle plus.",
    vide: "T'es vidé en permanence, dès le matin, sans vraie raison.",
    yoyo: "Ton énergie fait du yo-yo, un jour ça va, le lendemain t'es à plat.",
  },
  mouvement: {
    "un-peu": "Tu bouges un peu, mais pas assez pour que ça compte.",
    jamais: "Ton corps bouge presque plus, et il commence à le faire payer.",
    douleurs: "T'as des douleurs qui te bloquent, donc tu bouges moins, et le cercle se referme.",
  },
  assiette: {
    melange: "Ton assiette c'est un mélange : du bon, et pas mal de pièges sans t'en rendre compte.",
    industriel: "Tu manges beaucoup d'industriel, ton corps encaisse en silence.",
    grignote: "Tu grignotes, le sucre revient en boucle, surtout aux moments creux.",
  },
  ventre: {
    ballonne: "Ton ventre est souvent ballonné.",
    lourd: "Après les repas, t'es lourd, ramolli.",
    irregulier: "Ton transit est en dents de scie.",
  },
  stress: {
    tendu: "T'es tendu par moments, ça monte sans prévenir.",
    pression: "Tu vis sous pression, ton corps redescend jamais vraiment.",
    "a-bout": "T'es à bout, tu tiens à la volonté.",
  },
}

// Ordre d'assemblage (priorité Oracle). Si > MAX problèmes, on coupe la fin (stress part en premier).
const PRIORITY = ["sommeil", "energie", "mouvement", "assiette", "ventre", "stress"]
const MAX_PROBLEMS = 5

const PESE: Record<string, string> = {
  fatigue: "la fatigue qui lâche jamais",
  sommeil: "ton sommeil cassé",
  poids: "ton poids",
  moral: "ton moral en berne",
  douleurs: "tes douleurs",
  "sais-pas": "le fait de pas savoir par où commencer",
}

const OBJECTIF: Record<string, string> = {
  energie: "retrouver de l'énergie",
  dormir: "mieux dormir",
  bouger: "bouger sans douleur",
  manger: "manger mieux sans te prendre la tête",
  corps: "te sentir bien dans ton corps",
  vieillir: "vieillir en forme",
}

// Construit le diagnostic teaser (texte, paragraphes séparés par \n\n). Sauvé dans bilan_orders.teaser_text.
export function buildTeaser(a: Answers): string {
  const prenom = (a.prenom || "").trim() || "Toi"
  const lines: string[] = [`${prenom}.`]

  const problems: string[] = []
  for (const q of PRIORITY) {
    const phrase = PROBLEM[q]?.[a[q]]
    if (phrase) problems.push(phrase)
  }
  lines.push(...problems.slice(0, MAX_PROBLEMS))

  if (a.pese && PESE[a.pese]) lines.push(`Et au fond, ce qui te pèse le plus, c'est ${PESE[a.pese]}.`)

  const obj = (a.objectif && OBJECTIF[a.objectif]) || "te sentir mieux dans ton corps"
  lines.push(
    `Ton objectif : ${obj}. C'est jouable. Je vais te dire d'où ça vient, et quoi faire, dans l'ordre. Pas 15 trucs. Les 3 qui comptent.`,
  )

  return lines.join("\n\n")
}

// Sommaire du bilan complet v2, VERROUILLÉ jusqu'au paiement (8 rubriques + le vocal). Titre + sous-ligne
// (copy v2 Oracle : on enrichit pour que les gens RÉALISENT ce qu'ils débloquent, pas une liste de titres nus).
// "Ton terrain"/"Ton diagnostic" restent hors verrouillé = partie gratuite du teaser.
export const LOCKED_SECTIONS: { title: string; sub: string }[] = [
  { title: "D'où ça vient vraiment", sub: "La cause, pas le symptôme. Le mécanisme dans ton cas précis." },
  { title: "Tes 3 leviers prioritaires", sub: "Pas 15 trucs. Les 3 qui changent tout, et par lequel commencer." },
  { title: "Ton plan, dès ce soir", sub: "La première chose à faire en rentrant. Concrète, simple." },
  { title: "Ton assiette", sub: "Ce qu'on vire, ce qu'on remplace, sans te prendre la tête." },
  { title: "Ton mouvement minimum", sub: "Le strict nécessaire, adapté à ton corps." },
  { title: "Ta semaine type, jour par jour", sub: "Un vrai planning, pas des conseils en l'air." },
  { title: "Tes erreurs à éviter", sub: "Les pièges où presque tout le monde se plante." },
  { title: "À quoi t'attendre, semaine après semaine", sub: "Pour tenir, et voir que ça bouge." },
  { title: "🎙️ Le mot du Fauve", sub: "Ma voix, deux minutes, rien que pour toi, sur ta situation." },
]
