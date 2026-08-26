# Des salons multijoueurs en temps réel avec Supabase

**Comment c'est fait dans CAMINO, et comment le refaire ailleurs.**

Ce document est écrit pour être donné tel quel à un agent de code. Il décrit une
architecture éprouvée en production sur un site statique hébergé par GitHub
Pages : des joueurs sur des appareils différents ouvrent un salon, s'y
retrouvent, et jouent une partie synchronisée — **sans serveur, sans base de
données, sans authentification, sans une seule ligne de SQL**.

---

## 1. Ce que ça fait, et ce que ça ne fait pas

**Ça fait :**

- une liste de salons ouverts, visible par tout le monde, qui se met à jour
  toute seule ;
- l'ouverture d'un salon, l'arrivée et le départ de participants ;
- la négociation d'un état partagé avant le départ (ici : qui prend quelle
  couleur, quels réglages) ;
- une session synchronisée entre N appareils, avec reprise après une coupure
  réseau ou un rafraîchissement de page ;
- un repli automatique sur un mode « plusieurs onglets du même navigateur »
  quand le service n'est pas configuré.

**Ça ne fait pas :**

- de persistance. Rien n'est stocké nulle part. Fermez tous les onglets, le
  salon n'existe plus ;
- d'autorité serveur. Un participant malveillant peut envoyer n'importe quel
  message. C'est acceptable pour un jeu entre amis, **inacceptable** pour un
  classement, de l'argent, ou des données privées (voir §11) ;
- de reprise après que tout le monde a quitté.

---

## 2. L'idée centrale : ne jamais synchroniser un état

C'est le choix qui rend tout le reste simple, et il tient en une phrase :

> Le moteur étant déterministe, une partie n'est rien d'autre qu'une graine et
> une liste d'actions.

On ne diffuse donc **jamais** l'état du jeu. On diffuse des **actions
numérotées**, que chaque appareil rejoue de son côté depuis la même graine. Une
partie complète à six joueurs pèse 4 Ko.

```ts
/** Rejoue le journal depuis le début : c'est ce qui rend la reconnexion gratuite. */
export function rejouer(config: Config, actions: Action[]): Etat {
  let etat = creerPartie(config)          // la graine est dans `config`
  for (const a of actions) etat = appliquer(etat, a)
  return etat
}
```

Conséquences, toutes bonnes :

| Problème classique | Ce qu'il devient ici |
|---|---|
| Reconnexion | On redemande le journal et on rejoue. Gratuit. |
| Messages perdus | Un trou dans la numérotation le révèle ; on redemande. |
| Divergence entre clients | Impossible tant que le moteur est déterministe. |
| Volume réseau | Quelques dizaines d'octets par action. |
| Conflits d'écriture | Il n'y en a pas : personne n'écrit d'état. |

### ⚠️ La condition à vérifier AVANT tout

**Votre moteur doit être déterministe.** Concrètement, dans tout le code de
logique :

- aucun `Math.random()` — utilisez un générateur pseudo-aléatoire à graine
  (PRNG) semé par la graine de la partie ;
- aucun `Date.now()` ni `new Date()` ;
- aucune itération sur un `Set`/`Map` dont l'ordre d'insertion dépendrait de
  l'ordre d'arrivée réseau ;
- aucun accès au DOM, au `localStorage`, au fuseau horaire, à la locale.

Si votre logique ne peut pas être rendue déterministe, **cette architecture ne
s'applique pas** : il vous faudra diffuser l'état, avec tout ce que cela
implique (taille, conflits, autorité). Dites-le tout de suite plutôt que de le
découvrir au milieu.

Test de non-régression utile : rejouer le même journal deux fois et comparer les
états sérialisés.

```ts
assert.deepEqual(rejouer(config, actions), rejouer(config, actions))
```

---

## 3. Pourquoi Supabase Realtime, et seulement la diffusion

Supabase offre trois mécanismes temps réel. **On n'utilise que le premier.**

| Mécanisme | Ce que c'est | Ici |
|---|---|---|
| **Broadcast** | Un canal nommé, des messages à qui écoute. Rien n'est stocké. | ✅ tout passe par là |
| Presence | Qui est connecté à un canal | ❌ on gère la présence nous-mêmes (§9) |
| Postgres Changes | Notifications sur les écritures en base | ❌ pas de base du tout |

Le Broadcast est le seul qui ne demande **aucune table, aucune politique RLS,
aucune migration**. Un projet Supabase tout neuf le fournit immédiatement. C'est
ce qui permet de passer d'un site statique sans backend à un jeu en ligne en
une après-midi.

C'est aussi ce qui explique l'absence de persistance : le broadcast est un
tuyau, pas un stockage.

---

## 4. Mise en place côté Supabase (5 minutes, une seule fois)

1. Créer un compte sur [supabase.com](https://supabase.com), puis un projet
   (l'offre gratuite suffit très largement).
2. **Ne créer aucune table.** Ne pas toucher à l'authentification. Ne rien
   configurer.
3. Aller dans **Project Settings → API** et relever deux valeurs :
   - **Project URL** — `https://xxxxxxxxxxxx.supabase.co`
   - **anon public** — un long jeton JWT.
4. Vérifier que Realtime est actif : **Project Settings → Realtime**. Il l'est
   par défaut.

C'est tout. Aucune autre étape.

> **Note sur les nouveaux projets.** Supabase renomme progressivement la clé
> `anon` en « publishable key » (`sb_publishable_...`). Les deux jouent le même
> rôle ici : c'est la clé destinée au navigateur. Prenez celle que la console
> vous propose.

### Ce qui est public, et ce qui ne l'est jamais

| Valeur | Va dans le dépôt ? |
|---|---|
| Project URL | ✅ oui — elle est publique par conception |
| Clé `anon` / publishable | ✅ oui — elle est faite pour partir dans le navigateur |
| Clé `service_role` | ❌ **JAMAIS** — elle contourne toutes les protections |
| Mot de passe de la base | ❌ **JAMAIS** |

La clé `anon` part dans le bundle JavaScript téléchargé par chaque visiteur.
N'importe qui peut la lire en trente secondes. **C'est prévu ainsi** : elle
n'ouvre que ce que le projet autorise publiquement — ici, des canaux de
diffusion. Ce n'est pas un secret et il est inutile de la cacher dans une
variable d'environnement : elle finira dans le bundle de toute façon.

En revanche, si vous ajoutez un jour des tables, la clé `anon` devient la porte
d'entrée de vos données : il faudra activer **RLS** sur chaque table. Sans RLS,
la clé `anon` lit et écrit tout.

---

## 5. L'architecture : trois fichiers, trois responsabilités

```
src/net/
  config.ts     ← les deux constantes publiques
  protocole.ts  ← les types et les messages. Ne connaît AUCUN réseau.
  local.ts      ← transport « plusieurs onglets » (BroadcastChannel)
  supabase.ts   ← transport hébergé (Supabase Realtime)
  useSalon.ts   ← la logique de salon, côté application. Ne connaît qu'une interface.
```

La clé de voûte est l'interface `Transport`. **Toute la logique applicative est
écrite contre elle, jamais contre Supabase.**

```ts
export interface Transport {
  readonly nom: string
  /** Liste des salons ouverts, rafraîchie tant qu'on écoute. */
  salons(onChange: (liste: SalonResume[]) => void): () => void
  /** Ouvre un salon et s'y place comme hôte. */
  ouvrir(salon: Salon): Promise<void>
  /** Rejoint un salon existant. */
  rejoindre(salonId: string, joueur: Membre): Promise<void>
  /** Publie un message à tous les autres membres du salon. */
  envoyer(msg: Message): void
  /** S'abonne aux messages du salon courant. Retourne la fonction d'arrêt. */
  ecouter(onMessage: (msg: Message) => void): () => void
  /** Met à jour le résumé publié dans la liste (hôte uniquement). */
  publier(salon: Salon): void
  /** Quitte le salon courant. */
  quitter(): void
  /** Optionnel : état de la liaison, pour l'affichage. */
  surEtat?(cb: (etat: 'connexion' | 'ok' | 'erreur') => void): () => void
}
```

**Faites le transport local EN PREMIER.** C'est le conseil le plus rentable de
ce document. Il tient en 110 lignes, il utilise `BroadcastChannel` et
`localStorage`, il est instantané, il fonctionne hors ligne, et il permet de
valider toute la mécanique — ouverture, arrivée d'un membre, négociation,
ordre des actions, reconnexion — **sans jamais dépendre du réseau**. Quand le
transport Supabase arrive, il n'y a plus aucun bug de logique à chercher : s'il
y en a un, il est réseau.

Le choix du transport se fait en une ligne :

```tsx
const [transport] = useState<Transport>(() =>
  enLigneDisponible() ? new TransportSupabase() : new TransportLocal(),
)
```

```ts
/** Le jeu en ligne entre appareils est-il configuré ? */
export function enLigneDisponible(): boolean {
  return SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0
}
```

Tant que les constantes sont vides, l'application fonctionne en mode « plusieurs
onglets » sans afficher la moindre erreur.

---

## 6. Le protocole : ce qui circule

Deux structures et une dizaine de messages. Tout est là.

```ts
/** Un membre du salon, avant que la session ne commence. */
export interface Membre {
  /** Identifiant de l'appareil, tiré une fois (voir §9, piège n° 3). */
  id: string
  nom: string
  /** Ce qu'il a choisi ; deux membres ne peuvent pas prendre la même. */
  couleur: string | null
  /** Place attribuée au lancement — l'ordre du tour. */
  siege?: number
  /** Faux quand l'appareil a cessé de donner signe de vie. */
  present: boolean
}

export interface Salon {
  id: string
  nom: string          // « Salon 01 », « Salon 02 »…
  numero: number
  hote: string         // l'id du membre qui l'a ouvert : lui seul lance
  membres: Membre[]
  phase: 'attente' | 'en-cours' | 'terminee'
  options: Options     // réglages choisis par l'hôte
  vuA: number          // horodatage de dernière activité, pour le ménage
}

/** Une action, numérotée : c'est l'unité de synchronisation. */
export type Action =
  | { k: 'coup'; move: Move }
  | { k: 'autre-chose'; /* … */ }

export type Message =
  | { t: 'bonjour'; membre: Membre }              // j'arrive (ou je reviens)
  | { t: 'salon'; salon: Salon }                  // l'hôte publie l'état — il fait foi
  | { t: 'choix'; membreId: string; couleur: string | null }
  | { t: 'options'; options: Options }            // l'hôte change les réglages
  | { t: 'debut'; salon: Salon }                  // l'hôte lance
  | { t: 'action'; n: number; action: Action }    // une action, à sa place
  | { t: 'rejoue'; depuis: number }               // j'ai raté quelque chose
  | { t: 'journal'; actions: Action[] }           // voici tout
  | { t: 'fin' }
  | { t: 'aurevoir'; membreId: string }
```

### Les deux règles d'autorité

Elles suffisent, et il ne faut pas en ajouter.

1. **Avant le lancement, l'hôte fait foi.** Lui seul modifie la composition du
   salon. Les autres *demandent* (`{t:'choix'}`) ; l'hôte arbitre et rediffuse
   l'état complet (`{t:'salon'}`). Les autres écrasent leur copie locale sans
   discuter. C'est ce qui évite tout conflit sur « qui a pris le bleu ».

2. **Après le lancement, plus personne ne fait foi.** Chacun ajoute les actions
   à son journal et rejoue. Le déterminisme garantit l'accord.

```ts
case 'salon':
  // Seul l'hôte diffuse ; on lui fait confiance.
  if (!suisHote) setSalon(msg.salon)
  break
```

### La numérotation et la reprise

C'est le mécanisme entier de la tolérance aux pertes, en huit lignes :

```ts
case 'action': {
  // Le numéro dit où l'action se range : un trou signale qu'on a raté
  // quelque chose, on redemande le journal plutôt que de deviner.
  const attendu = actionsRef.current.length
  if (msg.n === attendu) setActions((prev) => [...prev, msg.action])
  else if (msg.n > attendu) transport.envoyer({ t: 'rejoue', depuis: attendu })
  break
}
case 'rejoue':
  transport.envoyer({ t: 'journal', actions: actionsRef.current })
  break
case 'journal':
  // On n'accepte que ce qui nous fait avancer : deux réponses simultanées
  // à un même « rejoue » ne doivent pas nous faire reculer.
  if (msg.actions.length > actionsRef.current.length) setActions(msg.actions)
  break
```

Notez que `{t:'rejoue'}` est traité par **tout le monde**, pas seulement l'hôte :
n'importe qui possédant le journal peut dépanner un retardataire. C'est gratuit
et ça supprime un point de défaillance unique.

---

## 7. Le hall : une liste de salons sans base de données

Il faut bien que les nouveaux venus voient les salons ouverts. Sans table, la
solution tient en trois messages sur **un canal global** :

```ts
const HALL = 'monappli-salons'
/** Les hôtes réannoncent leur salon à ce rythme : un salon muet disparaît. */
const ANNONCE_MS = 4000

type MessageHall =
  | { t: 'annonce'; salon: SalonResume; vuA: number }
  | { t: 'qui' }
  | { t: 'ferme'; id: string }
```

Le protocole :

- chaque hôte **réannonce** son salon toutes les 4 secondes (un `setInterval`) ;
- celui qui arrive envoie `{t:'qui'}` **dès qu'il est abonné** ; les hôtes
  répondent immédiatement par une annonce, sans attendre leur prochain
  battement — sinon la liste mettrait 4 secondes à se peupler ;
- un salon dont on n'a pas reçu d'annonce depuis **3 battements** est effacé de
  la liste locale. C'est la détection de déconnexion : pas d'événement
  « départ » à guetter, une absence suffit ;
- `{t:'ferme'}` accélère la disparition quand l'hôte part proprement ou lance
  la partie.

```ts
const pousser = () => {
  const maintenant = Date.now()
  for (const [id, s] of this.connus) {
    // deux annonces manquées : l'hôte a fermé son onglet
    if (maintenant - s.vuA > ANNONCE_MS * 3 || estPerime(s, maintenant)) {
      this.connus.delete(id)
    }
  }
  onChange([...this.connus.values()].sort((a, b) => a.numero - b.numero))
}
```

Chaque client tient sa propre liste en mémoire (`this.connus`), reconstruite
par les annonces. Deux clients peuvent brièvement voir des listes différentes.
Ce n'est pas grave : rejoindre un salon disparu échoue proprement.

**Nommage des salons** — le plus petit numéro libre, pour que le premier salon
ouvert s'appelle toujours « Salon 01 » :

```ts
export function prochainNumero(ouverts: { numero: number }[]): number {
  const pris = new Set(ouverts.map((s) => s.numero))
  let n = 1
  while (pris.has(n)) n++
  return n
}
```

---

## 8. Le transport Supabase, en entier

Deux canaux : le hall, et un canal par salon (`monappli-salon-<id>`).

```ts
import type { EtatLiaison, Message, Salon, SalonResume, Transport } from './protocole.ts'
import { estPerime, resume } from './protocole.ts'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config.ts'

type Client = import('@supabase/supabase-js').SupabaseClient
type Canal = import('@supabase/supabase-js').RealtimeChannel

const HALL = 'monappli-salons'
const ANNONCE_MS = 4000

let client: Client | null = null

/** Charge le client une seule fois, et seulement si on en a besoin. */
async function getClient(): Promise<Client> {
  if (client) return client
  const { createClient } = await import('@supabase/supabase-js')
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },        // aucune session : on n'authentifie personne
    realtime: { params: { eventsPerSecond: 20 } },
  })
  return client
}

export class TransportSupabase implements Transport {
  readonly nom = 'supabase'
  private hall: Canal | null = null
  private canal: Canal | null = null
  private connus = new Map<string, SalonResume & { vuA: number }>()
  private monSalon: Salon | null = null
  private annonceur: number | null = null
  private onMessage: ((msg: Message) => void) | null = null

  // ---------------------------------------------------------------- le hall
  salons(onChange: (liste: SalonResume[]) => void): () => void {
    let vivant = true
    const pousser = () => { /* voir §7 */ }

    void (async () => {
      const c = await getClient()
      if (!vivant) return                    // démonté pendant le chargement
      this.hall = c.channel(HALL, { config: { broadcast: { self: false } } })
      this.hall.on('broadcast', { event: 'hall' }, ({ payload }) => {
        const m = payload as MessageHall
        if (m.t === 'annonce') {
          this.connus.set(m.salon.id, { ...m.salon, vuA: Date.now() })
          pousser()
        } else if (m.t === 'ferme') {
          this.connus.delete(m.id)
          pousser()
        } else if (m.t === 'qui' && this.monSalon) {
          // quelqu'un vient d'arriver : on lui montre notre salon sans attendre
          this.annoncer()
        }
      })
      this.hall.subscribe((statut) => {
        if (statut === 'SUBSCRIBED') {
          this.majEtat('ok')
          this.envoyerHall({ t: 'qui' })     // ← APRÈS l'abonnement, jamais avant
        } else if (statut === 'CHANNEL_ERROR' || statut === 'TIMED_OUT') {
          this.majEtat('erreur')
        }
      })
    })()

    const menage = window.setInterval(pousser, 2000)
    return () => {
      vivant = false
      window.clearInterval(menage)
      void this.hall?.unsubscribe()
      this.hall = null
    }
  }

  private envoyerHall(m: MessageHall) {
    void this.hall?.send({ type: 'broadcast', event: 'hall', payload: m })
  }

  private annoncer() {
    if (!this.monSalon) return
    this.envoyerHall({ t: 'annonce', salon: resume(this.monSalon), vuA: Date.now() })
  }

  // ------------------------------------------------------------- les salons
  private async brancher(salonId: string) {
    this.quitterCanal()
    const c = await getClient()
    const canal = c.channel(`monappli-salon-${salonId}`, {
      config: { broadcast: { self: false } },
    })
    canal.on('broadcast', { event: 'msg' }, ({ payload }) => {
      this.onMessage?.(payload as Message)
    })
    await new Promise<void>((resolve) => {
      canal.subscribe((statut) => {
        if (statut === 'SUBSCRIBED') resolve()
      })
      // On n'attend pas indéfiniment : mieux vaut une interface qui répond
      // qu'un écran figé si le réseau boude.
      window.setTimeout(resolve, 4000)
    })
    this.canal = canal
  }

  async ouvrir(salon: Salon): Promise<void> {
    await this.brancher(salon.id)
    this.monSalon = salon
    this.annoncer()
    if (this.annonceur) window.clearInterval(this.annonceur)
    this.annonceur = window.setInterval(() => this.annoncer(), ANNONCE_MS)
  }

  async rejoindre(salonId: string): Promise<void> {
    // On se branche SEULEMENT : c'est l'appelant qui se signale, une fois
    // qu'il écoute — sinon il manquerait la réponse de l'hôte.
    await this.brancher(salonId)
  }

  envoyer(msg: Message): void {
    void this.canal?.send({ type: 'broadcast', event: 'msg', payload: msg })
  }

  ecouter(onMessage: (msg: Message) => void): () => void {
    this.onMessage = onMessage
    return () => { if (this.onMessage === onMessage) this.onMessage = null }
  }

  publier(salon: Salon): void {
    this.monSalon = salon
    this.annoncer()
    // Une session lancée ou finie sort de la liste des salons à rejoindre.
    if (salon.phase !== 'attente') this.envoyerHall({ t: 'ferme', id: salon.id })
  }

  private quitterCanal() {
    if (this.canal) void this.canal.unsubscribe()
    this.canal = null
  }

  quitter(): void {
    if (this.monSalon) this.envoyerHall({ t: 'ferme', id: this.monSalon.id })
    if (this.annonceur) window.clearInterval(this.annonceur)
    this.annonceur = null
    this.monSalon = null
    this.quitterCanal()
  }
}
```

### Trois détails qui comptent

**`broadcast: { self: false }`** — on ne reçoit pas ses propres messages. Sans
ça, chaque action serait appliquée deux fois par son auteur. On applique
localement puis on émet ; c'est aussi ce qui rend l'interface instantanée pour
celui qui joue.

**`auth: { persistSession: false }`** — on n'authentifie personne, inutile de
laisser traîner une session dans le `localStorage`.

**L'import dynamique** — `await import('@supabase/supabase-js')`. Le client
temps réel pèse ~220 Ko. Chargé à la demande, il n'est **jamais téléchargé** par
les visiteurs qui ne jouent pas en ligne. Avec Vite, on lui donne son propre
morceau :

```ts
// vite.config.ts
build: {
  rollupOptions: {
    output: {
      manualChunks(id) {
        if (id.includes('@supabase') || id.includes('phoenix')) return 'reseau'
        return undefined
      },
    },
  },
}
```

---

## 9. Les sept pièges — lisez cette section deux fois

Ce sont les bugs qui ont réellement coûté du temps. Ils sont tous subtils et
tous reproductibles.

### 1. S'abonner AVANT de dire bonjour

Le bug : celui qui rejoint envoie `{t:'bonjour'}` puis s'abonne. L'hôte répond
dans l'intervalle. La réponse est perdue. Le nouveau reste seul dans un salon
qui, lui, l'a bien vu — et rien n'indique l'erreur.

La règle : `rejoindre()` **se branche seulement**. C'est le code applicatif qui
envoie `bonjour`, dans l'effet qui vient d'installer l'écouteur.

```ts
useEffect(() => {
  if (!salon) return
  const arret = transport.ecouter(traiter)     // 1. on écoute
  const courant = salonRef.current
  if (courant && courant.hote !== moi.id) {
    transport.envoyer({ t: 'bonjour', membre: ... })   // 2. ALORS on se signale
  }
  return arret
}, [transport, salon?.id, moi.id])
```

### 2. Caler l'abonnement sur l'IDENTITÉ du salon, pas sur son contenu

Le bug : mettre `[salon]` dans les dépendances de l'effet. Chaque message reçu
modifie `salon`, l'effet se rejoue, l'abonnement est refait — et un message
tombant dans l'intervalle est perdu. Symptôme : des pertes aléatoires qui
augmentent avec l'activité.

La règle : `[salon?.id]`, et lire l'état courant via des `ref` miroirs.

```ts
const salonRef = useRef<Salon | null>(null)
salonRef.current = salon           // miroir tenu à jour à chaque rendu
const actionsRef = useRef<Action[]>(actions)
actionsRef.current = actions
```

Le gestionnaire lit `salonRef.current`, jamais la variable capturée à
l'abonnement.

### 3. L'identité par ONGLET, pas par navigateur

`sessionStorage`, pas `localStorage`. Deux onglets du même navigateur sont deux
participants distincts — c'est ce qui permet de tester à plusieurs sur un seul
poste, et c'est indispensable pour développer. Un rafraîchissement conserve
l'identité, donc la place.

Le **nom d'affichage**, lui, est une préférence : `localStorage`, pour le
retrouver d'une session à l'autre.

```ts
const CLE_ID = 'monappli.membre.v1'    // sessionStorage — par onglet
const CLE_NOM = 'monappli.nom.v1'      // localStorage — par navigateur

export function monIdentite(): { id: string; nom: string } {
  let id = ''
  try {
    id = sessionStorage.getItem(CLE_ID) ?? ''
    if (!id) { id = randomSeed(); sessionStorage.setItem(CLE_ID, id) }
  } catch {
    // navigation privée : une identité le temps du chargement, sans plus
    id = id || randomSeed()
  }
  let nom = ''
  try { nom = localStorage.getItem(CLE_NOM) ?? '' } catch { /* sans importance */ }
  return { id, nom }
}
```

Enveloppez **chaque** accès au stockage dans un `try/catch` : en navigation
privée, certains navigateurs lèvent une exception à la simple lecture.

### 4. Ne jamais attendre `SUBSCRIBED` indéfiniment

Si le réseau boude, `subscribe()` ne rappelle jamais et l'interface reste figée
sur un écran de chargement, sans message. Toujours doubler d'un délai :

```ts
await new Promise<void>((resolve) => {
  canal.subscribe((statut) => { if (statut === 'SUBSCRIBED') resolve() })
  window.setTimeout(resolve, 4000)
})
```

On continue sans être sûr d'être abonné. C'est volontaire : une interface qui
répond et une liste vide valent mieux qu'un écran mort.

### 5. Exposer l'état de la liaison

Une application temps réel muette *semble* en panne. Trois états suffisent, et
ils changent tout pour l'utilisateur :

```ts
export type EtatLiaison = 'connexion' | 'ok' | 'erreur'
```

Affichez-les. `CHANNEL_ERROR` et `TIMED_OUT` dans le rappel de `subscribe()`
donnent `'erreur'` ; `SUBSCRIBED` donne `'ok'`.

Rendez la méthode **optionnelle** dans l'interface `Transport` : le transport
local n'a rien à établir, sa liaison est acquise d'office.

```ts
const [liaison, setLiaison] = useState<EtatLiaison>(transport.surEtat ? 'connexion' : 'ok')
```

### 6. La course au démontage

`getClient()` est asynchrone. Le composant peut disparaître pendant le
chargement du client. Sans garde, on s'abonne à un canal que personne
n'écoutera jamais et qu'on ne fermera jamais.

```ts
let vivant = true
void (async () => {
  const c = await getClient()
  if (!vivant) return          // ← indispensable
  /* … */
})()
return () => { vivant = false; /* … */ }
```

### 7. Figer les places au lancement, pas avant

Tant qu'on est en attente, la composition bouge. Au moment du départ, l'hôte
attribue les places dans l'ordre courant et les **fige** : c'est cet ordre que
tous les clients utiliseront pour reconstruire la même partie.

```ts
const assis = courant.membres.filter((j) => j.present && j.couleur)
const maj = {
  ...courant,
  phase: 'en-cours',
  membres: assis.map((j, i) => ({ ...j, siege: i })),   // ← figé ici
}
transport.envoyer({ t: 'debut', salon: maj })
```

Et la configuration se déduit **uniquement** du salon, en triant par siège —
jamais par ordre d'arrivée des messages :

```ts
export function configDuSalon(salon: Salon): Config {
  const assis = salon.membres
    .filter((j) => j.present && j.couleur)
    .sort((a, b) => (a.siege ?? 0) - (b.siege ?? 0))    // ← l'ordre fait foi
  return { players: assis.map(/* … */), options: salon.options }
}
```

---

## 10. Le hook applicatif

`useSalon(transport, actif)` expose l'état et les actions. Trois points de
conception valent d'être repris :

**Le paramètre `actif`.** Tant qu'il est faux, on ne se connecte à rien.
Inutile de faire télécharger le client temps réel à qui ne joue pas en ligne.

**La partie est une valeur dérivée**, jamais un état stocké :

```ts
const partie = useMemo(() => {
  if (!salon || salon.phase === 'attente') return null
  const config = configDuSalon(salon)
  if (!config.players.length) return null
  return rejouer(config, actions)
}, [salon, actions])
```

C'est la traduction directe du §2. Il n'y a **aucun** `setState` d'état de jeu
dans tout le fichier : la partie est toujours recalculée depuis le journal. Un
`useMemo` suffit tant que rejouer coûte moins qu'un rendu — pour une partie de
plateau, c'est le cas de très loin. Si votre logique est lourde, mémoïsez par
préfixe de journal plutôt que de rejouer depuis zéro.

**Jouer, c'est appliquer localement puis émettre :**

```ts
const jouer = useCallback((action: Action) => {
  const n = actionsRef.current.length
  setActions((prev) => [...prev, action])            // instantané chez soi
  transport.envoyer({ t: 'action', n, action })      // et chez les autres
}, [transport])
```

Aucune attente d'accusé de réception. L'interface répond au doigt ; la
numérotation rattrape les pertes.

---

## 11. Sécurité — ce que ce modèle vaut, et ne vaut pas

**Soyez franc avec votre utilisateur sur ce point.** Cette architecture repose
sur la confiance entre participants.

Ce qui est vrai :

- les noms de canaux sont **devinables** ; la clé `anon` est **publique**.
  N'importe qui peut donc écouter n'importe quel salon et y écrire ;
- un client modifié peut envoyer une action illégale. Rien ne la rejette. La
  seule protection est que les autres clients rejouent la même action et
  divergeraient de façon visible ;
- un client peut se déclarer hôte et diffuser un état arbitraire ;
- **rien ne doit transiter par ces canaux qui ne puisse être public.**

C'est parfaitement acceptable pour un jeu de plateau entre gens qui se
connaissent. Ce ne l'est pas si vous avez un classement, de l'argent, des
données personnelles, ou des adversaires anonymes motivés.

**Si vous avez besoin de plus**, dans l'ordre de coût croissant :

1. **Un identifiant de salon imprévisible** (UUID v4). Ne protège de rien
   contre quelqu'un qui écoute le hall, mais évite l'intrusion par balayage.
2. **Realtime Authorization** : Supabase sait restreindre l'accès à un canal
   par politique RLS sur `realtime.messages`. Il faut alors authentifier les
   participants (`supabase.auth`) et appeler `realtime.setAuth()`.
3. **Une Edge Function qui valide chaque action** avant de la rediffuser. C'est
   l'autorité serveur classique — vous quittez le modèle « pas de backend ».
4. **Une table de parties avec RLS**, si vous voulez aussi la persistance.

Ne franchissez ces étapes que si le besoin est réel : chacune ajoute de
l'authentification, des migrations et de l'exploitation.

---

## 12. Les limites à connaître

| Limite | Valeur | Ce que ça implique |
|---|---|---|
| Taille d'un message | 1 Mo | Largement suffisant pour un journal d'actions (4 Ko pour une partie entière). Pas pour un état complet et volumineux — argument de plus pour le §2. |
| Connexions simultanées | 200 sur l'offre gratuite | Chaque onglet ouvert en compte une. |
| Messages par seconde | plafonné par projet, réglable | Un projet qui en produit trop voit ses connexions coupées. D'où `eventsPerSecond: 20` à la création du client. |
| Persistance | **aucune** | Tout le monde part → le salon disparaît. |
| Ordre des messages | garanti par canal | C'est pourquoi la numérotation suffit. |

Les valeurs exactes (clients simultanés, événements par seconde, taille de
charge utile) se règlent projet par projet dans **Project Settings → Realtime**
et évoluent avec les offres. Vérifiez-les avant de dimensionner :
[Realtime Limits](https://supabase.com/docs/guides/realtime/limits) ·
[Realtime Settings](https://supabase.com/docs/guides/realtime/settings) ·
[Tarifs](https://supabase.com/pricing).

Deux garde-fous à prévoir dès le départ :

```ts
/** Un salon sans activité depuis dix minutes n'intéresse plus personne. */
export const PEREMPTION_MS = 10 * 60 * 1000

export function estPerime(salon: { vuA: number; phase: PhaseSalon }, maintenant: number) {
  return salon.phase === 'terminee' || maintenant - salon.vuA > PEREMPTION_MS
}
```

---

## 13. Marche à suivre

Dans cet ordre. Ne sautez pas la deuxième étape.

1. **Rendre le moteur déterministe** (§2). PRNG à graine, aucun `Date.now()`.
   Écrire le test « rejouer deux fois donne le même état ».
2. **Écrire `protocole.ts` et `local.ts`**, puis toute l'interface de salon.
   Valider à deux onglets : ouvrir, rejoindre, choisir, lancer, jouer une
   session complète, rafraîchir un onglet en plein milieu et vérifier qu'il
   reprend.
3. **Créer le projet Supabase** (§4), remplir `config.ts`.
4. **Écrire `supabase.ts`** (§8). Aucune logique nouvelle : uniquement la
   traduction de l'interface `Transport`.
5. **Tester sur deux appareils réels**, pas deux onglets. Puis couper le wifi
   d'un appareil dix secondes et vérifier qu'il rattrape son retard.
6. **Afficher l'état de la liaison** (piège n° 5).
7. **Isoler le client temps réel dans son propre morceau** (§8).

### Ce qu'il faut vérifier avant de dire que c'est fini

- [ ] Rejouer le même journal deux fois donne le même état, au bit près.
- [ ] Un participant qui rafraîchit sa page reprend sa place et son avancement.
- [ ] Un participant qui coupe le réseau dix secondes rattrape tout son retard.
- [ ] Deux participants ne peuvent pas prendre la même couleur, même en
      cliquant simultanément.
- [ ] Fermer l'onglet de l'hôte fait disparaître le salon de la liste des
      autres en moins de 15 secondes.
- [ ] Sans clés Supabase, l'application fonctionne encore à deux onglets, sans
      erreur en console.
- [ ] Le client Supabase n'est pas téléchargé quand on ne joue pas en ligne
      (vérifier dans l'onglet Réseau).
- [ ] La clé `service_role` et le mot de passe de la base ne sont **nulle part**
      dans le dépôt (`git log -S` pour en être sûr).

---

## Récapitulatif en une page

- **Le déterminisme est la fondation.** Sans lui, rien de ce qui précède ne
  tient. Vérifiez-le en premier.
- **On ne synchronise que des actions numérotées**, jamais un état.
- **Supabase Realtime Broadcast**, et rien d'autre : aucune table, aucun SQL,
  aucune authentification.
- **Une interface `Transport`** rend le réseau interchangeable — et permet
  d'écrire toute la logique sans réseau.
- **Le transport local d'abord.** C'est là que se trouvent les bugs de logique.
- **L'hôte fait foi avant le départ ; personne après.**
- **On s'abonne avant de parler**, et l'abonnement dépend de l'identité du
  salon, pas de son contenu.
- **La clé `anon` est publique** ; `service_role` et le mot de passe de la base
  ne quittent jamais la console Supabase.
- **Ce modèle suppose la confiance entre participants.** Dites-le clairement.

---

*Écrit d'après le code de CAMINO — `src/net/` : `salon.ts` (protocole),
`local.ts` (transport onglets), `supabase.ts` (transport hébergé),
`useSalon.ts` (logique de salon), `config.ts` (clés publiques).
Environ 950 lignes en tout, dont 195 pour Supabase.*
