-- La liste de développement partagée : une table où l'on AJOUTE, jamais plus.
--
-- Chaque geste fait sur la liste (cocher, annoter, ajouter, déplacer…) y
-- devient une ligne « op » ; de temps en temps l'application y dépose une
-- ligne « instantane » (la liste entière à un moment donné) pour que les
-- nouveaux arrivants n'aient pas tout à rejouer. Comme rien ne se modifie ni
-- ne s'efface, le journal est complet et l'on peut toujours revenir en
-- arrière.
--
-- À exécuter une fois, dans l'éditeur SQL du projet Supabase
-- (Dashboard → SQL Editor → New query → coller → Run). Le fichier peut être
-- rejoué sans dommage : il ne crée que ce qui manque.

create table if not exists public.developpement (
  id        bigint generated always as identity primary key,
  cree      timestamptz not null default now(),
  genre     text not null check (genre in ('op', 'instantane')),
  auteur    text not null default '',
  appareil  text not null default '',
  -- pour un instantané : la dernière ligne qu'il intègre
  jusqua    bigint,
  contenu   jsonb not null,
  -- une ligne ne dépasse pas 2 Mo : la liste entière en pèse moins de 200 Ko
  constraint developpement_taille check (pg_column_size(contenu) < 2 * 1024 * 1024)
);

comment on table public.developpement is
  'Liste de développement CAMINO : opérations et instantanés, en ajout seul.';

-- Les lectures : les dernières lignes, les instantanés par jusqua.
create index if not exists developpement_genre_id on public.developpement (genre, id desc);
create index if not exists developpement_instantanes on public.developpement (jusqua desc) where genre = 'instantane';

-- Une opération porte un identifiant unique (contenu->>'u') : si un envoi est
-- rejoué après une coupure, la seconde copie est refusée — et l'application
-- comprend que la première est passée.
create unique index if not exists developpement_operation_unique
  on public.developpement ((contenu->>'u')) where genre = 'op';

-- Sécurité : lecture et ajout pour tous (la clé « anon » est publique par
-- conception, voir src/net/config.ts) ; ni modification ni suppression pour
-- personne hors du tableau de bord. C'est ce qui garantit que rien ne se perd.
alter table public.developpement enable row level security;

drop policy if exists "developpement : lecture" on public.developpement;
create policy "developpement : lecture"
  on public.developpement for select
  to anon, authenticated
  using (true);

drop policy if exists "developpement : ajout" on public.developpement;
create policy "developpement : ajout"
  on public.developpement for insert
  to anon, authenticated
  with check (true);

-- Pas de politique update ni delete : refusés.

-- La diffusion temps réel (prévenir les autres appareils qu'une ligne est
-- arrivée) passe par les canaux « broadcast » de Supabase, actifs par défaut :
-- rien à configurer ici.
