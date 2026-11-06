/** Règles de fusion d'un profil déjà connu (profils/fusion.js, lot L1.3). */
import { describe, it, expect } from 'vitest'
import { fusionner } from '../src/profils/fusion.js'

const EXISTANT = { nom: 'Amina Test', poste: 'Ingénieure Cloud', entreprise: 'Exemple SA', lieu: null, extrait: 'Cloud', image: null }

describe('fusionner', () => {
  it('rien de nouveau : aucun changement', () => {
    expect(fusionner(EXISTANT, { ...EXISTANT })).toEqual({ donnees: {}, change: false })
  })

  it('une valeur nouvelle remplace l’ancienne', () => {
    expect(fusionner(EXISTANT, { ...EXISTANT, poste: 'Architecte Cloud', extrait: 'AWS' }))
      .toEqual({ donnees: { poste: 'Architecte Cloud', extrait: 'AWS' }, change: true })
  })

  it('une valeur absente n’efface jamais une valeur connue', () => {
    expect(fusionner(EXISTANT, { nom: null, poste: null, entreprise: undefined, extrait: null })).toEqual({ donnees: {}, change: false })
  })

  it('une valeur qui manquait est ajoutée', () => {
    expect(fusionner(EXISTANT, { ...EXISTANT, lieu: 'Rabat' })).toEqual({ donnees: { lieu: 'Rabat' }, change: true })
  })

  it('la source, la date et tout autre champ (note, étiquettes) restent hors de la fusion', () => {
    expect(fusionner(EXISTANT, { ...EXISTANT, source: 'brave', note: 'à écraser', etiquettes: ['x'] }).donnees).toEqual({})
  })
})
