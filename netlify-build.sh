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
# site statique racine (tel quel, intact)
cp index.html _site/
cp -r assets _site/assets
# funnel buildé sous /bilan/
cp -r bilan/dist _site/bilan

echo "→ _site prêt :"
ls -la _site
echo "✓ build monorepo terminé"
