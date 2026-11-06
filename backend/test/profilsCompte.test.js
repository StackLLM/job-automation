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
    patch: (chemin, corps) => agent.patch(chemin).set('Origin', ORIGINE).send(corps),
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
// Réponse n8n faite de profils donnés ({ name, title, link, snippet… }).
const reponseN8nDe = (profils) => ({ status: 200, data: JSON.stringify({ profiles: profils }) })
const rechercherDe = (qui, profils) => {
  axiosPost.mockResolvedValueOnce(reponseN8nDe(profils))
  return qui.post('/api/profils/rechercher', { requete: 'ingenieur cloud', pages: 1 })
}
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
      expect(res.body).toMatchObject({ nouveaux: 100, misAJour: 0, inchanges: 0, rejetes: 0, source: 'n8n' })
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
    expect(res.body).toMatchObject({ nouveaux: 0, misAJour: 0, inchanges: 5 })
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

describe('L1.3 — un profil retrouvé est mis à jour, sans doublon', () => {
  // Comme le workflow n8n : le nom est déjà coupé du titre Google.
  const AMINA = { name: 'Amina Test', title: 'Ingénieure Cloud at Exemple SA | LinkedIn', link: 'https://www.linkedin.com/in/amina-test', snippet: 'Cloud, Kubernetes', image: null }

  it('relancer la même recherche : 0 nouveau, 0 mis à jour, tout inchangé', async () => {
    const A = await compte('Amina')
    await rechercherDe(A, [AMINA]).expect(200)
    const res = await rechercherDe(A, [AMINA]).expect(200)
    expect(res.body).toMatchObject({ nouveaux: 0, misAJour: 0, inchanges: 1 })
  })

  it('un poste et un extrait nouveaux remplacent les anciens ; la date de collecte avance, pas la date d’ajout', async () => {
    const A = await compte('Amina')
    await rechercherDe(A, [AMINA]).expect(200)
    const [avant] = (await tousLesProfils(A)).profils
    const res = await rechercherDe(A, [{ ...AMINA, title: 'Architecte Cloud at Exemple SA | LinkedIn', snippet: 'Architecte, AWS' }]).expect(200)
    expect(res.body).toMatchObject({ nouveaux: 0, misAJour: 1, inchanges: 0 })

    const { profils, total } = await tousLesProfils(A)
    expect(total).toBe(1)
    expect(profils[0]).toMatchObject({ id: avant.id, poste: 'Architecte Cloud', entreprise: 'Exemple SA', extrait: 'Architecte, AWS', createdAt: avant.createdAt, rechercheId: avant.rechercheId })
    expect(new Date(profils[0].collecteLe).getTime()).toBeGreaterThan(new Date(avant.collecteLe).getTime())
  })

  it('une valeur absente n’efface jamais une valeur connue', async () => {
    const A = await compte('Amina')
    await rechercherDe(A, [AMINA]).expect(200)
    const res = await rechercherDe(A, [{ ...AMINA, snippet: null }]).expect(200)
    expect(res.body).toMatchObject({ misAJour: 0, inchanges: 1 })
    expect((await tousLesProfils(A)).profils[0].extrait).toBe('Cloud, Kubernetes')
  })

  it('deux lots qui se chevauchent : le nombre de lignes est exact', async () => {
    const A = await compte('Amina')
    await rechercher(A, 6, 0).expect(200)
    const res = await rechercher(A, 6, 3).expect(200)
    expect(res.body).toMatchObject({ nouveaux: 3, misAJour: 0, inchanges: 3 })
    expect((await tousLesProfils(A)).total).toBe(9)
  })

  it('deux recherches simultanées sur les mêmes profils : aucun doublon', async () => {
    const A = await compte('Amina')
    axiosPost.mockResolvedValueOnce(reponseN8n(5)).mockResolvedValueOnce(reponseN8n(5))
    const corps = { requete: 'ingenieur cloud', pages: 1 }
    const reponses = await Promise.all([A.post('/api/profils/rechercher', corps), A.post('/api/profils/rechercher', corps)])
    expect(reponses.map((r) => r.status)).toEqual([200, 200])
    expect((await tousLesProfils(A)).total).toBe(5)
  })

  it('l’import du navigateur ne modifie jamais un profil du compte', async () => {
    const A = await compte('Amina')
    await rechercherDe(A, [AMINA]).expect(200)
    const res = await A.post('/api/compte/import-local', { profils: [{ name: 'Amina Test', title: 'Ancien poste', link: AMINA.link, snippet: 'Ancien extrait' }] }).expect(200)
    expect(res.body.profils).toEqual({ importes: 0, dejaLa: 1, ecartes: 0 })
    expect((await tousLesProfils(A)).profils[0]).toMatchObject({ poste: 'Ingénieure Cloud', extrait: 'Cloud, Kubernetes' })
  })

  it('TS-ISOLATION : la mise à jour chez B ne touche pas le profil de A, et la réponse à B n’en dit rien', async () => {
    const A = await compte('Amina')
    const B = await compte('Bilal')
    await rechercherDe(A, [AMINA]).expect(200)
    const res = await rechercherDe(B, [{ ...AMINA, snippet: 'Version de B' }]).expect(200)
    expect(res.body).toMatchObject({ nouveaux: 1, misAJour: 0, inchanges: 0 })
    expect((await tousLesProfils(A)).profils[0].extrait).toBe('Cloud, Kubernetes')
  })
})

describe('L1.5 — note, étiquettes et recherches', () => {
  it('PATCH note et étiquettes → relu identique', async () => {
    const A = await compte('Amina')
    await rechercher(A, 1).expect(200)
    const [p] = (await tousLesProfils(A)).profils
    expect(p).toMatchObject({ note: null, etiquettes: [] })
    const res = await A.patch(`/api/profils/${p.id}`, { note: '  Relancer en janvier  ', etiquettes: [' cloud ', 'Recruteur', 'CLOUD'] }).expect(200)
    expect(res.body.profil).toMatchObject({ id: p.id, note: 'Relancer en janvier', etiquettes: ['CLOUD', 'Recruteur'] })
    expect((await tousLesProfils(A)).profils[0]).toMatchObject({ note: 'Relancer en janvier', etiquettes: ['CLOUD', 'Recruteur'] })
  })

  it('une note vide redevient null ; les étiquettes se vident', async () => {
    const A = await compte('Amina')
    await rechercher(A, 1).expect(200)
    const [p] = (await tousLesProfils(A)).profils
    await A.patch(`/api/profils/${p.id}`, { note: 'x', etiquettes: ['a'] }).expect(200)
    const res = await A.patch(`/api/profils/${p.id}`, { note: '   ', etiquettes: [] }).expect(200)
    expect(res.body.profil).toMatchObject({ note: null, etiquettes: [] })
  })

  it.each([
    [{ note: 'x'.repeat(2001) }, /trop longue/],
    [{ etiquettes: Array.from({ length: 11 }, (_, i) => `e${i}`) }, /10 étiquettes au plus/],
    [{ etiquettes: ['x'.repeat(31)] }, /30 caractères au plus/],
    [{ etiquettes: ['  '] }, /vide/],
    [{ poste: 'Autre' }, /Seules la note et les étiquettes/],
  ])('refuse %j (400)', async (corps, message) => {
    const A = await compte('Amina')
    await rechercher(A, 1).expect(200)
    const [p] = (await tousLesProfils(A)).profils
    const res = await A.patch(`/api/profils/${p.id}`, corps).expect(400)
    expect(res.body.error).toMatch(message)
  })

  it('une nouvelle collecte ne touche jamais la note ni les étiquettes', async () => {
    const A = await compte('Amina')
    await rechercher(A, 1).expect(200)
    const [p] = (await tousLesProfils(A)).profils
    await A.patch(`/api/profils/${p.id}`, { note: 'Ma note', etiquettes: ['suivi'] }).expect(200)
    axiosPost.mockResolvedValueOnce({ status: 200, data: JSON.stringify({ profiles: [{ name: 'Personne 0', title: 'Architecte at Autre | LinkedIn', link: 'https://www.linkedin.com/in/personne-0', snippet: 'Nouveau' }] }) })
    expect((await A.post('/api/profils/rechercher', { requete: 'x' }).expect(200)).body.misAJour).toBe(1)
    expect((await tousLesProfils(A)).profils[0]).toMatchObject({ poste: 'Architecte', note: 'Ma note', etiquettes: ['suivi'] })
  })

  it('GET /recherches : les recherches du compte, plus récentes d’abord', async () => {
    const A = await compte('Amina')
    await rechercher(A, 1, 0, 'premiere').expect(200)
    await rechercher(A, 1, 1, 'seconde').expect(200)
    const { recherches } = (await A.get('/api/profils/recherches').expect(200)).body
    expect(recherches.map((r) => r.requete)).toEqual(['seconde', 'premiere'])
    expect(recherches[0]).toMatchObject({ lieu: 'maroc', source: 'n8n', trouves: 1, rejetes: 0 })
    expect(recherches[0]).not.toHaveProperty('userId')
  })

  it('TS-ISOLATION : B ne modifie pas un profil de A (404) et ne voit pas ses recherches', async () => {
    const A = await compte('Amina')
    const B = await compte('Bilal')
    await rechercher(A, 1).expect(200)
    const [p] = (await tousLesProfils(A)).profils
    await B.patch(`/api/profils/${p.id}`, { note: 'intrusion' }).expect(404)
    expect((await tousLesProfils(A)).profils[0].note).toBeNull()
    expect((await B.get('/api/profils/recherches').expect(200)).body.recherches).toEqual([])
    await request(app).patch(`/api/profils/${p.id}`).send({ note: 'x' }).expect(401)
  })
})

describe('L1.6 — recherche annulée par le navigateur', () => {
  it('le navigateur coupe la requête avant la réponse de n8n : rien n’est enregistré', async () => {
    const A = await compte('Amina')
    let repondre
    axiosPost.mockImplementationOnce(() => new Promise((r) => { repondre = r }))
    const annulation = A.post('/api/profils/rechercher', { requete: 'lente' }).timeout(200)
    await expect(annulation).rejects.toThrow(/Timeout/)
    // Comme en vrai : n8n répond un peu après l'annulation, le serveur a vu la connexion se fermer.
    await new Promise((r) => setTimeout(r, 100))
    repondre(reponseN8n(3))
    await new Promise((r) => setTimeout(r, 300))
    expect((await tousLesProfils(A)).total).toBe(0)
    expect((await A.get('/api/profils/recherches')).body.recherches).toEqual([])
  })
})

describe('L1.6 — annulation explicite (derrière un proxy, la coupure n’arrive pas au backend)', () => {
  it('annuler-recherche avant la réponse de n8n : 409, rien n’est enregistré', async () => {
    const A = await compte('Amina')
    let repondre
    axiosPost.mockImplementationOnce(() => new Promise((r) => { repondre = r }))
    const recherche = A.post('/api/profils/rechercher', { requete: 'lente', idRecherche: 'r-123' }).then((r) => r)
    await new Promise((r) => setTimeout(r, 100))
    await A.post('/api/profils/annuler-recherche', { idRecherche: 'r-123' }).expect(204)
    repondre(reponseN8n(3))
    const res = await recherche
    expect(res.status).toBe(409)
    expect(res.body).toEqual({ error: 'Recherche annulée : rien n’a été enregistré.', cause: 'annulee' })
    expect((await tousLesProfils(A)).total).toBe(0)
  })

  it('l’annulation d’un autre compte, ou d’une autre recherche, n’a aucun effet', async () => {
    const A = await compte('Amina')
    const B = await compte('Bilal')
    let repondre
    axiosPost.mockImplementationOnce(() => new Promise((r) => { repondre = r }))
    const recherche = A.post('/api/profils/rechercher', { requete: 'x', idRecherche: 'r-a' }).then((r) => r)
    await new Promise((r) => setTimeout(r, 100))
    await B.post('/api/profils/annuler-recherche', { idRecherche: 'r-a' }).expect(204)
    await A.post('/api/profils/annuler-recherche', { idRecherche: 'r-autre' }).expect(204)
    repondre(reponseN8n(2))
    expect((await recherche).status).toBe(200)
    expect((await tousLesProfils(A)).total).toBe(2)
  })

  it('refuse une annulation sans identifiant (400)', async () => {
    const A = await compte('Amina')
    await A.post('/api/profils/annuler-recherche', {}).expect(400)
  })
})

describe('L1.7 — suppression par l’utilisateur', () => {
  it('une sélection : seuls ces profils disparaissent, comptés exactement', async () => {
    const A = await compte('Amina')
    await rechercher(A, 5).expect(200)
    const { profils } = await tousLesProfils(A)
    const ids = profils.slice(0, 3).map((p) => p.id)
    const res = await A.post('/api/profils/supprimer', { ids: [...ids, ids[0]] }).expect(200)
    expect(res.body).toEqual({ supprimes: 3 })
    const restants = (await tousLesProfils(A)).profils.map((p) => p.id)
    expect(restants).toHaveLength(2)
    expect(restants.some((id) => ids.includes(id))).toBe(false)
  })

  it('un, une sélection, puis tout : comptes exacts en base', async () => {
    const A = await compte('Amina')
    await rechercher(A, 6).expect(200)
    const ids = (await tousLesProfils(A)).profils.map((p) => p.id)
    await A.delete(`/api/profils/${ids[0]}`).expect(204)
    expect((await A.post('/api/profils/supprimer', { ids: ids.slice(1, 3) }).expect(200)).body.supprimes).toBe(2)
    expect((await A.delete('/api/profils').expect(200)).body.supprimes).toBe(3)
    expect(await prisma.profil.count({ where: { userId: A.id } })).toBe(0)
  })

  it('TS-ISOLATION : un identifiant d’un autre compte dans la sélection est ignoré', async () => {
    const A = await compte('Amina')
    const B = await compte('Bilal')
    await rechercher(A, 2).expect(200)
    await rechercher(B, 2, 10).expect(200)
    const deA = (await tousLesProfils(A)).profils.map((p) => p.id)
    const deB = (await tousLesProfils(B)).profils.map((p) => p.id)
    const res = await B.post('/api/profils/supprimer', { ids: [deB[0], ...deA, 'inconnu'] }).expect(200)
    expect(res.body).toEqual({ supprimes: 1 })
    expect((await tousLesProfils(A)).total).toBe(2)
  })

  it.each([
    [{}, /obligatoire/],
    [{ ids: [] }, /Aucun profil/],
    [{ ids: Array.from({ length: 501 }, (_, i) => `id-${i}`) }, /500 profils au plus/],
  ])('refuse %j (400)', async (corps, message) => {
    const A = await compte('Amina')
    expect((await A.post('/api/profils/supprimer', corps).expect(400)).body.error).toMatch(message)
  })

  it('une recherche gardée ne supprime aucun profil plus tard (D-11 : rien d’automatique)', async () => {
    const A = await compte('Amina')
    await rechercher(A, 3).expect(200)
    await rechercher(A, 2, 3).expect(200)
    expect((await tousLesProfils(A)).total).toBe(5)
  })

  it('sans session : 401', async () => {
    await request(app).post('/api/profils/supprimer').send({ ids: ['x'] }).expect(401)
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
    expect(res.body).toEqual({ nouveaux: 1, misAJour: 0, inchanges: 0, rejetes: 1 })
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
    expect(res.body).toMatchObject({ nouveaux: 3, misAJour: 0, inchanges: 0 })
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
