import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Chemins relatifs : le site fonctionne aussi bien à la racine d'un domaine
  // qu'en sous-dossier (GitHub Pages sert le projet sous /camino/).
  base: './',
  server: { port: 5173 },
})
