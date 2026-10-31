/** Génération des posts (routes/posts.js), avec OpenRouter et Prisma simulés. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { gardeTest, UTILISATEUR_TEST } from './aides.js'

const { axiosPost, creerLog, creerPost } = vi.hoisted(() => ({ axiosPost: vi.fn(), creerLog: vi.fn(), creerPost: vi.fn() }))

vi.mock('axios', () => ({ default: { post: axiosPost } }))
vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    generatedPostLog: { create: creerLog, findMany: vi.fn() },
    post: { create: creerPost },
    $transaction: (operations) => Promise.all(operations),
  },
}))

const { creerApp } = await import('../src/app.js')
const app = creerApp({ journal: false, garde: gardeTest })

const reponseOpenRouter = (contenu) => ({ data: { choices: [{ message: { content: contenu } }] } })

describe('POST /api/posts/generate', () => {
  beforeEach(() => {
    axiosPost.mockReset()
    creerLog.mockReset()
    creerLog.mockImplementation(async ({ data }) => ({ id: 'log-1', ...data }))
    creerPost.mockReset()
    creerPost.mockImplementation(async ({ data }) => ({ id: 'post-1', createdAt: '2026-10-31T10:00:00.000Z', ...data }))
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('renvoie le post et l’enregistre en base', async () => {
    axiosPost.mockResolvedValue(reponseOpenRouter('Mon post LinkedIn'))

    const res = await request(app)
      .post('/api/posts/generate')
      .send({ type: 'Projet technique', description: 'Un pipeline n8n', tech: 'n8n, React', tone: 'Professionnel' })
      .expect(200)

    expect(res.body).toMatchObject({ success: true, post: 'Mon post LinkedIn' })
    expect(axiosPost).toHaveBeenCalledOnce()
    const [, corps, options] = axiosPost.mock.calls[0]
    expect(corps.model).toBe('deepseek/deepseek-chat')
    expect(corps.messages[0].content).toContain('Un pipeline n8n')
    expect(options.headers.Authorization).toBe('Bearer cle-de-test')
    expect(creerLog).toHaveBeenCalledOnce()
    expect(creerLog.mock.calls[0][0].data).toMatchObject({
      userId: UTILISATEUR_TEST.id,
      description: 'Un pipeline n8n',
      technologies: 'n8n, React',
      model: 'deepseek/deepseek-chat',
      generatedContent: 'Mon post LinkedIn',
    })
  })

  it('garde le post dans l’historique du compte (lot L0.7)', async () => {
    axiosPost.mockResolvedValue(reponseOpenRouter('Mon post LinkedIn'))
    const res = await request(app).post('/api/posts/generate')
      .send({ type: 'Storytelling', description: 'Un récit', userId: 'quelqu-un-d-autre' }).expect(200)

    expect(creerPost).toHaveBeenCalledOnce()
    expect(creerPost.mock.calls[0][0].data).toEqual({
      userId: UTILISATEUR_TEST.id, type: 'Storytelling', model: 'deepseek', content: 'Mon post LinkedIn',
    })
    expect(res.body.enregistre).toMatchObject({ id: 'post-1', content: 'Mon post LinkedIn' })
  })

  it('ignore un userId envoyé dans le corps : le propriétaire vient de la session', async () => {
    axiosPost.mockResolvedValue(reponseOpenRouter('Post'))
    await request(app).post('/api/posts/generate').send({ description: 'Un post', userId: 'quelqu-un-d-autre' }).expect(200)
    expect(creerLog.mock.calls[0][0].data.userId).toBe(UTILISATEUR_TEST.id)
  })

  it('refuse une description vide (400) sans appeler OpenRouter', async () => {
    const res = await request(app).post('/api/posts/generate').send({ description: '   ' }).expect(400)
    expect(res.body.error).toMatch(/obligatoire/)
    expect(axiosPost).not.toHaveBeenCalled()
  })

  it('refuse une description de plus de 2 000 caractères (400)', async () => {
    const res = await request(app).post('/api/posts/generate').send({ description: 'a'.repeat(2001) }).expect(400)
    expect(res.body.error).toMatch(/trop longue/)
    expect(axiosPost).not.toHaveBeenCalled()
  })

  it('renvoie 502 avec le message d’OpenRouter quand l’appel échoue', async () => {
    axiosPost.mockRejectedValue(Object.assign(new Error('échec'), {
      response: { data: { error: { message: 'Modèle indisponible' } } },
    }))

    const res = await request(app).post('/api/posts/generate').send({ description: 'Un post' }).expect(502)
    expect(res.body.error).toBe('Erreur OpenRouter : Modèle indisponible')
    expect(creerLog).not.toHaveBeenCalled()
  })

  it('renvoie 502 quand OpenRouter répond sans contenu', async () => {
    axiosPost.mockResolvedValue({ data: { choices: [] } })
    await request(app).post('/api/posts/generate').send({ description: 'Un post' }).expect(502)
    expect(creerLog).not.toHaveBeenCalled()
  })
})

describe('autres routes', () => {
  beforeEach(() => axiosPost.mockReset())

  it('GET /api/health répond ok', async () => {
    const res = await request(app).get('/api/health').expect(200)
    expect(res.body).toEqual({ status: 'ok', version: '0.1.0' })
  })

  it('POST /api/n8n/inconnu est refusé (404) sans appeler n8n', async () => {
    await request(app).post('/api/n8n/inconnu').send({}).expect(404)
    expect(axiosPost).not.toHaveBeenCalled()
  })
})
