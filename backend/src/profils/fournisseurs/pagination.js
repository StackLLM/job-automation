/**
 * Outils communs aux fournisseurs payants (Serper, Brave) : requête de profils LinkedIn,
 * lecture des erreurs HTTP, et boucle page par page qui s'arrête dès qu'une page revient vide.
 */
import { ErreurFournisseur, estUnDelai } from './erreurs.js'

// « ingenieur cloud » + « maroc » → « ingenieur cloud maroc site:linkedin.com/in »
export const requeteLinkedIn = ({ requete, lieu }) =>
  `${requete} ${lieu || ''} site:linkedin.com/in`.replace(/\s+/g, ' ').trim()

// Brave refuse une clé invalide par un 422 { error: { code: 'SUBSCRIPTION_TOKEN_INVALID', meta: { component: 'authentication' } } }
// (constaté en recette de Phase 1, le 06/11/2026), et non par 401 ou 403.
const refusAuthentification = (corps) => {
  const erreur = corps?.error
  return erreur?.meta?.component === 'authentication' || /TOKEN_INVALID|API_KEY_INVALID/.test(erreur?.code || '')
}

// Erreur HTTP d'un fournisseur → code court : cle (refusée), quota (dépassé), statut (autre).
export function erreurHttp(fournisseur, err) {
  const statut = err.response?.status
  if (!statut) return new ErreurFournisseur(fournisseur, estUnDelai(err) ? 'delai' : 'injoignable', err.message)
  if (statut === 401 || statut === 403 || refusAuthentification(err.response.data)) return new ErreurFournisseur(fournisseur, 'cle', `clé refusée (${statut})`)
  if (statut === 429 || statut === 402) return new ErreurFournisseur(fournisseur, 'quota', `quota ou crédit épuisé (${statut})`)
  return new ErreurFournisseur(fournisseur, 'statut', `réponse ${statut}`)
}

// Appelle lirePage(0), lirePage(1)… jusqu'à `pages` pages ou une page vide.
// Note le nombre de pages réellement appelées, pour suivre le budget du fournisseur.
export async function parPages(fournisseur, pages, lirePage) {
  const tous = []
  let appelees = 0
  for (let i = 0; i < pages; i++) {
    const { resultats, encore } = await lirePage(i)
    appelees += 1
    tous.push(...resultats)
    if (!resultats.length || encore === false) break
  }
  console.info(`[Profils] ${fournisseur} : ${appelees} page(s) appelée(s), ${tous.length} résultat(s)`)
  return tous
}
