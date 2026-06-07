// Les 10 questions du Bilan du Fauve (validées Fabio) + prénom + email.
// Voix du Fauve : brut, direct, tutoiement. Les `value` sont des clés stables (mappées par le teaser).

export type Choice = { value: string; label: string }

export type Question =
  | { id: string; kind: "text"; prompt: string; placeholder: string }
  | { id: string; kind: "email"; prompt: string; placeholder: string }
  | { id: string; kind: "choice"; prompt: string; choices: Choice[] }

export const QUESTIONS: Question[] = [
  { id: "prenom", kind: "text", prompt: "On commence. C'est quoi ton prénom ?", placeholder: "Ton prénom" },
  { id: "email", kind: "email", prompt: "Ton email. C'est là que je t'envoie ton bilan.", placeholder: "ton@email.com" },
  {
    id: "age", kind: "choice", prompt: "T'as quel âge ?",
    choices: [
      { value: "-40", label: "Moins de 40 ans" },
      { value: "40-50", label: "40 à 50 ans" },
      { value: "50-60", label: "50 à 60 ans" },
      { value: "60-70", label: "60 à 70 ans" },
      { value: "70+", label: "Plus de 70 ans" },
    ],
  },
  {
    id: "sexe", kind: "choice", prompt: "Homme ou femme ?",
    choices: [
      { value: "homme", label: "Homme" },
      { value: "femme", label: "Femme" },
    ],
  },
  {
    id: "sommeil", kind: "choice", prompt: "Ton sommeil, ça donne quoi ?",
    choices: [
      { value: "bien", label: "Je dors bien" },
      { value: "reveil-nuit", label: "Je me réveille la nuit" },
      { value: "endormissement", label: "J'ai du mal à m'endormir" },
      { value: "reveil-fatigue", label: "Je me réveille fatigué" },
    ],
  },
  {
    id: "energie", kind: "choice", prompt: "Et ton énergie dans la journée ?",
    choices: [
      { value: "stable", label: "Stable, ça tient" },
      { value: "barre-aprem", label: "Coup de barre l'après-midi" },
      { value: "vide", label: "Vidé en permanence" },
      { value: "yoyo", label: "Ça dépend des jours" },
    ],
  },
  {
    id: "stress", kind: "choice", prompt: "Niveau tension, stress ?",
    choices: [
      { value: "calme", label: "Plutôt calme" },
      { value: "tendu", label: "Tendu par moments" },
      { value: "pression", label: "Souvent sous pression" },
      { value: "a-bout", label: "À bout" },
    ],
  },
  {
    id: "mouvement", kind: "choice", prompt: "Tu bouges ton corps ?",
    choices: [
      { value: "quotidien", label: "Tous les jours" },
      { value: "un-peu", label: "Un peu" },
      { value: "jamais", label: "Presque jamais" },
      { value: "douleurs", label: "Des douleurs qui me bloquent" },
    ],
  },
  {
    id: "assiette", kind: "choice", prompt: "Ton assiette, franchement ?",
    choices: [
      { value: "maison", label: "Brut, fait maison" },
      { value: "melange", label: "Un mélange" },
      { value: "industriel", label: "Beaucoup d'industriel" },
      { value: "grignote", label: "Je grignote, du sucre" },
    ],
  },
  {
    id: "ventre", kind: "choice", prompt: "Et ton ventre, ta digestion ?",
    choices: [
      { value: "nickel", label: "Nickel" },
      { value: "ballonne", label: "Souvent ballonné" },
      { value: "lourd", label: "Lourd après les repas" },
      { value: "irregulier", label: "Irrégulier" },
    ],
  },
  {
    id: "pese", kind: "choice", prompt: "Ce qui te pèse le plus en ce moment ?",
    choices: [
      { value: "fatigue", label: "La fatigue" },
      { value: "sommeil", label: "Mon sommeil" },
      { value: "poids", label: "Mon poids" },
      { value: "moral", label: "Mon moral" },
      { value: "douleurs", label: "Mes douleurs" },
      { value: "sais-pas", label: "Je sais pas par où commencer" },
    ],
  },
  {
    id: "objectif", kind: "choice", prompt: "Ton objectif numéro 1 ?",
    choices: [
      { value: "energie", label: "Retrouver de l'énergie" },
      { value: "dormir", label: "Mieux dormir" },
      { value: "bouger", label: "Bouger sans douleur" },
      { value: "manger", label: "Manger mieux" },
      { value: "corps", label: "Me sentir bien dans mon corps" },
      { value: "vieillir", label: "Vieillir en forme" },
    ],
  },
]

export type Answers = Record<string, string>
