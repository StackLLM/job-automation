/**
 * Enregistrement des profils du compte (lots L1.1 et L1.3).
 * Une URL de profil n'est gardée qu'une fois par compte (contrainte unique userId + urlNormalisee).
 * Retrouvé par une recherche, un profil déjà connu est mis à jour selon profils/fusion.js.
 * L'import du navigateur, lui, ne modifie jamais un profil du compte : ses données sont plus anciennes.
 */
import { prisma } from '../lib/prisma.js'
import { fusionner, CHAMPS_FUSIONNES } from './fusion.js'

export const PROFILS_PAR_PAGE_MAX = 200

// Champs renvoyés au front : jamais userId.
export const CHAMPS_PROFIL = {
  id: true, rechercheId: true, urlNormalisee: true, nom: true, poste: true, entreprise: true,
  lieu: true, extrait: true, image: true, source: true, note: true, etiquettes: true, collecteLe: true, createdAt: true,
}

// profils normalisés → { nouveaux, misAJour, inchanges }. Un même lot qui répète une URL ne la compte qu'une fois.
// mettreAJour: false (import du navigateur) : un profil déjà connu est seulement compté dans inchanges.
// Tout est limité au compte userId : la réponse ne dit jamais si un autre compte a déjà ce profil.
export async function enregistrerProfils(userId, profils, { rechercheId = null, mettreAJour = true } = {}) {
  const uniques = [...new Map(profils.map((p) => [p.urlNormalisee, p])).values()]
  if (!uniques.length) return { nouveaux: 0, misAJour: 0, inchanges: 0 }

  const existants = await prisma.profil.findMany({
    where: { userId, urlNormalisee: { in: uniques.map((p) => p.urlNormalisee) } },
    select: { id: true, urlNormalisee: true, ...Object.fromEntries(CHAMPS_FUSIONNES.map((c) => [c, true])) },
  })
  const parUrl = new Map(existants.map((p) => [p.urlNormalisee, p]))
  const aCreer = uniques.filter((p) => !parUrl.has(p.urlNormalisee))

  // Dates décroissantes d'une milliseconde : la liste, triée du plus récent au plus ancien, garde l'ordre du fournisseur.
  const maintenant = Date.now()
  const { count: nouveaux } = await prisma.profil.createMany({
    data: aCreer.map((p, i) => ({ ...p, userId, rechercheId, collecteLe: new Date(maintenant - i), createdAt: new Date(maintenant - i) })),
    skipDuplicates: true, // une recherche lancée en même temps a pu créer la même URL
  })

  let misAJour = 0
  if (mettreAJour && existants.length) {
    const collecteLe = new Date(maintenant)
    const operations = uniques.filter((p) => parUrl.has(p.urlNormalisee)).map((p) => {
      const existant = parUrl.get(p.urlNormalisee)
      const { donnees, change } = fusionner(existant, p)
      if (change) misAJour += 1
      return prisma.profil.updateMany({ where: { id: existant.id, userId }, data: { ...donnees, source: p.source, collecteLe } })
    })
    await prisma.$transaction(operations)
  }

  return { nouveaux, misAJour, inchanges: uniques.length - nouveaux - misAJour }
}

export async function listerProfils(userId, { page, parPage }) {
  const where = { userId }
  const [profils, total] = await Promise.all([
    prisma.profil.findMany({
      where, select: CHAMPS_PROFIL,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: (page - 1) * parPage, take: parPage,
    }),
    prisma.profil.count({ where }),
  ])
  return { profils, total, page, parPage }
}
