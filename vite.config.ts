import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** Repère de version, affiché en bas de l'accueil : permet de savoir tout de
 *  suite si un navigateur sert encore une version en cache. */
const BUILD = new Date().toISOString().slice(0, 16).replace('T', ' ')

export default defineConfig({
  define: { __BUILD__: JSON.stringify(BUILD) },
  plugins: [react()],
  // Chemins relatifs : le site fonctionne aussi bien à la racine d'un domaine
  // qu'en sous-dossier (GitHub Pages sert le projet sous /camino/).
  base: './',
  build: {
    rollupOptions: {
      output: {
        // Noms de fichiers stables, sans empreinte : un index.html resté en
        // cache continue de pointer vers des fichiers qui existent, au lieu de
        // réclamer un bundle supprimé par le déploiement suivant — c'est ce qui
        // produit une page blanche.
        entryFileNames: 'assets/camino.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/camino.[ext]',
      },
    },
  },
  server: { port: 5173 },
})
