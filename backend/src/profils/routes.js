/**
 * Routes des profils (lots L1.2 et L1.1). Tout est limité au compte connecté (req.utilisateur).
 * POST   /api/profils/rechercher { requete, lieu?, pages? } → { profils, rejetes, source, secours, nouveaux, misAJour, inchanges, rechercheId }
 *        `secours` est vrai quand un fournisseur placé avant `source` a échoué (voir fournisseurs/index.js).
 *        Les profils sont normalisés (normaliser.js) puis enregistrés sur le compte, avec la recherche ;
 *        un profil déjà connu est mis à jour (fusion.js, lot L1.3).
 *        Lot L1.6 : 502 { error, cause } avec cause = quota, cle, delai ou indisponible ;
 *        si le navigateur a annulé la recherche entre-temps, rien n'est enregistré.
 * POST   /api/profils/annuler-recherche { idRecherche } → 204                          (lot L1.6, bouton « Annuler »)
 * POST   /api/profils/lot { profils, requete?, lieu? } → { nouveaux, misAJour, inchanges, rejetes }   (webhook n8n réglé à la main)
 * GET    /api/profils?page=&parPage= → { profils, total, page, parPage }               (plus récents d'abord)
 * GET    /api/profils/recherches → { recherches }                                     (les recherches du compte)
 * PATCH  /api/profils/:id { note?, etiquettes? } → { profil }, ou 404                 (lot L1.5)
 * DELETE /api/profils/:id → 204, ou 404 si le profil n'est pas à ce compte
 * POST   /api/profils/supprimer { ids } → { supprimes }                              (une sélection, lot L1.7)
 * DELETE /api/profils → { supprimes }                                                  (bouton « Vider »)
 * Décision D-11 : aucune suppression automatique ; seul l'utilisateur supprime ses profils.
 */
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { rechercherAvecSecours } from './fournisseurs/index.js'
import { normaliserLot, depuisFormeLocale } from './normaliser.js'
import { enregistrerProfils, listerProfils, PROFILS_PAR_PAGE_MAX, CHAMPS_PROFIL } from './service.js'

const router = Router()

const SchemaRecherche = z.object({
  requete: z.string({ required_error: 'La requête est obligatoire', invalid_type_error: 'La requête doit être un texte' }).trim().min(1, 'La requête est obligatoire').max(120, 'La requête est trop longue (120 caractères maximum)'),
  lieu:    z.string({ invalid_type_error: 'Le lieu doit être un texte' }).trim().max(60, 'Le lieu est trop long (60 caractères maximum)').optional().default(''),
  pages:   z.coerce.number().int().min(1, 'Entre 1 et 10 pages').max(10, 'Entre 1 et 10 pages').optional().default(1),
  // Identifiant donné par le navigateur, pour pouvoir annuler cette recherche (lot L1.6).
  idRecherche: z.string().trim().min(1).max(64).optional(),
})

// Recherches annulées (lot L1.6) : « userId:idRecherche » → date. En mémoire, oubliées après 10 minutes.
// Une annulation explicite est nécessaire : derrière un proxy (Vite en local, reverse proxy en ligne),
// le backend ne voit pas toujours le navigateur couper la connexion.
const annulations = new Map()
const DUREE_ANNULATION_MS = 10 * 60_000
const cleAnnulation = (userId, id) => `${userId}:${id}`
const estAnnulee = (userId, id) => Boolean(id) && annulations.has(cleAnnulation(userId, id))
setInterval(() => {
  const limite = Date.now() - DUREE_ANNULATION_MS
  for (const [cle, date] of annulations) if (date < limite) annulations.delete(cle)
}, DUREE_ANNULATION_MS).unref()

// Message de chaque cause d'échec (lot L1.6) ; le front a les siens, plus précis (frontend/src/lib/messagesRecherche.js).
export const MESSAGES_CAUSE = {
  quota: 'Le quota des services de recherche est épuisé.',
  cle: 'La clé d’accès au service de recherche est refusée.',
  delai: 'Le service de recherche a mis trop de temps à répondre.',
  indisponible: 'La recherche de profils a échoué : aucun fournisseur n’a répondu.',
}

router.post('/rechercher', async (req, res) => {
  const parametres = SchemaRecherche.safeParse(req.body ?? {})
  if (!parametres.success) {
    return res.status(400).json({ error: parametres.error.issues[0].message })
  }

  // Annulation (bouton « Annuler ») : la connexion se ferme avant la réponse, ou le navigateur l'a signalée.
  let connexionFermee = false
  res.on('close', () => { if (!res.writableEnded) connexionFermee = true })

  try {
    const { bruts, source, echecs } = await rechercherAvecSecours(parametres.data)
    if (echecs.length) console.warn('[Profils] Secours utilisé :', JSON.stringify(echecs))
    const { profils, rejetes } = normaliserLot(bruts, source)
    const { requete, lieu, pages } = parametres.data
    const userId = req.utilisateur.id
    if (connexionFermee || estAnnulee(userId, parametres.data.idRecherche)) {
      annulations.delete(cleAnnulation(userId, parametres.data.idRecherche))
      console.warn('[Profils] Recherche annulée par le navigateur : rien n’est enregistré.')
      // Connexion encore ouverte (proxy) : une réponse explicite, pour ne pas la laisser pendre.
      return connexionFermee ? undefined : res.status(409).json({ error: 'Recherche annulée : rien n’a été enregistré.', cause: 'annulee' })
    }
    try {
      const recherche = await prisma.rechercheProfils.create({
        data: { userId, requete, lieu: lieu || null, pages, source, trouves: profils.length, rejetes },
      })
      const bilan = await enregistrerProfils(userId, profils, { rechercheId: recherche.id })
      return res.json({ profils, rejetes, source, secours: echecs.length > 0, ...bilan, rechercheId: recherche.id })
    } catch (err) {
      console.error('[Profils] Enregistrement impossible :', err.message)
      return res.status(500).json({ error: 'Les profils ont été trouvés mais n’ont pas pu être enregistrés.' })
    }
  } catch (err) {
    annulations.delete(cleAnnulation(req.utilisateur.id, parametres.data.idRecherche))
    console.error('[Profils] Recherche impossible :', JSON.stringify(err.echecs ?? err.message))
    const cause = err.causeEchec in MESSAGES_CAUSE ? err.causeEchec : 'indisponible'
    return res.status(502).json({ error: MESSAGES_CAUSE[cause], cause })
  }
})

router.post('/annuler-recherche', (req, res) => {
  const lu = z.object({ idRecherche: z.string().trim().min(1).max(64) }).safeParse(req.body ?? {})
  if (!lu.success) return res.status(400).json({ error: 'Identifiant de recherche manquant' })
  annulations.set(cleAnnulation(req.utilisateur.id, lu.data.idRecherche), Date.now())
  return res.status(204).end()
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

// Les recherches du compte, plus récentes d'abord : filtre « recherche d'origine » et historique de la fiche.
router.get('/recherches', async (req, res) => {
  try {
    const recherches = await prisma.rechercheProfils.findMany({
      where: { userId: req.utilisateur.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, requete: true, lieu: true, pages: true, source: true, trouves: true, rejetes: true, createdAt: true },
    })
    return res.json({ recherches })
  } catch (err) {
    console.error('[Profils] Lecture des recherches :', err.message)
    return res.status(500).json({ error: 'Erreur lors de la lecture des recherches' })
  }
})

export const NOTE_MAX = 2000
export const ETIQUETTES_MAX = 10
export const ETIQUETTE_MAX = 30

// Étiquettes : sans espaces en trop, sans doublon (casse ignorée), 10 au plus.
const SchemaModification = z.object({
  note: z.string({ invalid_type_error: 'La note doit être un texte' }).max(NOTE_MAX, `La note est trop longue (${NOTE_MAX} caractères maximum)`)
    .transform((t) => t.trim() || null).nullable(),
  etiquettes: z.array(
    z.string({ invalid_type_error: 'Une étiquette doit être un texte' }).trim()
      .min(1, 'Une étiquette ne peut pas être vide').max(ETIQUETTE_MAX, `Une étiquette fait ${ETIQUETTE_MAX} caractères au plus`),
    { invalid_type_error: 'Les étiquettes doivent être une liste' },
  ).max(ETIQUETTES_MAX, `${ETIQUETTES_MAX} étiquettes au plus`)
    .transform((liste) => [...new Map(liste.map((e) => [e.toLowerCase(), e])).values()]),
}).partial().strict('Seules la note et les étiquettes se modifient')

router.patch('/:id', async (req, res) => {
  const lu = SchemaModification.safeParse(req.body ?? {})
  if (!lu.success) return res.status(400).json({ error: lu.error.issues[0].message })
  try {
    const { count } = await prisma.profil.updateMany({ where: { id: req.params.id, userId: req.utilisateur.id }, data: lu.data })
    if (!count) return res.status(404).json({ error: 'Profil introuvable' })
    const profil = await prisma.profil.findUnique({ where: { id: req.params.id }, select: CHAMPS_PROFIL })
    return res.json({ profil })
  } catch (err) {
    console.error('[Profils] Modification :', err.message)
    return res.status(500).json({ error: 'Erreur lors de l’enregistrement du profil' })
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

// Une sélection : les identifiants d'un autre compte (ou inconnus) sont ignorés, sans erreur ni indice.
export const MAX_SELECTION = 500
const SchemaSelection = z.object({
  ids: z.array(z.string().trim().min(1).max(64), { required_error: 'La liste des profils à supprimer est obligatoire', invalid_type_error: 'La liste des profils à supprimer est obligatoire' })
    .min(1, 'Aucun profil à supprimer').max(MAX_SELECTION, `${MAX_SELECTION} profils au plus par suppression`),
})

router.post('/supprimer', async (req, res) => {
  const lu = SchemaSelection.safeParse(req.body ?? {})
  if (!lu.success) return res.status(400).json({ error: lu.error.issues[0].message })
  try {
    const { count } = await prisma.profil.deleteMany({ where: { userId: req.utilisateur.id, id: { in: [...new Set(lu.data.ids)] } } })
    return res.json({ supprimes: count })
  } catch (err) {
    console.error('[Profils] Suppression d’une sélection :', err.message)
    return res.status(500).json({ error: 'Erreur lors de la suppression des profils' })
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
