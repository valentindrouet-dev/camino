/**
 * Réglages du jeu en ligne.
 *
 * Ces deux valeurs sont PUBLIQUES par conception : elles partent dans le
 * bundle du navigateur, visibles par tous les joueurs. C'est prévu ainsi — la
 * clé « anon » ne donne accès qu'à ce que le projet autorise publiquement.
 *
 * Le mot de passe de la base et la clé « service_role », eux, ne doivent
 * jamais entrer dans ce dépôt : il est public.
 */

export const SUPABASE_URL = 'https://uqvzlpgeinunhlojlbun.supabase.co'

/**
 * Clé « anon public » du projet (Project Settings → API).
 * Tant qu'elle est vide, l'application se rabat sur le salon local : les
 * onglets d'un même navigateur, sans réseau.
 */
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdnpscGdlaW51bmhsb2psYnVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NTY2ODAsImV4cCI6MjEwMjAzMjY4MH0.LgcJgl3q6UkYs3XQ0Bp2pe4dgqU3cAmgg2ro9Dpi_As'

/** Le jeu en ligne entre appareils est-il configuré ? */
export function enLigneDisponible(): boolean {
  return SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0
}
