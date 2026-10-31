/**
 * Lot L1.1 : profils enregistrés sur le compte. Deux vrais comptes, vraie base PostgreSQL, n8n simulé.
 * Schéma « test_profils » : distinct des autres fichiers de test, qui tournent en parallèle.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { execSync } from 'node:child_process'
import { resolve } from 'node:path'
import request from 'supertest'

const SCHEMA = 'test_profils'
const url = new URL(process.env.DATABASE_URL_TEST || 'postgresql://linkedai:linkedai@localhost:5433/linkedai?schema=test')
url.searchParams.set('schema', SCHEMA)
process.env.DATABASE_URL = url.toString()

const { axiosPost } = vi.hoisted(() => ({ axiosPost: vi.fn() }))
vi.mock('axios', () => ({ default: { post: axiosPost } }))

const ORIGINE = 'http://localhost:3000'
let prisma, app, depuisFormeLocale

async function compte(nom) {
  const agent = request.agent(app)
  const email = `${nom.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2)}@exemple.test`
  const res = await agent.post('/api/auth/sign-up/email').set('Origin', ORIGINE)
    .send({ name: nom, email, password: 'mot-de-passe-solide-1' }).expect(200)
  return {
    id: res.body.user.id,
    get: (chemin) => agent.get(chemin).set('Origin', ORIGINE),
    post: (chemin, corps) => agent.post(chemin).set('Origin', ORIGINE).send(corps),
    delete: (chemin) => agent.delete(chemin).set('Origin', ORIGINE),
  }
}

// Réponse n8n de n profils, numérotés à partir de debut.
const reponseN8n = (n, debut = 0) => ({
  status: 200,
  data: JSON.stringify({ profiles: Array.from({ length: n }, (_, i) => ({
    name: `Personne ${debut + i}`, title: `Personne ${debut + i} - Ingénieur Cloud at Exemple ${debut + i} | LinkedIn`,
    link: `https://ma.linkedin.com/in/personne-${debut + i}`, snippet: 'Cloud, Kubernetes', image: null,
  })) }),
})
const rechercher = (qui, n, debut = 0, requete = 'ingenieur cloud') => {
  axiosPost.mockResolvedValueOnce(reponseN8n(n, debut))
  return qui.post('/api/profils/rechercher', { requete, lieu: 'maroc', pages: 1 })
}
// Tous les profils du compte, page par page, comme le front.
async function tousLesProfils(qui, parPage = 200) {
  const profils = []
  for (let page = 1; ; page++) {
    const res = (await qui.get(`/api/profils?page=${page}&parPage=${parPage}`).expect(200)).body
    profils.push(...res.profils)
    if (profils.length >= res.total || !res.profils.length) return { profils, total: res.total }
  }
}

beforeAll(async () => {
  prisma = (await import('../src/lib/prisma.js')).prisma
  await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`)
  execSync('npx prisma migrate deploy', { cwd: resolve(import.meta.dirname, '..'), env: { ...process.env }, stdio: 'pipe' })
  const { creerApp } = await import('../src/app.js')
  ;({ depuisFormeLocale } = await import('../src/profils/normaliser.js'))
  app = creerApp({ journal: false, limiteConnexion: false })
}, 120_000)

afterAll(async () => { await prisma?.$disconnect() })

describe('depuisFormeLocale — profil du navigateur ou d’un webhook', () => {
  it('reprend les champs du backend tels quels', () => {
    const local = { name: 'Amina Test', title: 'Ingénieure Cloud · Exemple SA', link: 'https://www.linkedin.com/in/amina-test', snippet: 'Cloud', image: null, poste: 'Ingénieure Cloud', entreprise: 'Exemple SA', lieu: 'Rabat', source: 'serper' }
    expect(depuisFormeLocale(local, 'navigateur')).toEqual({ ok: true, profil: {
      urlNormalisee: 'https://www.linkedin.com/in/amina-test', nom: 'Amina Test', poste: 'Ingénieure Cloud',
      entreprise: 'Exemple SA', lieu: 'Rabat', extrait: 'Cloud', image: null, source: 'serper',
    } })
  })

  it('sans poste séparé, garde le titre entier comme poste et n’invente pas d’entreprise', () => {
    const r = depuisFormeLocale({ name: 'Youssef', title: 'Architecte AWS - Exemple', link: 'https://fr.linkedin.com/in/Youssef-Essai/' }, 'webhook')
    expect(r.profil).toMatchObject({ urlNormalisee: 'https://www.linkedin.com/in/youssef-essai', poste: 'Architecte AWS - Exemple', entreprise: null, source: 'webhook' })
  })

  it('rejette un lien qui n’est pas un profil', () => {
    expect(depuisFormeLocale({ name: 'X', link: 'https://www.linkedin.com/company/x' }, 'webhook')).toEqual({ ok: false, raison: 'url-invalide' })
  })
})

describe('recherche → profils enregistrés sur le compte', () => {
  it('300 profils trouvés restent 300 après relecture, sans troncature', { timeout: 30_000 }, async () => {
    const A = await compte('Amina')
    for (let i = 0; i < 3; i++) {
      const res = await rechercher(A, 100, i * 100).expect(200)
      expect(res.body).toMatchObject({ nouveaux: 100, dejaLa: 0, rejetes: 0, source: 'n8n' })
    }
    const { profils, total } = await tousLesProfils(A, 120)
    expect(total).toBe(300)
    expect(new Set(profils.map((p) => p.id)).size).toBe(300)
    // Plus récents d'abord, et l'ordre du fournisseur gardé dans une recherche.
    expect(profils[0].nom).toBe('Personne 200')
    expect(profils[1].nom).toBe('Personne 201')
    expect(profils.at(-1).nom).toBe('Personne 99')
    expect(profils[0]).not.toHaveProperty('userId')
  })

  it('garde la recherche d’origine et relie ses profils', async () => {
    const A = await compte('Amina')
    const res = await rechercher(A, 3, 0, 'devops casablanca').expect(200)
    const recherche = await prisma.rechercheProfils.findUnique({ where: { id: res.body.rechercheId }, include: { profils: true } })
    expect(recherche).toMatchObject({ userId: A.id, requete: 'devops casablanca', lieu: 'maroc', pages: 1, source: 'n8n', trouves: 3, rejetes: 0 })
    expect(recherche.profils).toHaveLength(3)
  })

  it('la même URL n’est gardée qu’une fois par compte', async () => {
    const A = await compte('Amina')
    await rechercher(A, 5).expect(200)
    const res = await rechercher(A, 5).expect(200)
    expect(res.body).toMatchObject({ nouveaux: 0, dejaLa: 5 })
    expect((await tousLesProfils(A)).total).toBe(5)
  })

  it('pagination : page et taille respectées, taille hors bornes refusée (400)', async () => {
    const A = await compte('Amina')
    await rechercher(A, 7).expect(200)
    const page2 = (await A.get('/api/profils?page=2&parPage=5').expect(200)).body
    expect(page2).toMatchObject({ total: 7, page: 2, parPage: 5 })
    expect(page2.profils).toHaveLength(2)
    await A.get('/api/profils?parPage=201').expect(400)
    await A.get('/api/profils?page=0').expect(400)
  })
})

describe('POST /api/profils/lot — webhook réglé à la main', () => {
  it('enregistre les profils valides, compte les rejets, garde la recherche', async () => {
    const A = await compte('Amina')
    const res = await A.post('/api/profils/lot', {
      requete: 'cloud', lieu: 'rabat',
      profils: [
        { name: 'Amina Test', title: 'Ingénieure Cloud', link: 'https://www.linkedin.com/in/amina-test', snippet: 'Cloud' },
        { name: 'Page', title: 'Entreprise', link: 'https://www.linkedin.com/company/x' },
      ],
    }).expect(200)
    expect(res.body).toEqual({ nouveaux: 1, dejaLa: 0, rejetes: 1 })
    const { profils } = await tousLesProfils(A)
    expect(profils[0]).toMatchObject({ nom: 'Amina Test', poste: 'Ingénieure Cloud', source: 'webhook' })
    expect(profils[0].rechercheId).toBeTruthy()
  })

  it('refuse un corps sans liste (400)', async () => {
    const A = await compte('Amina')
    await A.post('/api/profils/lot', {}).expect(400)
  })
})

describe('import du navigateur étendu aux profils', () => {
  const LOCAUX = [
    { name: 'Amina Test', title: 'Ingénieure Cloud · Exemple SA', link: 'https://www.linkedin.com/in/amina-test', snippet: 'Cloud', poste: 'Ingénieure Cloud', entreprise: 'Exemple SA', source: 'n8n' },
    { name: 'Youssef Essai', title: 'Architecte AWS', link: 'https://www.linkedin.com/in/youssef-essai', snippet: 'AWS' },
    { name: 'Cassé', link: 'pas un lien' },
  ]

  it('importe, puis relancé n’ajoute aucun doublon', async () => {
    const A = await compte('Amina')
    const premier = await A.post('/api/compte/import-local', { profils: LOCAUX }).expect(200)
    expect(premier.body.profils).toEqual({ importes: 2, dejaLa: 0, ecartes: 1 })
    const second = await A.post('/api/compte/import-local', { profils: LOCAUX }).expect(200)
    expect(second.body.profils).toEqual({ importes: 0, dejaLa: 2, ecartes: 1 })
    const { profils } = await tousLesProfils(A)
    expect(profils.map((p) => p.nom)).toEqual(['Amina Test', 'Youssef Essai'])
    expect(profils[1].source).toBe('navigateur')
  })
})

describe('TS-ISOLATION — profils et recherches', () => {
  it('B ne voit ni les profils ni le nombre de profils de A', async () => {
    const A = await compte('Amina')
    const B = await compte('Bilal')
    await rechercher(A, 4).expect(200)
    expect((await B.get(`/api/profils?userId=${A.id}`).expect(200)).body).toMatchObject({ profils: [], total: 0 })
  })

  it('la même URL chez deux comptes : deux lignes, et la réponse à B ne dit pas que A l’a déjà', async () => {
    const A = await compte('Amina')
    const B = await compte('Bilal')
    await rechercher(A, 3).expect(200)
    const res = await rechercher(B, 3).expect(200)
    expect(res.body).toMatchObject({ nouveaux: 3, dejaLa: 0 })
    expect(await prisma.profil.count({ where: { urlNormalisee: 'https://www.linkedin.com/in/personne-0', userId: { in: [A.id, B.id] } } })).toBe(2)
  })

  it('B ne peut pas supprimer un profil de A (404), A le peut (204)', async () => {
    const A = await compte('Amina')
    const B = await compte('Bilal')
    await rechercher(A, 2).expect(200)
    const [premier] = (await tousLesProfils(A)).profils
    await B.delete(`/api/profils/${premier.id}`).expect(404)
    expect((await tousLesProfils(A)).total).toBe(2)
    await A.delete(`/api/profils/${premier.id}`).expect(204)
    await A.delete(`/api/profils/${premier.id}`).expect(404)
    expect((await tousLesProfils(A)).total).toBe(1)
  })

  it('« Vider » de B ne touche pas aux profils de A', async () => {
    const A = await compte('Amina')
    const B = await compte('Bilal')
    await rechercher(A, 3).expect(200)
    await rechercher(B, 2).expect(200)
    expect((await B.delete('/api/profils').expect(200)).body).toEqual({ supprimes: 2 })
    expect((await tousLesProfils(A)).total).toBe(3)
    expect((await tousLesProfils(B)).total).toBe(0)
  })

  it('supprimer un compte supprime ses profils et ses recherches', async () => {
    const C = await compte('Chaima')
    await rechercher(C, 3).expect(200)
    await prisma.user.delete({ where: { id: C.id } })
    expect(await prisma.profil.count({ where: { userId: C.id } })).toBe(0)
    expect(await prisma.rechercheProfils.count({ where: { userId: C.id } })).toBe(0)
  })

  it('sans session : 401 partout', async () => {
    await request(app).get('/api/profils').expect(401)
    await request(app).post('/api/profils/lot').send({ profils: [] }).expect(401)
    await request(app).delete('/api/profils').expect(401)
    await request(app).delete('/api/profils/x').expect(401)
  })
})
