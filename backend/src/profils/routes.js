/**
 * Routes des profils (lots L1.2 et L1.1). Tout est limité au compte connecté (req.utilisateur).
 * POST   /api/profils/rechercher { requete, lieu?, pages? } → { profils, rejetes, source, secours, nouveaux, dejaLa, rechercheId }
 *        `secours` est vrai quand un fournisseur placé avant `source` a échoué (voir fournisseurs/index.js).
 *        Les profils sont normalisés (normaliser.js) puis enregistrés sur le compte, avec la recherche.
 * POST   /api/profils/lot { profils, requete?, lieu? } → { nouveaux, dejaLa, rejetes }   (webhook n8n réglé à la main)
 * GET    /api/profils?page=&parPage= → { profils, total, page, parPage }               (plus récents d'abord)
 * DELETE /api/profils/:id → 204, ou 404 si le profil n'est pas à ce compte
 * DELETE /api/profils → { supprimes }                                                  (bouton « Vider »)
 */
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { rechercherAvecSecours } from './fournisseurs/index.js'
import { normaliserLot, depuisFormeLocale } from './normaliser.js'
import { enregistrerProfils, listerProfils, PROFILS_PAR_PAGE_MAX } from './service.js'

const router = Router()

const SchemaRecherche = z.object({
  requete: z.string({ required_error: 'La requête est obligatoire', invalid_type_error: 'La requête doit être un texte' }).trim().min(1, 'La requête est obligatoire').max(120, 'La requête est trop longue (120 caractères maximum)'),
  lieu:    z.string({ invalid_type_error: 'Le lieu doit être un texte' }).trim().max(60, 'Le lieu est trop long (60 caractères maximum)').optional().default(''),
  pages:   z.coerce.number().int().min(1, 'Entre 1 et 10 pages').max(10, 'Entre 1 et 10 pages').optional().default(1),
})

router.post('/rechercher', async (req, res) => {
  const parametres = SchemaRecherche.safeParse(req.body ?? {})
  if (!parametres.success) {
    return res.status(400).json({ error: parametres.error.issues[0].message })
  }

  try {
    const { bruts, source, echecs } = await rechercherAvecSecours(parametres.data)
    if (echecs.length) console.warn('[Profils] Secours utilisé :', JSON.stringify(echecs))
    const { profils, rejetes } = normaliserLot(bruts, source)
    const { requete, lieu, pages } = parametres.data
    const userId = req.utilisateur.id
    try {
      const recherche = await prisma.rechercheProfils.create({
        data: { userId, requete, lieu: lieu || null, pages, source, trouves: profils.length, rejetes },
      })
      const { nouveaux, dejaLa } = await enregistrerProfils(userId, profils, { rechercheId: recherche.id })
      return res.json({ profils, rejetes, source, secours: echecs.length > 0, nouveaux, dejaLa, rechercheId: recherche.id })
    } catch (err) {
      console.error('[Profils] Enregistrement impossible :', err.message)
      return res.status(500).json({ error: 'Les profils ont été trouvés mais n’ont pas pu être enregistrés.' })
    }
  } catch (err) {
    console.error('[Profils] Recherche impossible :', JSON.stringify(err.echecs ?? err.message))
    return res.status(502).json({ error: 'La recherche de profils a échoué : aucun fournisseur n’a répondu.' })
  }
})

const MAX_PROFILS_LOT = 500
const SchemaLot = z.object({
  profils: z.array(z.unknown(), { required_error: 'La liste des profils est obligatoire' }).max(MAX_PROFILS_LOT, `${MAX_PROFILS_LOT} profils au plus par lot`),
  requete: z.string().trim().max(120).optional(),
  lieu: z.string().trim().max(60).optional(),
})

// Profils reçus d'un webhook n8n appelé par le navigateur : convertis, validés, puis enregistrés.
router.post('/lot', async (req, res) => {
  const lu = SchemaLot.safeParse(req.body ?? {})
  if (!lu.success) return res.status(400).json({ error: lu.error.issues[0].message })

  const userId = req.utilisateur.id
  const resultats = lu.data.profils.map((p) => depuisFormeLocale(p, 'webhook'))
  const profils = resultats.filter((r) => r.ok).map((r) => r.profil)
  const rejetes = resultats.length - profils.length
  try {
    let rechercheId = null
    if (lu.data.requete) {
      const recherche = await prisma.rechercheProfils.create({
        data: { userId, requete: lu.data.requete, lieu: lu.data.lieu || null, source: 'webhook', trouves: profils.length, rejetes },
      })
      rechercheId = recherche.id
    }
    return res.json({ ...(await enregistrerProfils(userId, profils, { rechercheId })), rejetes })
  } catch (err) {
    console.error('[Profils] Enregistrement d’un lot :', err.message)
    return res.status(500).json({ error: 'Les profils n’ont pas pu être enregistrés.' })
  }
})

const SchemaPage = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  parPage: z.coerce.number().int().min(1).max(PROFILS_PAR_PAGE_MAX).optional().default(50),
})

router.get('/', async (req, res) => {
  const lu = SchemaPage.safeParse(req.query)
  if (!lu.success) return res.status(400).json({ error: `Pagination invalide (page ≥ 1, parPage entre 1 et ${PROFILS_PAR_PAGE_MAX})` })
  try {
    return res.json(await listerProfils(req.utilisateur.id, lu.data))
  } catch (err) {
    console.error('[Profils] Lecture :', err.message)
    return res.status(500).json({ error: 'Erreur lors de la lecture des profils' })
  }
})

// Un profil d'un autre compte répond comme un profil inexistant (404) : rien ne dit qu'il existe.
router.delete('/:id', async (req, res) => {
  try {
    const { count } = await prisma.profil.deleteMany({ where: { id: req.params.id, userId: req.utilisateur.id } })
    return count ? res.status(204).end() : res.status(404).json({ error: 'Profil introuvable' })
  } catch (err) {
    console.error('[Profils] Suppression :', err.message)
    return res.status(500).json({ error: 'Erreur lors de la suppression du profil' })
  }
})

router.delete('/', async (req, res) => {
  try {
    const { count } = await prisma.profil.deleteMany({ where: { userId: req.utilisateur.id } })
    return res.json({ supprimes: count })
  } catch (err) {
    console.error('[Profils] Suppression de tous les profils :', err.message)
    return res.status(500).json({ error: 'Erreur lors de la suppression des profils' })
  }
})

export default router
