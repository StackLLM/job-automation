/** Conversion d'un profil normalisé (backend) vers la forme gardée dans le navigateur. */
import { describe, it, expect } from 'vitest'
import { versProfilLocal } from './api'

const normalise = {
  urlNormalisee: 'https://www.linkedin.com/in/amina-test',
  nom: 'Amina Test', poste: 'Ingénieure Cloud', entreprise: 'Exemple SA', lieu: 'Rabat',
  extrait: 'Cloud, Kubernetes', image: 'https://media.exemple.test/a.jpg', source: 'n8n',
}

describe('versProfilLocal', () => {
  it('garde les champs lus par la table, l’export CSV, la recherche et le dashboard', () => {
    expect(versProfilLocal(normalise)).toEqual({
      name: 'Amina Test',
      title: 'Ingénieure Cloud · Exemple SA',
      link: 'https://www.linkedin.com/in/amina-test',
      snippet: 'Cloud, Kubernetes',
      image: 'https://media.exemple.test/a.jpg',
      poste: 'Ingénieure Cloud', entreprise: 'Exemple SA', lieu: 'Rabat', source: 'n8n',
    })
  })

  it('garde l’identifiant, la date et la recherche d’un profil enregistré sur le compte (lot L1.1)', () => {
    const enregistre = { ...normalise, id: 'p-1', createdAt: '2026-10-31T10:00:00.000Z', rechercheId: 'r-1' }
    expect(versProfilLocal(enregistre)).toMatchObject({ id: 'p-1', createdAt: '2026-10-31T10:00:00.000Z', rechercheId: 'r-1', name: 'Amina Test' })
    expect(versProfilLocal(normalise)).not.toHaveProperty('id')
  })

  it('compose le titre avec ce qui existe, ou null', () => {
    expect(versProfilLocal({ ...normalise, entreprise: null }).title).toBe('Ingénieure Cloud')
    expect(versProfilLocal({ ...normalise, poste: null }).title).toBe('Exemple SA')
    expect(versProfilLocal({ ...normalise, poste: null, entreprise: null }).title).toBeNull()
  })
})
