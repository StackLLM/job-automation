/** Cause d'un échec de tous les fournisseurs (lot L1.6). */
import { describe, it, expect } from 'vitest'
import { causeCommune, estUnDelai } from '../src/profils/fournisseurs/erreurs.js'
import { erreurHttp } from '../src/profils/fournisseurs/pagination.js'

const echec = (code) => ({ fournisseur: 'x', code, message: '' })

describe('causeCommune', () => {
  it('la même cause partout : cette cause', () => {
    expect(causeCommune([echec('quota'), echec('quota')])).toBe('quota')
    expect(causeCommune([echec('cle')])).toBe('cle')
    expect(causeCommune([echec('delai')])).toBe('delai')
  })
  it('causes mêlées, ou autre code : indisponible', () => {
    expect(causeCommune([echec('quota'), echec('cle')])).toBe('indisponible')
    expect(causeCommune([echec('injoignable')])).toBe('indisponible')
    expect(causeCommune([echec('statut'), echec('illisible')])).toBe('indisponible')
  })
})

describe('lecture des erreurs HTTP', () => {
  const http = (status) => Object.assign(new Error(`Request failed ${status}`), { response: { status } })
  it.each([[401, 'cle'], [403, 'cle'], [402, 'quota'], [429, 'quota'], [500, 'statut']])('HTTP %i → %s', (statut, code) => {
    expect(erreurHttp('serper', http(statut)).code).toBe(code)
  })
  it('Brave : 422 SUBSCRIPTION_TOKEN_INVALID (réponse réelle relevée en recette) → cle', () => {
    const corps = { error: { code: 'SUBSCRIPTION_TOKEN_INVALID', detail: 'The provided subscription token is invalid.', meta: { component: 'authentication' }, status: 422 }, type: 'ErrorResponse' }
    expect(erreurHttp('brave', Object.assign(new Error('422'), { response: { status: 422, data: corps } })).code).toBe('cle')
    expect(erreurHttp('brave', Object.assign(new Error('422'), { response: { status: 422, data: { error: { code: 'VALIDATION' } } } })).code).toBe('statut')
  })

  it('délai dépassé ou injoignable', () => {
    expect(erreurHttp('serper', Object.assign(new Error('timeout of 30000ms exceeded'), { code: 'ECONNABORTED' })).code).toBe('delai')
    expect(erreurHttp('serper', new Error('connect ECONNREFUSED')).code).toBe('injoignable')
    expect(estUnDelai({ code: 'ETIMEDOUT' })).toBe(true)
  })
})
