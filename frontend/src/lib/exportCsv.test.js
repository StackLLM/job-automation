/** Export CSV des profils : les colonnes d'avant ne bougent pas, note et étiquettes à la fin (lot L1.5). */
import { describe, it, expect } from 'vitest'
import { lignesProfilsCsv } from './exportCsv'

describe('lignesProfilsCsv', () => {
  it('ajoute Note et Etiquettes à la fin, guillemets doublés', () => {
    const csv = lignesProfilsCsv([{ name: 'Amina', title: 'Cloud', link: 'https://l/in/a', snippet: 'dit "bonjour"', note: 'Elle a dit "oui"', etiquettes: ['cloud', 'recruteur'] }])
    const [entete, ligne] = csv.split('\n')
    expect(entete).toBe('Nom,Titre,Lien,Snippet,Note,Etiquettes')
    expect(ligne).toBe('"Amina","Cloud","https://l/in/a","dit \'bonjour\'","Elle a dit ""oui""","cloud ; recruteur"')
  })

  it('profil sans note ni étiquette : colonnes vides', () => {
    expect(lignesProfilsCsv([{ name: 'A', link: 'x' }]).split('\n')[1]).toBe('"A","","x","","",""')
  })
})
