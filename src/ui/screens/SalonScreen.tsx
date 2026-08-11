import { useState } from 'react'
import { BOARD_COLORS } from '../../engine/index.ts'
import type { BoardColor } from '../../engine/index.ts'
import { BOARD_COLOR_HEX, BOARD_COLOR_NAMES, plateauxPris } from '../../net/useSalon.ts'
import type { EtatSalon } from '../../net/useSalon.ts'
import { VariantsPanel } from '../components/VariantsPanel.tsx'
import { monIdentite } from '../../net/useSalon.ts'

interface Props {
  salon: EtatSalon
  onBack: () => void
}

/**
 * Les salons en ligne : la liste de ce qui est ouvert, puis la salle d'attente
 * où chacun prend son plateau en attendant que l'hôte lance la partie.
 */
export function SalonScreen({ salon: s, onBack }: Props) {
  const moi = monIdentite()
  const [nom, setNom] = useState(moi.nom || '')
  const [showScale, setShowScale] = useState(false)

  // ------------------------------------------------------------- salle d'attente
  if (s.salon) {
    const salon = s.salon
    const pris = plateauxPris(salon, moi.id)
    const moiSalon = salon.joueurs.find((j) => j.id === moi.id)
    const assis = salon.joueurs.filter((j) => j.present && j.boardColor)
    const pretAJouer = assis.length >= 2 && assis.length <= 6

    return (
      <div className="sheet">
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ fontSize: 24 }}>
            {salon.nom}
            <span className="tag" style={{ marginLeft: 10 }}>
              {s.suisHote ? 'vous recevez' : 'invité'}
            </span>
          </h2>
          <button className="btn small" onClick={s.quitter}>
            ← Quitter le salon
          </button>
        </div>

        <div className="grid-2">
          <div className="stack">
            <div className="panel stack">
              <h3>Joueurs ({salon.joueurs.filter((j) => j.present).length})</h3>
              <div className="stack" style={{ gap: 8 }}>
                {salon.joueurs
                  .filter((j) => j.present)
                  .map((j) => (
                    <div className="salon-joueur" key={j.id}>
                      <span
                        className="dot"
                        style={{
                          background: j.boardColor
                            ? BOARD_COLOR_HEX[j.boardColor]
                            : 'var(--line)',
                        }}
                      />
                      <strong>{j.nom || 'Sans nom'}</strong>
                      {j.id === salon.hote && <span className="tag">hôte</span>}
                      {j.id === moi.id && <span className="tag">vous</span>}
                      <span className="note" style={{ marginLeft: 'auto' }}>
                        {j.boardColor
                          ? BOARD_COLOR_NAMES[j.boardColor]
                          : 'choisit son plateau…'}
                      </span>
                    </div>
                  ))}
              </div>

              <div style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                <span className="note">Votre plateau</span>
                <div className="color-picker" style={{ marginTop: 6 }}>
                  {BOARD_COLORS.map((c) => (
                    <button
                      key={c}
                      className={`chip ${moiSalon?.boardColor === c ? 'on' : ''}`}
                      style={{
                        background: BOARD_COLOR_HEX[c],
                        opacity: pris.includes(c as BoardColor) ? 0.25 : 1,
                      }}
                      disabled={pris.includes(c as BoardColor)}
                      title={
                        pris.includes(c as BoardColor)
                          ? `Plateau ${BOARD_COLOR_NAMES[c].toLowerCase()} déjà pris`
                          : `Plateau ${BOARD_COLOR_NAMES[c].toLowerCase()}`
                      }
                      onClick={() => s.choisirPlateau(c as BoardColor)}
                    />
                  ))}
                </div>
              </div>

              {s.suisHote ? (
                <>
                  <button
                    className="btn primary"
                    style={{ padding: '12px 30px', alignSelf: 'stretch' }}
                    disabled={!pretAJouer}
                    onClick={s.commencer}
                  >
                    Commencer la partie
                  </button>
                  <p className="note">
                    {pretAJouer
                      ? `${assis.length} joueurs prêts. Une fois lancée, la partie se ferme : personne d’autre ne pourra rejoindre.`
                      : 'Il faut au moins deux joueurs ayant choisi un plateau.'}
                  </p>
                </>
              ) : (
                <p className="note">
                  En attente que <strong>{salon.joueurs.find((j) => j.id === salon.hote)?.nom ?? 'l’hôte'}</strong>{' '}
                  lance la partie. Choisissez votre plateau en attendant.
                </p>
              )}
            </div>
          </div>

          {s.suisHote ? (
            <VariantsPanel
              options={salon.options}
              setOptions={(maj) =>
                s.changerOptions(typeof maj === 'function' ? maj(salon.options) : maj)
              }
              showScale={showScale}
              setShowScale={setShowScale}
            />
          ) : (
            <div className="panel">
              <h3>Variantes</h3>
              <p className="note">
                C’est l’hôte qui choisit les règles de la partie. Elles vous seront rappelées en
                cours de jeu, dans la colonne de droite.
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ------------------------------------------------------------- liste des salons
  const ouverts = s.liste.filter((x) => x.phase === 'attente')
  return (
    <div className="sheet">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ fontSize: 24 }}>Parties en ligne</h2>
        <button className="btn small" onClick={onBack}>
          ← Retour
        </button>
      </div>

      <div className="panel stack" style={{ marginBottom: 14 }}>
        <label className="field" style={{ maxWidth: 320 }}>
          <span>Votre nom</span>
          <input
            type="text"
            value={nom}
            maxLength={18}
            placeholder="Comment les autres vous verront"
            onChange={(e) => setNom(e.target.value)}
          />
        </label>
        <button
          className="btn primary"
          style={{ alignSelf: 'flex-start', padding: '12px 24px' }}
          disabled={!nom.trim()}
          onClick={() => s.ouvrir(nom.trim())}
        >
          Démarrer une partie en ligne
        </button>
        <p className="note">
          Vous ouvrez un salon, les autres le voient apparaître dans la liste ci-dessous et
          viennent s’y asseoir.
        </p>
      </div>

      <div className="panel stack">
        <h3>Rejoindre un salon ({ouverts.length})</h3>
        {ouverts.length === 0 && (
          <p className="note">
            Aucun salon ouvert pour l’instant. Ouvrez-en un — ou attendez qu’un joueur s’y colle.
          </p>
        )}
        {ouverts.map((x) => (
          <div className="salon-ligne" key={x.id}>
            <strong>{x.nom}</strong>
            <span className="note">
              {x.joueurs} joueur{x.joueurs > 1 ? 's' : ''}
              {x.noms.length ? ` · ${x.noms.join(', ')}` : ''}
            </span>
            <button
              className="btn small primary"
              disabled={!nom.trim() || x.joueurs >= 6}
              title={x.joueurs >= 6 ? 'Salon complet' : undefined}
              onClick={() => s.rejoindre(x.id, nom.trim())}
            >
              {x.joueurs >= 6 ? 'Complet' : 'Rejoindre'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
