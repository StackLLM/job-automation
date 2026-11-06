/** Tri, filtres et libellés de la liste des profils (lot L1.5). */
import { describe, it, expect } from 'vitest'
import { trierProfils, filtrerProfils, etiquettesDe, sourcesDe, libelleSource, libelleRecherche, nouvelleEtiquette } from './profils'

const A = { id: 'a', name: 'Youssef', title: 'Architecte AWS', snippet: 'Terraform', source: 'n8n', rechercheId: 'r1', etiquettes: ['cloud'], note: 'Relancer', createdAt: '2026-10-01T10:00:00Z', collecteLe: '2026-10-30T10:00:00Z' }
const B = { id: 'b', name: 'amina', title: 'Ingénieure', snippet: 'Kubernetes', source: 'brave', rechercheId: 'r2', etiquettes: ['recruteur', 'cloud'], createdAt: '2026-10-20T10:00:00Z', collecteLe: '2026-10-20T10:00:00Z' }
const C = { id: 'c', name: 'Élodie', title: null, snippet: null, source: 'navigateur', rechercheId: null, etiquettes: [], createdAt: '2026-10-25T10:00:00Z' }

describe('trierProfils', () => {
  it('par dernière collecte (date d’ajout à défaut), plus récente d’abord', () => {
    expect(trierProfils([B, C, A], 'collecte').map((p) => p.id)).toEqual(['a', 'c', 'b'])
  })
  it('par date d’ajout', () => {
    expect(trierProfils([A, B, C], 'ajout').map((p) => p.id)).toEqual(['c', 'b', 'a'])
  })
  it('par nom, sans tenir compte de la casse ni des accents', () => {
    expect(trierProfils([A, C, B], 'nom').map((p) => p.id)).toEqual(['b', 'c', 'a'])
  })
  it('ne modifie pas la liste reçue', () => {
    const liste = [B, A]
    trierProfils(liste, 'nom')
    expect(liste).toEqual([B, A])
  })
})

describe('filtrerProfils', () => {
  it('texte : nom, titre, extrait, note et étiquettes', () => {
    expect(filtrerProfils([A, B, C], { texte: 'terraform' })).toEqual([A])
    expect(filtrerProfils([A, B, C], { texte: 'RELANCER' })).toEqual([A])
    expect(filtrerProfils([A, B, C], { texte: 'recruteur' })).toEqual([B])
  })
  it('recherche d’origine, source, étiquette, et leur combinaison', () => {
    expect(filtrerProfils([A, B, C], { rechercheId: 'r2' })).toEqual([B])
    expect(filtrerProfils([A, B, C], { source: 'navigateur' })).toEqual([C])
    expect(filtrerProfils([A, B, C], { etiquette: 'cloud' })).toEqual([A, B])
    expect(filtrerProfils([A, B, C], { etiquette: 'cloud', source: 'brave' })).toEqual([B])
  })
  it('sans filtre : tout', () => {
    expect(filtrerProfils([A, B, C])).toEqual([A, B, C])
  })
})

describe('valeurs proposées et libellés', () => {
  it('étiquettes et sources présentes', () => {
    expect(etiquettesDe([A, B, C])).toEqual(['cloud', 'recruteur'])
    expect(sourcesDe([A, B, C])).toEqual(['n8n', 'brave', 'navigateur'])
  })
  it('libellés', () => {
    expect(libelleSource('navigateur')).toBe('Import du navigateur')
    expect(libelleSource(undefined)).toBe('Source inconnue')
    expect(libelleRecherche({ requete: 'cloud', lieu: 'maroc', createdAt: '2026-10-31T10:00:00Z' })).toBe('cloud — maroc (31 oct. 2026)')
  })
  it('nouvelle étiquette : propre, sans doublon, 30 caractères au plus', () => {
    expect(nouvelleEtiquette('  Suivi   prioritaire ', [])).toBe('Suivi prioritaire')
    expect(nouvelleEtiquette('CLOUD', ['cloud'])).toBeNull()
    expect(nouvelleEtiquette('   ', [])).toBeNull()
    expect(nouvelleEtiquette('x'.repeat(40), [])).toHaveLength(30)
  })
})
