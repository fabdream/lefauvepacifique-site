// Les 10 questions du Bilan du Fauve (validées Fabio) + prénom + email.
// Voix du Fauve : brut, direct, tutoiement. Les `value` sont des clés stables (mappées par le teaser).

export type Choice = { value: string; label: string }

export type Question =
  | { id: string; kind: "text"; prompt: string; placeholder: string }
  | { id: string; kind: "email"; prompt: string; placeholder: string }
  | { id: string; kind: "longtext"; prompt: string; placeholder: string } // texte libre OPTIONNEL (skippable)
  // showIf : question conditionnelle, affichée seulement si answers[field] === value (ex: cycle si sexe=femme).
  | { id: string; kind: "choice"; prompt: string; choices: Choice[]; showIf?: { field: string; value: string }[] } // showIf = array de conditions en OR (affiché si au moins une matche)
  | { id: string; kind: "multichoice"; prompt: string; choices: Choice[]; exclusive?: string } // multi-select ; exclusive = slug qui vide les autres

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
    id: "cycle", kind: "choice", prompt: "Et côté cycle, t'en es où ?",
    showIf: [{ field: "sexe", value: "femme" }],
    choices: [
      { value: "regles-difficiles", label: "Règles difficiles" },
      { value: "premenopause", label: "Préménopause" },
      { value: "menopause", label: "Ménopause" },
      { value: "rien", label: "Rien de particulier" },
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
    id: "hydratation", kind: "choice", prompt: "Tu bois assez d'eau dans la journée ?",
    choices: [
      { value: "moins-1l", label: "Moins d'1 litre" },
      { value: "1-1.5l", label: "1 à 1,5 litre" },
      { value: "1.5-2l", label: "1,5 à 2 litres" },
      { value: "cafe-sodas", label: "Surtout café / sodas" },
    ],
  },
  {
    id: "cafe", kind: "choice", prompt: "Café, excitants, t'en es où ?",
    choices: [
      { value: "0-1", label: "0 à 1 par jour" },
      { value: "2-3", label: "2 à 3 par jour" },
      { value: "4plus", label: "4 et plus" },
      { value: "energisantes", label: "Boissons énergisantes" },
    ],
  },
  {
    id: "allergies", kind: "multichoice", prompt: "Des allergies ou intolérances ?",
    exclusive: "aucune",
    choices: [
      { value: "aucune", label: "Aucune" },
      { value: "lactose", label: "Lactose" },
      { value: "gluten", label: "Gluten" },
      { value: "fruits-a-coque", label: "Fruits à coque" },
      { value: "oeufs", label: "Œufs" },
      { value: "autres", label: "Autres" },
    ],
  },
  {
    id: "traitement", kind: "choice", prompt: "Tu prends un traitement médical régulier ?",
    choices: [
      { value: "non", label: "Non" },
      { value: "oui", label: "Oui" },
    ],
  },
  {
    id: "depuis", kind: "choice", prompt: "Depuis quand tu te sens comme ça ?",
    choices: [
      { value: "semaines", label: "Quelques semaines" },
      { value: "mois", label: "Plusieurs mois" },
      { value: "1-2ans", label: "1 à 2 ans" },
      { value: "toujours", label: "Depuis toujours, ou presque" },
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
    id: "galere", kind: "longtext",
    prompt: "Avant que le Fauve écrive : dis-lui en quelques mots ta vraie galère, ou un détail sur toi.",
    placeholder: "Ex : je dors mal depuis mon déménagement, je grignote le soir devant les écrans… (optionnel, mais ça l'aide à viser juste)",
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

  // --- Creusage adaptatif (v3.1) : questions d'AXE affichées selon objectif/pese/mouvement/stress (showIf OR).
  // Placées APRÈS objectif (elles en dépendent). Worker Oracle mappe ces slugs.
  {
    id: "coucher", kind: "choice", prompt: "À quelle heure tu te couches, en général ?",
    showIf: [{ field: "objectif", value: "dormir" }],
    choices: [
      { value: "avant-22h", label: "Avant 22h" },
      { value: "22h-23h", label: "22h - 23h" },
      { value: "23h-minuit", label: "23h - minuit" },
      { value: "apres-minuit", label: "Après minuit" },
    ],
  },
  {
    id: "duree", kind: "choice", prompt: "Tu dors combien d'heures par nuit ?",
    showIf: [{ field: "objectif", value: "dormir" }],
    choices: [
      { value: "moins-5h", label: "Moins de 5h" },
      { value: "5-6h", label: "5 à 6h" },
      { value: "6-7h", label: "6 à 7h" },
      { value: "7h-plus", label: "7h et plus" },
    ],
  },
  {
    id: "rituel", kind: "choice", prompt: "Juste avant de dormir, c'est plutôt…",
    showIf: [{ field: "objectif", value: "dormir" }],
    choices: [
      { value: "ecran", label: "Les écrans" },
      { value: "alcool", label: "Un verre d'alcool" },
      { value: "lecture", label: "Lecture, calme" },
      { value: "rien", label: "Rien de particulier" },
    ],
  },
  {
    id: "portions", kind: "choice", prompt: "Tes portions à table, en général ?",
    showIf: [{ field: "objectif", value: "manger" }, { field: "pese", value: "poids" }],
    choices: [
      { value: "petites", label: "Petites" },
      { value: "normales", label: "Normales" },
      { value: "copieuses", label: "Copieuses" },
      { value: "je-me-ressers", label: "Je me ressers souvent" },
    ],
  },
  {
    id: "grignote-quand", kind: "choice", prompt: "Tu grignotes plutôt quand ?",
    showIf: [{ field: "objectif", value: "manger" }, { field: "pese", value: "poids" }],
    choices: [
      { value: "jamais", label: "Jamais" },
      { value: "aprem", label: "L'après-midi" },
      { value: "soir-tele", label: "Le soir devant la télé" },
      { value: "nuit", label: "La nuit" },
    ],
  },
  {
    id: "sodas", kind: "choice", prompt: "Sodas, jus sucrés ?",
    showIf: [{ field: "objectif", value: "manger" }, { field: "pese", value: "poids" }],
    choices: [
      { value: "jamais", label: "Jamais" },
      { value: "parfois", label: "Parfois" },
      { value: "tous-les-jours", label: "Tous les jours" },
    ],
  },
  {
    id: "barre-quand", kind: "choice", prompt: "Le coup de barre, c'est plutôt quand ?",
    showIf: [{ field: "objectif", value: "energie" }, { field: "pese", value: "fatigue" }],
    choices: [
      { value: "matin", label: "Le matin" },
      { value: "apres-dej", label: "Après le déjeuner" },
      { value: "fin-aprem", label: "En fin d'après-midi" },
      { value: "toute-journee", label: "Toute la journée" },
    ],
  },
  {
    id: "recup-weekend", kind: "choice", prompt: "Le week-end, tu récupères ?",
    showIf: [{ field: "objectif", value: "energie" }, { field: "pese", value: "fatigue" }],
    choices: [
      { value: "oui", label: "Oui, ça va mieux" },
      { value: "un-peu", label: "Un peu" },
      { value: "jamais", label: "Jamais vraiment" },
    ],
  },
  {
    id: "douleur-ou", kind: "choice", prompt: "Tes douleurs, c'est où surtout ?",
    showIf: [{ field: "objectif", value: "bouger" }, { field: "mouvement", value: "douleurs" }],
    choices: [
      { value: "dos", label: "Le dos" },
      { value: "articulations", label: "Les articulations" },
      { value: "nuque-epaules", label: "Nuque, épaules" },
      { value: "partout", label: "Un peu partout" },
    ],
  },
  {
    id: "douleur-quand", kind: "choice", prompt: "Elles arrivent quand ?",
    showIf: [{ field: "objectif", value: "bouger" }, { field: "mouvement", value: "douleurs" }],
    choices: [
      { value: "matin", label: "Le matin, au réveil" },
      { value: "apres-effort", label: "Après l'effort" },
      { value: "continu", label: "En continu" },
      { value: "nuit", label: "La nuit" },
    ],
  },
  {
    id: "stress-source", kind: "choice", prompt: "Ton stress, ça vient surtout de…",
    showIf: [{ field: "objectif", value: "corps" }, { field: "objectif", value: "vieillir" }, { field: "stress", value: "pression" }, { field: "stress", value: "a-bout" }],
    choices: [
      { value: "travail", label: "Le travail" },
      { value: "famille", label: "La famille" },
      { value: "argent", label: "L'argent" },
      { value: "sante", label: "La santé" },
      { value: "tout", label: "Un peu tout" },
    ],
  },
  {
    id: "stress-corps", kind: "choice", prompt: "Ton stress, il se loge où dans ton corps ?",
    showIf: [{ field: "objectif", value: "corps" }, { field: "objectif", value: "vieillir" }, { field: "stress", value: "pression" }, { field: "stress", value: "a-bout" }],
    choices: [
      { value: "sommeil", label: "Le sommeil" },
      { value: "digestion", label: "La digestion" },
      { value: "dos-nuque", label: "Le dos, la nuque" },
      { value: "moral", label: "Le moral" },
    ],
  },
]

export type Answers = Record<string, string>
