/** Fournisseurs payants Serper et Brave, ordre et bascule (lot L1.4), avec les API simulées. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import { gardeTest } from './aides.js'

const { axiosPost, axiosGet } = vi.hoisted(() => ({ axiosPost: vi.fn(), axiosGet: vi.fn() }))
vi.mock('axios', () => ({ default: { post: axiosPost, get: axiosGet } }))
// Base simulée : la recherche enregistre ses profils (lot L1.1), testé sur une vraie base dans profilsCompte.test.js.
vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    rechercheProfils: { create: vi.fn(async () => ({ id: 'recherche-1' })) },
    profil: { createMany: vi.fn(async ({ data }) => ({ count: data.length })) },
  },
}))

const { serper } = await import('../src/profils/fournisseurs/serper.js')
const { brave } = await import('../src/profils/fournisseurs/brave.js')
const { fournisseursActifs } = await import('../src/profils/fournisseurs/index.js')
const { creerApp } = await import('../src/app.js')

const erreurHttp = (status) => Object.assign(new Error(`HTTP ${status}`), { response: { status } })
const pageSerper = (n, debut = 0) => ({ data: { organic: Array.from({ length: n }, (_, i) => ({
  title: `Profil ${debut + i} - Ingénieur Cloud at Exemple | LinkedIn`,
  link: `https://ma.linkedin.com/in/profil-${debut + i}`,
  snippet: 'Cloud &amp; DevOps',
})) } })
const pageBrave = (n, encore = true) => ({ data: {
  query: { more_results_available: encore },
  web: { results: Array.from({ length: n }, (_, i) => ({
    title: `Profil ${i} - <strong>DevOps</strong> chez Exemple`,
    url: `https://fr.linkedin.com/in/brave-${i}`,
    description: 'Ingénieur <strong>DevOps</strong> à Rabat',
    thumbnail: { src: 'https://imgs.exemple.test/t.jpg' },
  })) },
} })

beforeEach(() => {
  axiosPost.mockReset()
  axiosGet.mockReset()
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.stubEnv('SERPER_API_KEY', '')
  vi.stubEnv('BRAVE_API_KEY', '')
})
afterEach(() => vi.unstubAllEnvs())

describe('serper', () => {
  beforeEach(() => vi.stubEnv('SERPER_API_KEY', 'cle-serper'))

  it('demande les profils LinkedIn page par page avec la clé en en-tête', async () => {
    axiosPost.mockResolvedValueOnce(pageSerper(10)).mockResolvedValueOnce(pageSerper(10, 10))
    const bruts = await serper.rechercher({ requete: 'ingenieur  cloud', lieu: 'maroc', pages: 2 })

    expect(bruts).toHaveLength(20)
    expect(bruts[0]).toEqual({ titre: 'Profil 0 - Ingénieur Cloud at Exemple | LinkedIn', lien: 'https://ma.linkedin.com/in/profil-0', extrait: 'Cloud &amp; DevOps', image: null })
    const [url, corps, options] = axiosPost.mock.calls[1]
    expect(url).toBe('https://google.serper.dev/search')
    expect(corps).toEqual({ q: 'ingenieur cloud maroc site:linkedin.com/in', page: 2, num: 10 })
    expect(options.headers['X-API-KEY']).toBe('cle-serper')
  })

  it('s’arrête à la première page vide, sans consommer les suivantes', async () => {
    axiosPost.mockResolvedValueOnce(pageSerper(4)).mockResolvedValueOnce(pageSerper(0))
    const bruts = await serper.rechercher({ requete: 'devops', lieu: '', pages: 5 })
    expect(bruts).toHaveLength(4)
    expect(axiosPost).toHaveBeenCalledTimes(2)
  })

  it.each([[401, 'cle'], [403, 'cle'], [429, 'quota'], [402, 'quota'], [500, 'statut']])('HTTP %i → erreur « %s »', async (status, code) => {
    axiosPost.mockRejectedValue(erreurHttp(status))
    await expect(serper.rechercher({ requete: 'x', lieu: '', pages: 1 })).rejects.toMatchObject({ fournisseur: 'serper', code })
  })

  it('réseau coupé → erreur « injoignable »', async () => {
    axiosPost.mockRejectedValue(new Error('ECONNRESET'))
    await expect(serper.rechercher({ requete: 'x', lieu: '', pages: 1 })).rejects.toMatchObject({ code: 'injoignable' })
  })
})

describe('brave', () => {
  beforeEach(() => vi.stubEnv('BRAVE_API_KEY', 'cle-brave'))

  it('demande les profils avec offset et clé, retire les balises <strong>', async () => {
    axiosGet.mockResolvedValueOnce(pageBrave(10)).mockResolvedValueOnce(pageBrave(10))
    const bruts = await brave.rechercher({ requete: 'devops', lieu: 'rabat', pages: 2 })

    expect(bruts).toHaveLength(20)
    expect(bruts[0]).toEqual({
      titre: 'Profil 0 - DevOps chez Exemple', lien: 'https://fr.linkedin.com/in/brave-0',
      extrait: 'Ingénieur DevOps à Rabat', image: 'https://imgs.exemple.test/t.jpg',
    })
    const [url, options] = axiosGet.mock.calls[1]
    expect(url).toBe('https://api.search.brave.com/res/v1/web/search')
    expect(options.params).toEqual({ q: 'devops rabat site:linkedin.com/in', count: 10, offset: 1 })
    expect(options.headers['X-Subscription-Token']).toBe('cle-brave')
  })

  it('s’arrête quand Brave annonce qu’il n’y a plus de résultats', async () => {
    axiosGet.mockResolvedValueOnce(pageBrave(10, false))
    const bruts = await brave.rechercher({ requete: 'devops', lieu: '', pages: 5 })
    expect(bruts).toHaveLength(10)
    expect(axiosGet).toHaveBeenCalledTimes(1)
  })

  it('HTTP 429 → erreur « quota »', async () => {
    axiosGet.mockRejectedValue(erreurHttp(429))
    await expect(brave.rechercher({ requete: 'x', lieu: '', pages: 1 })).rejects.toMatchObject({ fournisseur: 'brave', code: 'quota' })
  })
})

describe('ordre des fournisseurs', () => {
  it('sans clé : n8n seul', () => {
    expect(fournisseursActifs().map((f) => f.nom)).toEqual(['n8n'])
  })

  it('avec les deux clés : Serper, Brave, puis n8n', () => {
    vi.stubEnv('SERPER_API_KEY', 'a')
    vi.stubEnv('BRAVE_API_KEY', 'b')
    expect(fournisseursActifs().map((f) => f.nom)).toEqual(['serper', 'brave', 'n8n'])
  })
})

describe('POST /api/profils/rechercher avec les fournisseurs payants', () => {
  const app = creerApp({ journal: false, garde: gardeTest })
  const reponseN8n = { status: 200, data: JSON.stringify({ profiles: [{ name: 'Secours N8n', title: 'Architecte', link: 'https://www.linkedin.com/in/secours-n8n' }] }) }

  it('Serper répond : profils normalisés, source serper, sans secours ni appel à n8n', async () => {
    vi.stubEnv('SERPER_API_KEY', 'cle-serper')
    axiosPost.mockResolvedValueOnce(pageSerper(3))

    const res = await request(app).post('/api/profils/rechercher').send({ requete: 'cloud', pages: 1 }).expect(200)
    expect(res.body).toMatchObject({ source: 'serper', secours: false, rejetes: 0 })
    expect(res.body.profils[0]).toMatchObject({ urlNormalisee: 'https://www.linkedin.com/in/profil-0', poste: 'Ingénieur Cloud', entreprise: 'Exemple', extrait: 'Cloud & DevOps', source: 'serper' })
    expect(axiosPost).toHaveBeenCalledTimes(1)
  })

  it('Serper épuisé : Brave prend le relais', async () => {
    vi.stubEnv('SERPER_API_KEY', 'cle-serper')
    vi.stubEnv('BRAVE_API_KEY', 'cle-brave')
    axiosPost.mockRejectedValueOnce(erreurHttp(429))
    axiosGet.mockResolvedValueOnce(pageBrave(2, false))

    const res = await request(app).post('/api/profils/rechercher').send({ requete: 'devops', pages: 1 }).expect(200)
    expect(res.body).toMatchObject({ source: 'brave', secours: true })
    expect(res.body.profils).toHaveLength(2)
  })

  it('Serper et Brave en panne : n8n en dernier secours', async () => {
    vi.stubEnv('SERPER_API_KEY', 'cle-serper')
    vi.stubEnv('BRAVE_API_KEY', 'cle-brave')
    axiosPost.mockRejectedValueOnce(erreurHttp(401)).mockResolvedValueOnce(reponseN8n)
    axiosGet.mockRejectedValueOnce(erreurHttp(500))

    const res = await request(app).post('/api/profils/rechercher').send({ requete: 'devops', pages: 1 }).expect(200)
    expect(res.body).toMatchObject({ source: 'n8n', secours: true })
    expect(res.body.profils[0].nom).toBe('Secours N8n')
    expect(axiosPost.mock.calls[1][0]).toMatch(/\/webhook\/scraper$/)
  })

  it('tous en panne : 502 avec un message en français', async () => {
    vi.stubEnv('SERPER_API_KEY', 'cle-serper')
    axiosPost.mockRejectedValueOnce(erreurHttp(500)).mockRejectedValueOnce(new Error('ECONNREFUSED'))
    const res = await request(app).post('/api/profils/rechercher').send({ requete: 'devops' }).expect(502)
    expect(res.body.error).toBe('La recherche de profils a échoué : aucun fournisseur n’a répondu.')
  })

  it('les clés ne figurent jamais dans la réponse', async () => {
    vi.stubEnv('SERPER_API_KEY', 'cle-tres-secrete')
    axiosPost.mockResolvedValueOnce(pageSerper(1))
    const res = await request(app).post('/api/profils/rechercher').send({ requete: 'cloud' }).expect(200)
    expect(JSON.stringify(res.body)).not.toContain('cle-tres-secrete')
  })
})
