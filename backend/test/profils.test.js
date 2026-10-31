/** Recherche de profils (profils/routes.js, fournisseurs), avec n8n simulé. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { gardeTest } from './aides.js'

const { axiosPost } = vi.hoisted(() => ({ axiosPost: vi.fn() }))
vi.mock('axios', () => ({ default: { post: axiosPost } }))
// Base simulée : la recherche enregistre ses profils (lot L1.1), testé sur une vraie base dans profilsCompte.test.js.
vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    rechercheProfils: { create: vi.fn(async () => ({ id: 'recherche-1' })) },
    profil: { createMany: vi.fn(async ({ data }) => ({ count: data.length })) },
  },
}))

const { creerApp } = await import('../src/app.js')
const { rechercherAvecSecours } = await import('../src/profils/fournisseurs/index.js')
const { extraireListe } = await import('../src/profils/fournisseurs/n8n.js')
const app = creerApp({ journal: false, garde: gardeTest })

const reponseN8n = (corps, status = 200) => ({ status, data: typeof corps === 'string' ? corps : JSON.stringify(corps) })
const PROFILS_N8N = [
  { name: 'Amina Test', title: 'Cloud and DevOps Engineer at Cellenza | LinkedIn', link: 'https://fr.linkedin.com/in/amina-test/en', snippet: 'Cloud &amp; DevOps', image: 'https://media.exemple.test/a.jpg' },
  { name: 'Lien cassé', title: 'Page entreprise', link: 'https://www.linkedin.com/company/exemple', snippet: null, image: null },
]

beforeEach(() => {
  axiosPost.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('POST /api/profils/rechercher', () => {
  it('appelle n8n et renvoie des profils normalisés avec le nombre de rejets', async () => {
    axiosPost.mockResolvedValue(reponseN8n({ profiles: PROFILS_N8N }))

    const res = await request(app).post('/api/profils/rechercher')
      .send({ requete: 'ingenieur cloud', lieu: 'maroc', pages: 2 }).expect(200)

    expect(res.body.source).toBe('n8n')
    expect(res.body.rejetes).toBe(1)
    expect(res.body.profils).toEqual([{
      urlNormalisee: 'https://www.linkedin.com/in/amina-test',
      nom: 'Amina Test', poste: 'Cloud and DevOps Engineer', entreprise: 'Cellenza', lieu: null,
      extrait: 'Cloud & DevOps', image: 'https://media.exemple.test/a.jpg', source: 'n8n',
    }])

    const [url, corps] = axiosPost.mock.calls[0]
    expect(url).toBe('http://localhost:5678/webhook/scraper')
    expect(corps).toEqual({ query: 'ingenieur cloud', location: 'maroc', maxPages: 2 })
  })

  it('met des valeurs par défaut au lieu et au nombre de pages', async () => {
    axiosPost.mockResolvedValue(reponseN8n({ profiles: [] }))
    const res = await request(app).post('/api/profils/rechercher').send({ requete: 'devops' }).expect(200)
    expect(res.body).toEqual({ profils: [], rejetes: 0, source: 'n8n', secours: false, nouveaux: 0, dejaLa: 0, rechercheId: 'recherche-1' })
    expect(axiosPost.mock.calls[0][1]).toEqual({ query: 'devops', location: '', maxPages: 1 })
  })

  it.each([
    [{}, /obligatoire/],
    [{ requete: '   ' }, /obligatoire/],
    [{ requete: 'x'.repeat(121) }, /trop longue/],
    [{ requete: 'devops', lieu: 'x'.repeat(61) }, /trop long/],
    [{ requete: 'devops', pages: 11 }, /.+/],
    [{ requete: 'devops', pages: 0 }, /.+/],
  ])('refuse des paramètres invalides %j (400) sans appeler n8n', async (corps, message) => {
    const res = await request(app).post('/api/profils/rechercher').send(corps).expect(400)
    expect(res.body.error).toMatch(message)
    expect(axiosPost).not.toHaveBeenCalled()
  })

  it.each([
    ['n8n répond une erreur', () => axiosPost.mockResolvedValue(reponseN8n('Workflow inactif', 404))],
    ['n8n répond un texte illisible', () => axiosPost.mockResolvedValue(reponseN8n('<html>pas du JSON</html>'))],
    ['n8n répond sans liste', () => axiosPost.mockResolvedValue(reponseN8n({ message: 'ok' }))],
    ['n8n est injoignable', () => axiosPost.mockRejectedValue(new Error('connect ECONNREFUSED'))],
  ])('renvoie 502 avec un message clair quand %s', async (_, preparer) => {
    preparer()
    const res = await request(app).post('/api/profils/rechercher').send({ requete: 'devops' }).expect(502)
    expect(res.body.error).toBe('La recherche de profils a échoué : aucun fournisseur n’a répondu.')
  })
})

describe('extraireListe', () => {
  it.each([
    ['{"profiles":[1]}', [1]], ['[1,2]', [1, 2]], [{ data: [1] }, [1]], [{ items: [1] }, [1]], [{ results: [1] }, [1]],
    ['pas du json', null], [{ autre: 1 }, null], [null, null],
  ])('%j → %j', (entree, attendu) => {
    expect(extraireListe(entree)).toEqual(attendu)
  })
})

describe('rechercherAvecSecours', () => {
  const enPanne = (nom) => ({ nom, rechercher: vi.fn().mockRejectedValue(Object.assign(new Error('panne'), { code: 'statut' })) })
  const quiRepond = (nom, bruts = [{ lien: 'x' }]) => ({ nom, rechercher: vi.fn().mockResolvedValue(bruts) })

  it('prend le premier fournisseur qui répond et note les échecs précédents', async () => {
    const premier = enPanne('payant')
    const secours = quiRepond('n8n')
    const r = await rechercherAvecSecours({ requete: 'x' }, [premier, secours])
    expect(r.source).toBe('n8n')
    expect(r.echecs).toEqual([{ fournisseur: 'payant', code: 'statut', message: 'panne' }])
    expect(secours.rechercher).toHaveBeenCalledWith({ requete: 'x' })
  })

  it('n’appelle pas le secours quand le premier répond', async () => {
    const secours = quiRepond('n8n')
    await rechercherAvecSecours({ requete: 'x' }, [quiRepond('payant'), secours])
    expect(secours.rechercher).not.toHaveBeenCalled()
  })

  it('lève une erreur avec tous les échecs quand aucun ne répond', async () => {
    await expect(rechercherAvecSecours({ requete: 'x' }, [enPanne('a'), enPanne('b')]))
      .rejects.toMatchObject({ code: 'indisponible', echecs: [{ fournisseur: 'a' }, { fournisseur: 'b' }] })
  })
})
