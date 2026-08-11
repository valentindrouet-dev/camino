import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** Repère de version, affiché en bas de l'accueil : permet de savoir tout de
 *  suite si un navigateur sert encore une version en cache. */
const BUILD = new Date().toISOString().slice(0, 16).replace('T', ' ')
/** Le même repère, utilisable dans une URL. */
const BUILD_TAG = BUILD.replace(/[^0-9]/g, '')

export default defineConfig({
  define: { __BUILD__: JSON.stringify(BUILD) },
  plugins: [react()],
  // Chemins relatifs : le site fonctionne aussi bien à la racine d'un domaine
  // qu'en sous-dossier (GitHub Pages sert le projet sous /camino/).
  base: './',
  experimental: {
    // Chaque build référence ses fichiers avec « ?b=<version> » : un
    // navigateur qui aurait mémorisé un échec de chargement sur l'URL nue
    // repart sur une URL jamais vue, donc toujours fraîche.
    renderBuiltUrl(filename) {
      return `./${filename}?b=${BUILD_TAG}`
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Noms de fichiers stables, sans empreinte : un index.html resté en
        // cache continue de pointer vers des fichiers qui existent, au lieu de
        // réclamer un bundle supprimé par le déploiement suivant — c'est ce qui
        // produit une page blanche.
        entryFileNames: 'assets/camino.js',
        chunkFileNames: 'assets/camino-[name].js',
        assetFileNames: 'assets/camino.[ext]',
        // Le client temps réel n'est téléchargé que par ceux qui jouent en
        // ligne : il vit dans son propre morceau, à un nom stable.
        manualChunks(id) {
          if (id.includes('@supabase') || id.includes('phoenix')) return 'reseau'
          return undefined
        },
      },
    },
  },
  server: { port: 5173 },
})
