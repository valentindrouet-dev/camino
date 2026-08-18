import { useState } from 'react'
import { CATALOGUE, groupeVisible, motDePasseValide, varianteVisible } from '../reglages.ts'
import type { Reglages } from '../reglages.ts'
import { Toggle } from '../components/VariantsPanel.tsx'

interface Props {
  reglages: Reglages
  setReglages: (r: Reglages) => void
  onBack: () => void
}

/** Le loquet ne se referme qu'à la fermeture de l'onglet. */
const CLE_SESSION = 'camino.reglages.ouvert'

/**
 * Réglages de la table : ce qui apparaît sur la page d'accueil. On y décoche
 * les familles de variantes et les variantes qu'on ne veut plus proposer aux
 * joueurs — le Laboratoire, lui, continue de tout tester.
 */
export function ReglagesScreen({ reglages, setReglages, onBack }: Props) {
  const [ouvert, setOuvert] = useState(() => sessionStorage.getItem(CLE_SESSION) === '1')
  const [saisie, setSaisie] = useState('')
  const [refus, setRefus] = useState(false)

  const essayer = () => {
    if (motDePasseValide(saisie)) {
      sessionStorage.setItem(CLE_SESSION, '1')
      setOuvert(true)
      setRefus(false)
    } else {
      setRefus(true)
    }
  }

  // ------------------------------------------------------------------ loquet
  if (!ouvert) {
    return (
      <div className="sheet">
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ fontSize: 24 }}>Réglages</h2>
          <button className="btn small" onClick={onBack}>
            ← Retour
          </button>
        </div>
        <div className="panel stack" style={{ maxWidth: 420 }}>
          <p className="note" style={{ margin: 0 }}>
            Cette page décide de ce que les joueurs voient sur la page d’accueil. Elle demande
            un mot de passe.
          </p>
          <label className="field">
            <span>Mot de passe</span>
            <input
              type="password"
              value={saisie}
              autoFocus
              onChange={(e) => {
                setSaisie(e.target.value)
                setRefus(false)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') essayer()
              }}
            />
          </label>
          {refus && <div className="warn">Ce n’est pas le bon mot de passe.</div>}
          <button
            className="btn primary"
            style={{ alignSelf: 'flex-start', padding: '10px 24px' }}
            disabled={!saisie.trim()}
            onClick={essayer}
          >
            Entrer
          </button>
        </div>
      </div>
    )
  }

  // ------------------------------------------------------------- les réglages
  const basculerGroupe = (titre: string, on: boolean) =>
    setReglages({
      ...reglages,
      groupesMasques: on
        ? reglages.groupesMasques.filter((t) => t !== titre)
        : [...new Set([...reglages.groupesMasques, titre])],
    })

  const basculerVariante = (cle: string, on: boolean) =>
    setReglages({
      ...reglages,
      variantesMasquees: on
        ? reglages.variantesMasquees.filter((c) => c !== cle)
        : [...new Set([...reglages.variantesMasquees, cle])],
    })

  const total = CATALOGUE.reduce((n, g) => n + g.variantes.length, 0)
  const affichees = CATALOGUE.reduce(
    (n, g) => n + g.variantes.filter((v) => varianteVisible(reglages, v.cle)).length,
    0,
  )

  return (
    <div className="sheet">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ fontSize: 24 }}>Réglages</h2>
        <button className="btn small" onClick={onBack}>
          ← Retour
        </button>
      </div>

      <div className="panel stack" style={{ marginBottom: 14 }}>
        <p className="note" style={{ margin: 0 }}>
          Décochez ce que vous ne voulez plus proposer sur la page d’accueil. Décocher une
          famille entière la fait disparaître, séparateur compris. Le Laboratoire, lui,
          continue de tout tester : c’est l’outil d’équilibrage.
        </p>
        <div className="row wrap">
          <span className="tag">
            <strong>{affichees}</strong> variante{affichees > 1 ? 's' : ''} sur {total} à
            l’accueil
          </span>
          <button
            className="btn small"
            disabled={affichees === total}
            onClick={() => setReglages({ groupesMasques: [], variantesMasquees: [] })}
          >
            ↺ Tout afficher
          </button>
        </div>
      </div>

      <div className="reglages-grille">
        {CATALOGUE.map((g) => {
          const familleOn = groupeVisible(reglages, g.titre)
          return (
            <div className={`panel stack reglages-famille ${familleOn ? '' : 'off'}`} key={g.titre}>
              <Toggle
                label={g.titre}
                on={familleOn}
                onChange={(v) => basculerGroupe(g.titre, v)}
              />
              <div className="stack" style={{ gap: 6 }}>
                {g.variantes.map((v) => (
                  <Toggle
                    key={v.cle}
                    label={v.label}
                    on={!reglages.variantesMasquees.includes(v.cle)}
                    onChange={(on) => basculerVariante(v.cle, on)}
                  />
                ))}
              </div>
              {!familleOn && (
                <p className="note" style={{ margin: 0 }}>
                  Famille masquée : aucune de ces variantes n’apparaît à l’accueil.
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
