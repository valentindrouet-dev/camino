# La liste de développement partagée — mise en place Supabase

Depuis la version 1.90, la liste de l’onglet **Développement** vit sur le
serveur : la même pour tous les appareils et tous les auteurs, et rien ne s’y
perd jamais. Il faut pour cela une table dans le projet Supabase qui sert déjà
aux salons en ligne. Cinq minutes, une seule fois.

## 1. Créer la table

1. Ouvrir le projet sur <https://supabase.com/dashboard> (projet
   `uqvzlpgeinunhlojlbun`, celui des salons).
2. Menu de gauche → **SQL Editor** → **New query**.
3. Coller le contenu du fichier [`supabase/developpement.sql`](../supabase/developpement.sql)
   du dépôt, puis **Run**.
4. Le message « Success. No rows returned » confirme. Le fichier peut être
   rejoué sans dommage : il ne crée que ce qui manque.

C’est tout : aucune clé à copier, rien à changer dans l’application. La
diffusion en direct passe par les canaux « broadcast » déjà actifs pour les
salons.

## 2. Vérifier dans l’application

Ouvrir l’onglet **Développement** sur un appareil qui a la liste (ou
recharger la page si elle était déjà ouverte). En tête de liste, le point de
couleur passe à **« Liste partagée · à jour »**. La liste de cet appareil est
devenue celle de tous : les autres appareils la verront en ouvrant l’onglet.

Si un autre appareil gardait lui aussi une liste différente, il la verra
proposée en ouvrant l’onglet (« Cet appareil gardait une liste à lui »), avec
le choix : elle remplace la partagée, on l’exporte, ou on l’oublie. Rien n’est
écrasé sans qu’on le demande — c’est peut-être la seule copie d’un travail
perdu ailleurs.

## 3. Ce que ça change à l’usage

- **Chaque geste est enregistré aussitôt** et vu par les autres en direct.
  Hors ligne, on continue : les modifications attendent dans l’appareil et
  partent au retour du réseau (« Hors ligne · 3 modifications en attente »).
- **Le journal** (onglet Journal) dit qui a fait quoi, quand. Le champ
  « Je suis » donne son prénom ; il reste sur l’appareil.
- **Revenir en arrière** : chaque ligne du journal propose « Revenir à l’état
  d’avant », qui rétablit la liste telle qu’elle était juste avant ce geste,
  pour tout le monde. Ce retour se note aussi dans le journal : on peut
  l’annuler à son tour.
- « Rétablir l’origine », « Importer », « Remplacer la liste » agissent
  désormais **pour tout le monde** — et se défont par le journal.
- « Partager » (le lien) et « Exporter » restent utiles pour envoyer la liste
  à quelqu’un qui n’a pas l’application, ou en garder une copie.

## 4. Comment c’est fait

La table `developpement` ne connaît que l’**ajout** : les politiques de
sécurité autorisent `select` et `insert` à la clé publique, rien d’autre. Ni
l’application ni personne avec la clé « anon » ne peut modifier ou effacer
une ligne — c’est ce qui garantit que rien ne se perd.

Chaque ligne est soit une **opération** (`genre = 'op'`) — « passer ce point à
validé », « ajouter ce point ici », « renommer cette catégorie », avec son
auteur et sa date —, soit un **instantané** (`genre = 'instantane'`) : la
liste entière à un moment donné, déposé par l’application toutes les quarante
lignes environ, pour que le prochain à arriver n’ait pas tout à rejouer depuis
le début. La liste affichée est l’instantané le plus récent suivi des
opérations arrivées depuis, dans l’ordre du serveur. Deux appareils qui
modifient en même temps ne se gênent pas : leurs opérations se suivent
simplement dans la table.

Une opération porte un identifiant unique ; un index l’impose côté serveur.
Si un envoi est rejoué après une coupure (la ligne était passée mais la
réponse s’est perdue), la seconde copie est refusée et l’application comprend
que la première est là.

Le code : `src/dev/operations.ts` (les opérations, leur application, le
journal), `src/dev/synchro.ts` (la file d’envoi, le rattrapage, les
instantanés, le retour arrière — sans réseau ni React, testé de bout en bout
dans `tests/synchro.test.mjs` avec un faux serveur), `src/dev/serveur.ts`
(la table et le canal Supabase).

## 5. Si quelque chose ne va pas

- **« Sauvegarde partagée non activée »** en tête de liste : la table manque
  (ou ses politiques). Refaire l’étape 1, puis recharger la page. Le bouton
  « Comment l’activer » affiche ce que dit le serveur.
- **« Hors ligne »** alors que le réseau marche : le projet Supabase est
  peut-être en pause (offre gratuite, après une semaine sans activité) —
  Dashboard → **Restore project**. Les modifications attendent dans
  l’appareil et partent quand il répond.
- **Revenir à un état ancien** : onglet Journal, « Revenir à l’état d’avant »
  sur la ligne voulue. Pour une liste très ancienne, le tableau de bord
  (**Table Editor** → `developpement`, filtrer `genre = instantane`) montre
  tous les instantanés avec leur date ; chacun contient la liste entière, à
  enregistrer en fichier `.json` et à passer par « Importer ».
- **Repartir de zéro** : dans le SQL Editor, `truncate public.developpement;`
  efface tout l’historique — c’est la seule façon, et elle est volontaire.
