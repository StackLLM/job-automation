/** Reprise des données du navigateur (lot L0.7) : ce qui est proposé à l'import, et les messages. */
import { describe, it, expect, beforeEach } from 'vitest'
import { CLE_A_IMPORTER, extraireAImporter, mettreDeCote, lireAImporter, effacerAImporter, resumeAImporter, messageImport } from './importLocal'

const POST = { id: 1, type: 'Storytelling', model: 'deepseek', content: 'Ma première mission', createdAt: '2026-10-29T09:00:00.000Z' }

describe('extraireAImporter', () => {
  it('garde les posts et des paramètres modifiés', () => {
    const etat = { posts: [POST], settings: { defaultTone: 'Startup', scraperWebhook: '' }, scrapedProfiles: [{}] }
    expect(extraireAImporter(etat)).toEqual({ posts: [POST], settings: { defaultTone: 'Startup', scraperWebhook: '' }, profils: [] })
  })

  it('ne propose pas des paramètres restés par défaut', () => {
    expect(extraireAImporter({ posts: [POST], settings: { defaultTone: 'Professionnel', scraperWebhook: '' } }))
      .toEqual({ posts: [POST], settings: null, profils: [] })
  })

  it('garde les profils d’un stockage en version 1 (lot L1.1), sans ceux qui n’ont pas de lien', () => {
    const profil = { name: 'Amina Test', link: 'https://www.linkedin.com/in/amina-test' }
    expect(extraireAImporter({ scrapedProfiles: [profil, { name: 'Sans lien' }], letters: [] }))
      .toEqual({ posts: [], settings: null, profils: [profil] })
  })

  it('rien à importer : null', () => {
    expect(extraireAImporter({ posts: [], settings: { defaultTone: 'Professionnel', scraperWebhook: '' } })).toBeNull()
    expect(extraireAImporter(undefined)).toBeNull()
    expect(extraireAImporter({ posts: 'abîmé' })).toBeNull()
  })

  it('écarte les posts vides', () => {
    expect(extraireAImporter({ posts: [POST, { id: 2 }, null] }).posts).toEqual([POST])
  })
})

describe('stockage à importer', () => {
  beforeEach(() => window.localStorage.clear())

  it('met de côté, relit, efface', () => {
    mettreDeCote({ posts: [POST], settings: null })
    expect(lireAImporter()).toEqual({ posts: [POST], settings: null, profils: [] })
    effacerAImporter()
    expect(lireAImporter()).toBeNull()
  })

  it('n’écrase jamais un premier dépôt pas encore importé, mais le complète', () => {
    const profil = { name: 'Amina Test', link: 'https://www.linkedin.com/in/amina-test' }
    mettreDeCote({ posts: [POST], settings: null })
    mettreDeCote({ posts: [], settings: { defaultTone: 'Startup' }, profils: [profil] })
    expect(lireAImporter()).toEqual({ posts: [POST], settings: { defaultTone: 'Startup' }, profils: [profil] })
  })

  it('un contenu illisible vaut « rien à importer »', () => {
    window.localStorage.setItem(CLE_A_IMPORTER, '{abîmé')
    expect(lireAImporter()).toBeNull()
  })
})

describe('messages', () => {
  it('résume ce que garde le navigateur', () => {
    expect(resumeAImporter({ posts: [POST, POST], settings: {} })).toBe('2 posts et tes paramètres')
    expect(resumeAImporter({ posts: [POST], settings: null })).toBe('1 post')
    expect(resumeAImporter({ posts: [], settings: {} })).toBe('tes paramètres')
    expect(resumeAImporter({ posts: [POST, POST], profils: [{}, {}, {}], settings: {} })).toBe('2 posts, 3 profils et tes paramètres')
    expect(resumeAImporter({ posts: [], profils: [{}] })).toBe('1 profil')
  })

  it('dit ce que l’import a fait', () => {
    expect(messageImport({ posts: { importes: 2, dejaLa: 0 }, parametres: 'importes' })).toBe('2 posts importés, paramètres importés.')
    expect(messageImport({ posts: { importes: 1, dejaLa: 3 }, parametres: 'conserves' })).toBe('1 post importé, 3 déjà dans ton compte.')
    expect(messageImport({ posts: { importes: 0, dejaLa: 0 }, parametres: 'conserves' })).toBe('Rien de nouveau à importer.')
    expect(messageImport({ posts: { importes: 0, dejaLa: 1 }, parametres: 'conserves', profils: { importes: 2, dejaLa: 1 } }))
      .toBe('2 profils importés, 2 déjà dans ton compte.')
  })
})
