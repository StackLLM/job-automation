/** Erreur d'un fournisseur de profils : son nom, un code court (injoignable, delai, statut, illisible, cle, quota) et un message. */
export class ErreurFournisseur extends Error {
  constructor(fournisseur, code, message) {
    super(message)
    this.name = 'ErreurFournisseur'
    this.fournisseur = fournisseur
    this.code = code
  }
}

// Délai dépassé (axios) : à distinguer d'un service injoignable, le message à l'utilisateur n'est pas le même.
export const estUnDelai = (err) => err?.code === 'ECONNABORTED' || err?.code === 'ETIMEDOUT' || /timeout/i.test(err?.message || '')

// Cause d'un échec de tous les fournisseurs (lot L1.6), pour un message clair à l'écran :
// la cause commune à tous les échecs, sinon « indisponible ».
const CAUSES = { quota: 'quota', cle: 'cle', delai: 'delai' }
export function causeCommune(echecs) {
  const causes = new Set(echecs.map((e) => CAUSES[e.code] || 'indisponible'))
  return causes.size === 1 ? [...causes][0] : 'indisponible'
}
