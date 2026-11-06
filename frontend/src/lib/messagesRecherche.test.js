/** Table erreur → message de la recherche de profils (lot L1.6). */
import { describe, it, expect } from 'vitest'
import { messageErreurRecherche, messageErreurWebhook, MESSAGES, pagesDemandees } from './messagesRecherche'

const api = (status, extra = {}) => Object.assign(new Error('message du serveur'), { status, ...extra })

describe('messageErreurRecherche', () => {
  it.each([
    ['annulée', { annulee: true }, MESSAGES.annulee],
    ['délai du navigateur', { code: 'ECONNABORTED' }, MESSAGES.delai],
    ['réseau (aucune réponse)', {}, MESSAGES.reseau],
    ['401', api(401), MESSAGES.session],
    ['403', api(403), MESSAGES.refus],
    ['429', api(429), MESSAGES.tropDeRecherches],
    ['502 quota', api(502, { causeEchec: 'quota' }), MESSAGES.quota],
    ['502 clé', api(502, { causeEchec: 'cle' }), MESSAGES.cle],
    ['502 délai de la source', api(502, { causeEchec: 'delai' }), MESSAGES.sourceLente],
    ['502 sans cause', api(502), MESSAGES.sourceIndisponible],
    ['500', api(500), MESSAGES.serveur],
    ['409 recherche annulée', api(409, { causeEchec: 'annulee' }), MESSAGES.annulee],
    ['418', api(418), MESSAGES.inconnu],
  ])('%s', (_, erreur, attendu) => {
    expect(messageErreurRecherche(Object.assign(new Error('x'), erreur)).message).toBe(attendu)
  })

  it('400 : garde le message du serveur, déjà en français', () => {
    expect(messageErreurRecherche(api(400)).message).toBe('message du serveur')
  })

  it('chaque situation a un message différent, sans texte technique', () => {
    const tous = Object.values(MESSAGES)
    expect(new Set(tous).size).toBe(tous.length)
    for (const m of tous) expect(m).not.toMatch(/ECONN|ERR_|undefined|null|axios|\d{3}/)
  })

  it('signale l’annulation, pour un message neutre plutôt qu’une erreur', () => {
    expect(messageErreurRecherche({ annulee: true })).toEqual({ message: MESSAGES.annulee, annulee: true })
  })
})

describe('messageErreurWebhook', () => {
  it('statut HTTP, injoignable, délai, annulation', () => {
    expect(messageErreurWebhook({ response: { status: 404 } }).message).toBe('Ton webhook n8n a répondu par une erreur (code 404). Vérifie son adresse dans Paramètres.')
    expect(messageErreurWebhook(new Error('Network Error')).message).toBe(MESSAGES.webhookInjoignable)
    expect(messageErreurWebhook({ code: 'ECONNABORTED' }).message).toBe(MESSAGES.delai)
    expect(messageErreurWebhook({ name: 'CanceledError' }).annulee).toBe(true)
  })
})

it('pagesDemandees', () => {
  expect(pagesDemandees(1)).toBe('1 page')
  expect(pagesDemandees('5')).toBe('jusqu’à 5 pages')
})
