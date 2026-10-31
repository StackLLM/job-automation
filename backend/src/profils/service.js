/**
 * Enregistrement des profils du compte (lot L1.1).
 * Une URL de profil n'est gardée qu'une fois par compte (contrainte unique userId + urlNormalisee) :
 * un profil déjà connu n'est ni recréé ni modifié. Sa mise à jour viendra avec le lot L1.3.
 */
import { prisma } from '../lib/prisma.js'

export const PROFILS_PAR_PAGE_MAX = 200

// Champs renvoyés au front : jamais userId.
export const CHAMPS_PROFIL = {
  id: true, rechercheId: true, urlNormalisee: true, nom: true, poste: true, entreprise: true,
  lieu: true, extrait: true, image: true, source: true, createdAt: true,
}

// profils normalisés → { nouveaux, dejaLa }. Un même lot qui répète une URL ne la compte qu'une fois.
export async function enregistrerProfils(userId, profils, { rechercheId = null } = {}) {
  const uniques = [...new Map(profils.map((p) => [p.urlNormalisee, p])).values()]
  if (!uniques.length) return { nouveaux: 0, dejaLa: 0 }
  // Dates décroissantes d'une milliseconde : la liste, triée du plus récent au plus ancien, garde l'ordre du fournisseur.
  const maintenant = Date.now()
  const { count } = await prisma.profil.createMany({
    data: uniques.map((p, i) => ({ ...p, userId, rechercheId, createdAt: new Date(maintenant - i) })),
    skipDuplicates: true,
  })
  return { nouveaux: count, dejaLa: uniques.length - count }
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
