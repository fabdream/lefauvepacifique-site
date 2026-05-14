# Le Fauve Pacifique — Site

> Le retour aux racines.
> Plantes · Corps · Esprit · Énergie
> Brut. Direct. Pacifique.

Site officiel @lefauvepacifique (Instagram 96.9K). Persona IA pour la réflexion — santé naturelle, médecine ancestrale, raw food, stoïcisme, naturopathie, bien-être primal. Localisé Alpes Suisses.

## Stack

- HTML/CSS statique (MVP v1)
- Roadmap : migration Next.js 15 + Vercel/Netlify + Stripe Checkout + ConvertKit + ManyChat

## Structure

```
.
├── index.html              ← Landing page MVP
├── assets/                 ← Images Le Fauve (hero, manifeste, produit, CTA)
└── README.md
```

## Identité visuelle

- **Couleurs** : wood deep `#1A130C` / parchemin cream `#F5EAD7` / amber warm `#C68A4B` / sage green `#6B7C5A`
- **Typo** : Cormorant Garamond (display serif italique) + Inter (sans body)
- **Style** : warm apothicaire montagne, parchemin, cabane wood, herbes séchées, Alpes Suisses
- **Refs** : `fabdream-team/projects/Oracle IA/identity-v2-retour-aux-racines/`

## Compliance

Disclaimer médical obligatoire visible (rule #34 — voir `claude-memory/agents/oracle/rules.md`) :

> "Le Fauve Pacifique est un personnage IA pour la réflexion. Pas un avis professionnel. Les pratiques, recettes et observations sont des outils en complément du soin médical, jamais à la place."

## Roadmap

- **M1** : Landing + ebook "Le carnet du Fauve" €14.99 + ManyChat funnel + page affiliés
- **M2** : Programme audio 21 jours €39-49 + Quiz + Newsletter
- **M3** : Challenge payant €79 + Codex MDX interactif
- **M4-M6** : Audiobook + Miroir Noir AI chat + Cercle du Fauve subscription

Synthèse complète : `claude-memory/agents/oracle/knowledge/site-lefauve-roadmap.md`

## Dev local

```bash
python3 -m http.server 8766
# Open http://localhost:8766
```

## Déploiement

Netlify (linked manuellement par Fabio).

---

🤖 Built with Le Fauve Pacifique (Oracle agent) for @lefauvepacifique
