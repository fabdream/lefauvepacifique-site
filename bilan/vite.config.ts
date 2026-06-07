import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// base '/bilan/' : le funnel est servi sous lefauvepacifique.xx/bilan (1 repo, à côté du site statique).
export default defineConfig({
  base: "/bilan/",
  plugins: [react()],
  server: { port: 5181, host: true },
})
