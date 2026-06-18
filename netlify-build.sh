#!/usr/bin/env bash
# Build monorepo Netlify : site statique racine INTACT + mini-app Vite /bilan buildée sous /bilan/.
# Publie dans _site/ : la racine statique (index.html + assets) + _site/bilan/ (le funnel Vite, base /bilan/).
set -euo pipefail

echo "→ build du funnel /bilan (Vite)"
cd bilan
npm ci
npm run build            # → bilan/dist (base /bilan/), env VITE_* injectés depuis l'env Netlify
cd ..

echo "→ assemblage du dossier de publication _site"
rm -rf _site
mkdir -p _site
# pages statiques racine (telles quelles, intactes) : home + page /guides
cp index.html _site/
cp guides.html _site/
# Injecte la clé anon PUBLIQUE (env Netlify) dans les pages avec form guide (home + /guides) → appel create-lead.
# Clé anon = publique par design (RLS protège la table), on la garde juste hors du repo via ce placeholder.
if [ -n "${VITE_SUPABASE_ANON_KEY:-}" ]; then
  for f in _site/index.html _site/guides.html; do
    sed -i.bak "s|__SUPABASE_ANON_KEY__|${VITE_SUPABASE_ANON_KEY}|g" "$f" && rm -f "$f.bak"
  done
  echo "→ clé anon injectée dans index.html + guides.html (forms guides gratuits)"
else
  echo "⚠ VITE_SUPABASE_ANON_KEY absent — les forms guides ne captureront pas (placeholder laissé, téléchargement révélé quand même)"
fi
cp -r assets _site/assets
# funnel buildé sous /bilan/
cp -r bilan/dist _site/bilan

echo "→ _site prêt :"
ls -la _site
echo "✓ build monorepo terminé"
