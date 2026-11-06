/**
 * Messages d'erreur de la recherche de profils (lot L1.6) : une phrase claire par situation,
 * jamais de texte technique brut. L'erreur vient de services/api.js (status, causeEchec, code, annulee)
 * ou d'axios pour le webhook n8n appelé directement (response.status, code).
 */

export const MESSAGES = {
  annulee: 'Recherche annulée : rien n’a été enregistré.',
  delai: 'La recherche a dépassé deux minutes et a été arrêtée. Essaie avec moins de pages.',
  reseau: 'Impossible de joindre le serveur. Vérifie ta connexion internet, puis réessaie.',
  session: 'Ta session a expiré : reconnecte-toi pour relancer la recherche.',
  refus: 'Le serveur a refusé la demande : cette page n’est pas autorisée à l’appeler.',
  tropDeRecherches: 'Trop de recherches en une minute. Attends un peu avant de relancer.',
  quota: 'Le quota des services de recherche est épuisé. Réessaie plus tard.',
  cle: 'Le service de recherche refuse sa clé d’accès : elle est à vérifier dans la configuration du serveur.',
  sourceLente: 'Le service de recherche a mis trop de temps à répondre. Réessaie dans quelques minutes.',
  sourceIndisponible: 'Aucune source de profils n’a répondu. Réessaie dans quelques minutes.',
  serveur: 'Le serveur a rencontré un problème. Réessaie ; si cela continue, préviens l’administrateur.',
  inconnu: 'La recherche a échoué. Réessaie dans un instant.',
  webhookInjoignable: 'Ton webhook n8n est injoignable, ou il refuse cette application. Vérifie son adresse dans Paramètres.',
}

const CAUSES_502 = { quota: MESSAGES.quota, cle: MESSAGES.cle, delai: MESSAGES.sourceLente }
const estAnnulee = (err) => err?.annulee || err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError'
const estUnDelai = (err) => err?.code === 'ECONNABORTED' || err?.code === 'ETIMEDOUT'

// Erreur du backend (recherche, enregistrement d'un lot) → { message, annulee }.
export function messageErreurRecherche(err) {
  if (estAnnulee(err)) return { message: MESSAGES.annulee, annulee: true }
  if (estUnDelai(err)) return { message: MESSAGES.delai }
  const status = err?.status ?? err?.response?.status
  if (!status) return { message: MESSAGES.reseau }
  // 400 : le backend dit déjà en français ce qui ne va pas dans le formulaire.
  if (status === 400 && err.message) return { message: err.message }
  if (status === 409 && err.causeEchec === 'annulee') return { message: MESSAGES.annulee, annulee: true }
  if (status === 401) return { message: MESSAGES.session }
  if (status === 403) return { message: MESSAGES.refus }
  if (status === 429) return { message: MESSAGES.tropDeRecherches }
  if (status === 502) return { message: CAUSES_502[err.causeEchec] || MESSAGES.sourceIndisponible }
  if (status >= 500) return { message: MESSAGES.serveur }
  return { message: MESSAGES.inconnu }
}

// Erreur du webhook n8n réglé à la main, appelé directement par le navigateur.
export function messageErreurWebhook(err) {
  if (estAnnulee(err)) return { message: MESSAGES.annulee, annulee: true }
  if (estUnDelai(err)) return { message: MESSAGES.delai }
  const status = err?.response?.status
  if (status) return { message: `Ton webhook n8n a répondu par une erreur (code ${status}). Vérifie son adresse dans Paramètres.` }
  return { message: MESSAGES.webhookInjoignable }
}

// « 1 page », « jusqu'à 5 pages » : ce que la recherche demande, pour l'écran d'attente.
export const pagesDemandees = (n) => (Number(n) > 1 ? `jusqu’à ${n} pages` : '1 page')
