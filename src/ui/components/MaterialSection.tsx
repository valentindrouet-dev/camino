import { useState } from 'react'
import {
  BOARD_COLOR_HEX,
  BOARD_COLOR_NAMES,
  BOARD_COLORS,
  CARDS,
  COLOR_HEX,
  COLOR_NAMES,
  createBoard,
  DEFAULT_RULESET,
  BALANCED_TILE_IDS,
  CLOVERS,
  COLOR_TILE_IDS,
  DOUBLED_TILE_IDS,
  CRYSTALS,
  DYES,
  FAULTS,
  MONO_TILE_IDS,
  MULTI_START_TILE_IDS,
  multiBorderFor,
  PATH_COLORS,
  TILE_COUNT,
  STARS,
  TILES,
  WHITE_TILE_IDS,
  WINDMILLS,
} from '../../engine/index.ts'
import type { Color } from '../../engine/index.ts'
import { BoardView } from './BoardView.tsx'
import { TileGlyph } from './TileGlyph.tsx'
import { MissionCardView } from './MissionCard.tsx'

/**
 * Tout le matériel du jeu en une page : plateaux, tuiles, cartes, variantes.
 *
 * Le matériel des variantes écartées ne s'affiche pas : montrer des tuiles à
 * faille quand la variante n'est plus proposée n'apprend rien à personne.
 */
export function MaterialSection({
  visible = () => true,
}: {
  visible?: (cle: string) => boolean
}) {
  const [tab, setTab] = useState<'plateaux' | 'tuiles' | 'cartes' | 'variantes'>('plateaux')
  const board = createBoard(DEFAULT_RULESET.boardSize)

  const quartCount = {} as Record<Color, number>
  for (const t of TILES.slice(0, TILE_COUNT)) {
    for (const q of t.quads) quartCount[q] = (quartCount[q] ?? 0) + 1
  }

  return (
    <div className="panel" style={{ marginTop: 22 }}>
      <h3>Matériel</h3>
      <div className="tabs">
        <button className={tab === 'plateaux' ? 'on' : ''} onClick={() => setTab('plateaux')}>
          12 plateaux
        </button>
        <button className={tab === 'tuiles' ? 'on' : ''} onClick={() => setTab('tuiles')}>
          97 tuiles
        </button>
        <button className={tab === 'cartes' ? 'on' : ''} onClick={() => setTab('cartes')}>
          {CARDS.length} cartes
        </button>
        <button className={tab === 'variantes' ? 'on' : ''} onClick={() => setTab('variantes')}>
          Variantes
        </button>
      </div>

      {tab === 'plateaux' && (
        <>
          <div className="material-boards">
            {BOARD_COLORS.map((c) => (
              <figure key={c}>
                <BoardView
                  board={board}
                  ruleset={DEFAULT_RULESET}
                  frameColor={BOARD_COLOR_HEX[c]}
                  compact
                  showZones={false}
                />
                <figcaption>{BOARD_COLOR_NAMES[c]}</figcaption>
              </figure>
            ))}
          </div>
          <p className="note" style={{ margin: '10px 0' }}>
            Un plateau de 4 × 4 emplacements par joueur, identifié par la couleur de son contour —
            et sa version à bordures multicolores (variante) : 8 carrés par côté, coins blancs,
            reliés aux chemins de leur couleur ils comptent comme des cases.
          </p>
          <div className="material-boards">
            {BOARD_COLORS.map((c) => (
              <figure key={`m${c}`}>
                <BoardView
                  board={{ ...board, borders: multiBorderFor(c) }}
                  ruleset={DEFAULT_RULESET}
                  frameColor={BOARD_COLOR_HEX[c]}
                  compact
                  showZones={false}
                />
                <figcaption>{BOARD_COLOR_NAMES[c]} — multicolore</figcaption>
              </figure>
            ))}
          </div>
        </>
      )}

      {tab === 'tuiles' && (
        <>
          <div className="material-tiles">
            {TILES.slice(0, TILE_COUNT).map((t) => (
              <TileGlyph key={t.id} tileId={t.id} size={40} />
            ))}
          </div>
          <div className="row wrap" style={{ marginTop: 10 }}>
            {PATH_COLORS.concat(['K' as Color]).map((c) => (
              <span className="tag" key={c}>
                <span
                  className="swatch"
                  style={{ background: COLOR_HEX[c], display: 'inline-block', marginRight: 6 }}
                />
                {COLOR_NAMES[c]} · {quartCount[c]} quarts
              </span>
            ))}
          </div>
          <p className="note" style={{ marginTop: 8 }}>
            97 tuiles, chacune divisée en 4 quarts de couleur : 55 quarts de chaque couleur et 58
            quarts noirs, soit 388 quarts au total. Les marques des variantes — étoiles, trèfles,
            cristaux — ne sont pas dessinées ici : ce sont les tuiles nues de la boîte de base.
          </p>
        </>
      )}

      {tab === 'variantes' && (
        <>
          {visible('balanced') && (
            <>
              <h4 style={{ fontSize: 14, margin: '4px 0 8px' }}>
                12 tuiles « couleurs équilibrées »
              </h4>
              <div className="material-tiles">
                {BALANCED_TILE_IDS.map((id) => (
                  <TileGlyph key={id} tileId={id} size={40} />
                ))}
              </div>
              <p className="note" style={{ marginTop: 10 }}>
                Elles remplacent les douze tuiles en double de la boîte, que voici :
              </p>
              <div className="material-tiles">
                {DOUBLED_TILE_IDS.map((id) => (
                  <TileGlyph key={`d${id}`} tileId={id} size={40} />
                ))}
              </div>
            </>
          )}

          {visible('mono') && (
            <>
              <h4 style={{ fontSize: 14, margin: '4px 0 8px' }}>12 tuiles monochromes</h4>
              <div className="material-tiles">
                {MONO_TILE_IDS.map((id) => (
                  <TileGlyph key={id} tileId={id} size={40} />
                ))}
              </div>
              <p className="note" style={{ marginTop: 10 }}>
                Ajoutées au sac par leur variante : elles densifient les couleurs.
              </p>
            </>
          )}

          {visible('rainbow') && (
            <>
              <h4 style={{ fontSize: 14, margin: '14px 0 8px' }}>6 tuiles arc-en-ciel</h4>
              <div className="material-tiles">
                {WHITE_TILE_IDS.map((id) => (
                  <TileGlyph key={id} tileId={id} size={40} />
                ))}
              </div>
              <p className="note" style={{ marginTop: 10 }}>
                Leur grand carré irisé prolonge et relie les chemins de toutes les couleurs
                voisines.
              </p>
            </>
          )}

          {(visible('start') || visible('secret')) && (
            <>
              <h4 style={{ fontSize: 14, margin: '14px 0 8px' }}>
                6 tuiles couleur (départ et couleur secrète)
              </h4>
              <div className="material-tiles">
                {Object.values(COLOR_TILE_IDS).map((id) => (
                  <TileGlyph key={id} tileId={id} size={40} />
                ))}
              </div>
              <p className="note" style={{ marginTop: 10 }}>
                Elles ne se mélangent jamais au sac : elles servent de tuile de départ et de
                marqueur de couleur secrète.
              </p>
            </>
          )}

          {visible('start') && (
            <>
              <h4 style={{ fontSize: 14, margin: '14px 0 8px' }}>
                6 tuiles de départ multicolores
              </h4>
              <div className="material-tiles">
                {MULTI_START_TILE_IDS.map((id) => (
                  <TileGlyph key={id} tileId={id} size={40} />
                ))}
              </div>
            </>
          )}

          {visible('faults') && (
            <>
              <h4 style={{ fontSize: 14, margin: '18px 0 8px' }}>
                16 tuiles à faille — les deux moitiés ne se relient pas
              </h4>
              <div className="material-tiles">
                {[...FAULTS.keys()].map((id) => (
                  <TileGlyph key={id} tileId={id} size={40} showFault />
                ))}
              </div>
            </>
          )}

          {visible('stars') && (
            <>
              <h4 style={{ fontSize: 14, margin: '18px 0 8px' }}>
                {STARS.size} tuiles à étoile — 1 pt seule, davantage reliée
              </h4>
              <div className="material-tiles">
                {[...STARS.keys()].map((id) => (
                  <TileGlyph key={id} tileId={id} size={40} showStar />
                ))}
              </div>
            </>
          )}

          {visible('clovers') && (
            <>
              <h4 style={{ fontSize: 14, margin: '18px 0 8px' }}>
                {CLOVERS.size} tuiles à trèfle — +3 dans un chemin qui marque, −3 sinon
              </h4>
              <div className="material-tiles">
                {[...CLOVERS.keys()].map((id) => (
                  <TileGlyph key={id} tileId={id} size={40} showClover />
                ))}
              </div>
            </>
          )}

          {visible('crystals') && (
            <>
              <h4 style={{ fontSize: 14, margin: '18px 0 8px' }}>
                {CRYSTALS.size} tuiles à cristal — +4 s’il reste seul de sa couleur, −4 sinon
              </h4>
              <div className="material-tiles">
                {[...CRYSTALS.keys()].map((id) => (
                  <TileGlyph key={id} tileId={id} size={40} showCrystal />
                ))}
              </div>
            </>
          )}

          {visible('dyes') && (
            <>
              <h4 style={{ fontSize: 14, margin: '18px 0 8px' }}>
                {DYES.size} tuiles à teinture — le pot déteint sur la zone noire voisine
              </h4>
              <div className="material-tiles">
                {[...DYES.keys()].map((id) => (
                  <TileGlyph key={id} tileId={id} size={40} showDye />
                ))}
              </div>
            </>
          )}

          {visible('windmills') && (
            <>
              <h4 style={{ fontSize: 14, margin: '18px 0 8px' }}>
                {WINDMILLS.size} tuiles à moulin — les voisines déjà posées tournent d’un quart
              </h4>
              <div className="material-tiles">
                {[...WINDMILLS].map((id) => (
                  <TileGlyph key={id} tileId={id} size={40} showWindmill />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {tab === 'cartes' && (
        <>
          <div className="material-cards">
            {CARDS.map((c) => (
              <MissionCardView key={c.id} card={c} />
            ))}
          </div>
          <p className="note" style={{ marginTop: 10 }}>
            Une seule carte est tirée pour la table : tout le monde joue la même mission. Elle
            s’ajoute au décompte habituel.
          </p>
        </>
      )}
    </div>
  )
}
