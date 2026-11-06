/**
 * Données du compte (lot L0.7) : paramètres, et reprise des données gardées dans le navigateur.
 * GET  /api/compte/parametres → { parametres }            (valeurs par défaut tant que rien n'est enregistré)
 * PUT  /api/compte/parametres { defaultTone?, scraperWebhook? } → { parametres }
 * POST /api/compte/import-local { posts?, settings?, profils? }
 *      → { posts: { importes, dejaLa, ecartes }, parametres, profils: { importes, dejaLa, ecartes } }
 * L'import est idempotent : un post déjà importé (même identifiant local) n'est pas recréé, un profil
 * déjà sur le compte (même URL) non plus (lot L1.1), et des paramètres déjà enregistrés ne sont jamais écrasés.
 */
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { depuisFormeLocale } from '../profils/normaliser.js'
import { enregistrerProfils } from '../profils/service.js'

const router = Router()

export const PARAMETRES_PAR_DEFAUT = { defaultTone: 'Professionnel', scraperWebhook: '' }
export const MAX_POSTS_IMPORT = 200
export const MAX_PROFILS_IMPORT = 500

const SchemaParametres = z.object({
  defaultTone: z.string({ invalid_type_error: 'Le ton doit être un texte' }).trim().min(1, 'Le ton est obligatoire').max(40, 'Le ton est trop long (40 caractères maximum)'),
  scraperWebhook: z.union([
    z.literal(''),
    z.string().trim().max(500, 'L’adresse du webhook est trop longue (500 caractères maximum)')
      .url('L’adresse du webhook doit être une URL http ou https').regex(/^https?:\/\//i, 'L’adresse du webhook doit être une URL http ou https'),
  ], { invalid_type_error: 'L’adresse du webhook doit être un texte' }),
}).partial()

// Un post tel que le navigateur le gardait (store/useAppStore.js) : id = Date.now().
const SchemaPostLocal = z.object({
  id: z.union([z.string(), z.number()]).transform(String).pipe(z.string().min(1).max(64)),
  type: z.string().max(100).nullish(),
  model: z.string().max(100).nullish(),
  content: z.string().trim().min(1).max(10_000),
  createdAt: z.unknown(),
})

const SchemaImport = z.object({
  posts: z.array(z.unknown()).max(MAX_POSTS_IMPORT, `${MAX_POSTS_IMPORT} posts au plus par import`).optional().default([]),
  settings: z.record(z.unknown()).nullish(),
  profils: z.array(z.unknown()).max(MAX_PROFILS_IMPORT, `${MAX_PROFILS_IMPORT} profils au plus par import`).optional().default([]),
})

const lireParametres = async (userId) => {
  const enregistres = await prisma.parametres.findUnique({ where: { userId } })
  return enregistres
    ? { defaultTone: enregistres.defaultTone, scraperWebhook: enregistres.scraperWebhook }
    : { ...PARAMETRES_PAR_DEFAUT }
}

// Post local → ligne de la table Post. Un post illisible (sans contenu) est écarté, pas refusé en bloc.
export const versPostServeur = (brut, userId) => {
  const lu = SchemaPostLocal.safeParse(brut)
  if (!lu.success) return null
  const { id, type, model, content, createdAt } = lu.data
  // Une date illisible ne fait pas écarter le post : il prend la date de l'import.
  const date = typeof createdAt === 'string' || typeof createdAt === 'number' ? new Date(createdAt) : null
  const dateValide = date && !Number.isNaN(date.getTime()) ? date : undefined
  return { userId, idLocal: id, type: type ?? null, model: model ?? null, content, ...(dateValide && { createdAt: dateValide }) }
}

router.get('/parametres', async (req, res) => {
  try {
    return res.json({ parametres: await lireParametres(req.utilisateur.id) })
  } catch (err) {
    console.error('[Compte] Lecture des paramètres :', err.message)
    return res.status(500).json({ error: 'Erreur lors de la lecture des paramètres' })
  }
})

router.put('/parametres', async (req, res) => {
  const lu = SchemaParametres.safeParse(req.body ?? {})
  if (!lu.success) return res.status(400).json({ error: lu.error.issues[0].message })

  try {
    const userId = req.utilisateur.id
    const parametres = await prisma.parametres.upsert({
      where: { userId },
      create: { ...PARAMETRES_PAR_DEFAUT, ...lu.data, userId },
      update: lu.data,
    })
    return res.json({ parametres: { defaultTone: parametres.defaultTone, scraperWebhook: parametres.scraperWebhook } })
  } catch (err) {
    console.error('[Compte] Enregistrement des paramètres :', err.message)
    return res.status(500).json({ error: 'Erreur lors de l’enregistrement des paramètres' })
  }
})

router.post('/import-local', async (req, res) => {
  const lu = SchemaImport.safeParse(req.body ?? {})
  if (!lu.success) return res.status(400).json({ error: lu.error.issues[0].message })

  const userId = req.utilisateur.id
  const lignes = lu.data.posts.map((p) => versPostServeur(p, userId)).filter(Boolean)
  const ecartes = lu.data.posts.length - lignes.length
  const profilsLus = lu.data.profils.map((p) => depuisFormeLocale(p, 'navigateur')).filter((r) => r.ok).map((r) => r.profil)

  // Des paramètres locaux invalides (ancienne valeur, webhook mal saisi) sont ignorés, pas bloquants.
  const parametresLocaux = lu.data.settings ? SchemaParametres.safeParse(lu.data.settings) : null

  try {
    const { count } = await prisma.post.createMany({ data: lignes, skipDuplicates: true })

    let parametres = 'conserves'
    if (parametresLocaux?.success && Object.keys(parametresLocaux.data).length) {
      // skipDuplicates : des paramètres déjà sur le compte restent tels quels, même si deux imports se croisent.
      const cree = await prisma.parametres.createMany({
        data: [{ ...PARAMETRES_PAR_DEFAUT, ...parametresLocaux.data, userId }],
        skipDuplicates: true,
      })
      if (cree.count) parametres = 'importes'
    }

    const profils = await enregistrerProfils(userId, profilsLus, { mettreAJour: false })

    return res.json({
      posts: { importes: count, dejaLa: lignes.length - count, ecartes },
      parametres,
      profils: { importes: profils.nouveaux, dejaLa: profils.inchanges, ecartes: lu.data.profils.length - profilsLus.length },
    })
  } catch (err) {
    console.error('[Compte] Import local :', err.message)
    return res.status(500).json({ error: 'L’import des données du navigateur a échoué. Rien n’a été effacé.' })
  }
})

export default router
