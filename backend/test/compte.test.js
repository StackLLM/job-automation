/**
 * Lot L0.7 : posts et paramètres du compte, reprise des données du navigateur.
 * Deux vrais comptes, vraie base PostgreSQL, OpenRouter simulé.
 * Schéma « test_compte » : distinct des autres fichiers de test, qui tournent en parallèle.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { execSync } from 'node:child_process'
import { resolve } from 'node:path'
import request from 'supertest'

const SCHEMA = 'test_compte'
const url = new URL(process.env.DATABASE_URL_TEST || 'postgresql://linkedai:linkedai@localhost:5433/linkedai?schema=test')
url.searchParams.set('schema', SCHEMA)
process.env.DATABASE_URL = url.toString()

const { axiosPost } = vi.hoisted(() => ({ axiosPost: vi.fn() }))
vi.mock('axios', () => ({ default: { post: axiosPost } }))

const ORIGINE = 'http://localhost:3000'
let prisma, app, versPostServeur

async function compte(nom) {
  const agent = request.agent(app)
  const email = `${nom.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2)}@exemple.test`
  const res = await agent.post('/api/auth/sign-up/email').set('Origin', ORIGINE)
    .send({ name: nom, email, password: 'mot-de-passe-solide-1' }).expect(200)
  return {
    id: res.body.user.id,
    get: (chemin) => agent.get(chemin).set('Origin', ORIGINE),
    post: (chemin, corps) => agent.post(chemin).set('Origin', ORIGINE).send(corps),
    put: (chemin, corps) => agent.put(chemin).set('Origin', ORIGINE).send(corps),
  }
}

// Ce que le navigateur gardait dans « linkedai-storage » (state.posts, state.settings).
const POSTS_LOCAUX = [
  { id: 1730370000000, type: 'Projet technique', model: 'deepseek', content: 'Mon pipeline Terraform', createdAt: '2026-10-30T09:00:00.000Z' },
  { id: 1730280000000, type: 'Storytelling', model: 'deepseek', content: 'Ma première mission cloud', createdAt: '2026-10-29T09:00:00.000Z' },
]
const PARAMETRES_LOCAUX = { defaultTone: 'Startup', scraperWebhook: 'https://n8n.exemple.test/webhook/scraper' }

beforeAll(async () => {
  prisma = (await import('../src/lib/prisma.js')).prisma
  await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`)
  execSync('npx prisma migrate deploy', { cwd: resolve(import.meta.dirname, '..'), env: { ...process.env }, stdio: 'pipe' })
  const { creerApp } = await import('../src/app.js')
  ;({ versPostServeur } = await import('../src/compte/routes.js'))
  app = creerApp({ journal: false, limiteConnexion: false })
}, 120_000)

afterAll(async () => { await prisma?.$disconnect() })

describe('versPostServeur — conversion d’un post local', () => {
  it('garde type, modèle, contenu et date ; l’id local devient un texte', () => {
    expect(versPostServeur(POSTS_LOCAUX[0], 'u')).toEqual({
      userId: 'u', idLocal: '1730370000000', type: 'Projet technique', model: 'deepseek',
      content: 'Mon pipeline Terraform', createdAt: new Date('2026-10-30T09:00:00.000Z'),
    })
  })

  it('écarte un post sans contenu ou sans identifiant', () => {
    expect(versPostServeur({ id: 3, content: '   ' }, 'u')).toBeNull()
    expect(versPostServeur({ content: 'Sans id' }, 'u')).toBeNull()
    expect(versPostServeur(null, 'u')).toBeNull()
  })

  it('une date illisible est remplacée par la date d’import', () => {
    expect(versPostServeur({ id: 4, content: 'x', createdAt: 'hier' }, 'u')).not.toHaveProperty('createdAt')
  })
})

describe('paramètres du compte', () => {
  it('renvoie les valeurs par défaut tant que rien n’est enregistré', async () => {
    const A = await compte('Amina')
    const res = await A.get('/api/compte/parametres').expect(200)
    expect(res.body.parametres).toEqual({ defaultTone: 'Professionnel', scraperWebhook: '' })
  })

  it('enregistre, relit, et garde le reste quand un seul champ change', async () => {
    const A = await compte('Amina')
    await A.put('/api/compte/parametres', PARAMETRES_LOCAUX).expect(200)
    await A.put('/api/compte/parametres', { defaultTone: 'Inspirant' }).expect(200)
    const res = await A.get('/api/compte/parametres').expect(200)
    expect(res.body.parametres).toEqual({ defaultTone: 'Inspirant', scraperWebhook: PARAMETRES_LOCAUX.scraperWebhook })
  })

  it('refuse un webhook qui n’est pas une URL http(s) (400), accepte un webhook vide', async () => {
    const A = await compte('Amina')
    const res = await A.put('/api/compte/parametres', { scraperWebhook: 'javascript:alert(1)' }).expect(400)
    expect(res.body.error).toMatch(/URL http ou https/)
    await A.put('/api/compte/parametres', { scraperWebhook: '' }).expect(200)
  })

  it('chaque compte a ses paramètres', async () => {
    const A = await compte('Amina')
    const B = await compte('Bilal')
    await A.put('/api/compte/parametres', { defaultTone: 'Startup' }).expect(200)
    expect((await B.get('/api/compte/parametres')).body.parametres.defaultTone).toBe('Professionnel')
  })
})

describe('POST /api/compte/import-local', () => {
  it('importe les posts et les paramètres du navigateur', async () => {
    const A = await compte('Amina')
    const res = await A.post('/api/compte/import-local', { posts: POSTS_LOCAUX, settings: PARAMETRES_LOCAUX }).expect(200)
    expect(res.body).toEqual({ posts: { importes: 2, dejaLa: 0, ecartes: 0 }, parametres: 'importes' })

    const { posts, total } = (await A.get('/api/posts').expect(200)).body
    expect(total).toBe(2)
    expect(posts.map((p) => p.content)).toEqual(['Mon pipeline Terraform', 'Ma première mission cloud'])
    expect(posts[0]).toMatchObject({ type: 'Projet technique', model: 'deepseek', createdAt: '2026-10-30T09:00:00.000Z' })
    expect((await A.get('/api/compte/parametres')).body.parametres).toEqual(PARAMETRES_LOCAUX)
  })

  it('relancé, n’ajoute aucun doublon', async () => {
    const A = await compte('Amina')
    await A.post('/api/compte/import-local', { posts: POSTS_LOCAUX, settings: PARAMETRES_LOCAUX }).expect(200)
    const deuxieme = await A.post('/api/compte/import-local', { posts: POSTS_LOCAUX, settings: PARAMETRES_LOCAUX }).expect(200)
    expect(deuxieme.body).toEqual({ posts: { importes: 0, dejaLa: 2, ecartes: 0 }, parametres: 'conserves' })
    expect((await A.get('/api/posts')).body.total).toBe(2)
  })

  it('deux imports lancés en même temps n’ajoutent aucun doublon', async () => {
    const A = await compte('Amina')
    const corps = { posts: POSTS_LOCAUX, settings: PARAMETRES_LOCAUX }
    const reponses = await Promise.all([A.post('/api/compte/import-local', corps), A.post('/api/compte/import-local', corps)])
    expect(reponses.map((r) => r.status)).toEqual([200, 200])
    expect((await A.get('/api/posts')).body.total).toBe(2)
  })

  it('n’écrase jamais des paramètres déjà enregistrés sur le compte', async () => {
    const A = await compte('Amina')
    await A.put('/api/compte/parametres', { defaultTone: 'Inspirant' }).expect(200)
    const res = await A.post('/api/compte/import-local', { settings: PARAMETRES_LOCAUX }).expect(200)
    expect(res.body.parametres).toBe('conserves')
    expect((await A.get('/api/compte/parametres')).body.parametres.defaultTone).toBe('Inspirant')
  })

  it('écarte les posts illisibles et des paramètres invalides sans refuser le reste', async () => {
    const A = await compte('Amina')
    const res = await A.post('/api/compte/import-local', {
      posts: [...POSTS_LOCAUX, { id: 9, content: '' }, 'n’importe quoi'],
      settings: { scraperWebhook: 'pas une url' },
    }).expect(200)
    expect(res.body).toEqual({ posts: { importes: 2, dejaLa: 0, ecartes: 2 }, parametres: 'conserves' })
  })

  it('refuse plus de 200 posts d’un coup (400)', async () => {
    const A = await compte('Amina')
    const posts = Array.from({ length: 201 }, (_, i) => ({ id: i + 1, content: `Post ${i}` }))
    await A.post('/api/compte/import-local', { posts }).expect(400)
    expect((await A.get('/api/posts')).body.total).toBe(0)
  })

  it('le même post local importé par deux comptes appartient à chacun', async () => {
    const A = await compte('Amina')
    const B = await compte('Bilal')
    await A.post('/api/compte/import-local', { posts: POSTS_LOCAUX }).expect(200)
    const res = await B.post('/api/compte/import-local', { posts: POSTS_LOCAUX }).expect(200)
    expect(res.body.posts.importes).toBe(2)
  })
})

describe('TS-ISOLATION — posts et paramètres', () => {
  it('un post généré est gardé dans le compte qui l’a généré, et seulement lui', async () => {
    const A = await compte('Amina')
    const B = await compte('Bilal')
    axiosPost.mockResolvedValueOnce({ data: { choices: [{ message: { content: 'Post de A' } }] } })
    const res = await A.post('/api/posts/generate', { type: 'Storytelling', description: 'Projet de A', userId: B.id }).expect(200)
    expect(res.body.enregistre).toMatchObject({ userId: A.id, content: 'Post de A', model: 'deepseek' })

    expect((await A.get('/api/posts')).body.posts.map((p) => p.content)).toEqual(['Post de A'])
    expect((await B.get(`/api/posts?userId=${A.id}`)).body).toEqual({ posts: [], total: 0 })
  })

  it('supprimer un compte supprime ses posts et ses paramètres', async () => {
    const C = await compte('Chaima')
    await C.post('/api/compte/import-local', { posts: POSTS_LOCAUX, settings: PARAMETRES_LOCAUX }).expect(200)
    await prisma.user.delete({ where: { id: C.id } })
    expect(await prisma.post.count({ where: { userId: C.id } })).toBe(0)
    expect(await prisma.parametres.count({ where: { userId: C.id } })).toBe(0)
  })

  it('sans session : 401 sur les posts, les paramètres et l’import', async () => {
    await request(app).get('/api/posts').expect(401)
    await request(app).get('/api/compte/parametres').expect(401)
    await request(app).put('/api/compte/parametres').send({ defaultTone: 'Startup' }).expect(401)
    await request(app).post('/api/compte/import-local').send({ posts: POSTS_LOCAUX }).expect(401)
  })
})
