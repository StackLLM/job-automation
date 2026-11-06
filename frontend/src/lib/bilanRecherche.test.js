/** Bilan d'une recherche de profils (lot L1.3). */
import { describe, it, expect } from 'vitest'
import { bilanRecherche, profilsGardes } from './bilanRecherche'

describe('bilanRecherche', () => {
  it('cite chaque nombre non nul, accordé', () => {
    expect(bilanRecherche({ nouveaux: 3, misAJour: 2, inchanges: 5, rejetes: 1 })).toBe('3 nouveaux, 2 mis à jour, 5 déjà à jour, 1 rejeté')
    expect(bilanRecherche({ nouveaux: 1, rejetes: 2 })).toBe('1 nouveau, 2 rejetés')
  })

  it('relancer la même recherche : seulement « déjà à jour »', () => {
    expect(bilanRecherche({ nouveaux: 0, misAJour: 0, inchanges: 10, rejetes: 0 })).toBe('10 déjà à jour')
  })

  it('compte les profils gardés', () => {
    expect(profilsGardes({ nouveaux: 3, misAJour: 2, inchanges: 5 })).toBe(10)
    expect(profilsGardes({})).toBe(0)
  })
})
