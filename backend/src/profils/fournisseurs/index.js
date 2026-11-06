/**
 * Fournisseurs de profils, dans l'ordre où le backend les essaie (décisions D-01 et D-06) :
 * 1. Serper (résultats Google) et 2. Brave, chacun seulement si sa clé est réglée dans backend/.env ;
 * 3. n8n (Google Custom Search), toujours en dernier secours.
 * Comparatif des fournisseurs : docs/sources.md.
 */
import { serper } from './serper.js'
import { brave } from './brave.js'
import { n8n } from './n8n.js'
import { ErreurFournisseur, causeCommune } from './erreurs.js'

export const TOUS = [serper, brave, n8n]

// Fournisseurs à essayer maintenant : ceux sans clé sont sautés ; n8n n'en demande pas.
export const fournisseursActifs = () => TOUS.filter((f) => !f.actif || f.actif())

// Essaie chaque fournisseur jusqu'au premier qui répond.
// Renvoie { bruts, source, echecs } ; lève une ErreurFournisseur « tous » si aucun ne répond.
export async function rechercherAvecSecours(parametres, fournisseurs = fournisseursActifs()) {
  const echecs = []
  for (const fournisseur of fournisseurs) {
    try {
      const bruts = await fournisseur.rechercher(parametres)
      return { bruts, source: fournisseur.nom, echecs }
    } catch (err) {
      echecs.push({ fournisseur: fournisseur.nom, code: err.code || 'erreur', message: err.message })
    }
  }
  const erreur = new ErreurFournisseur('tous', 'indisponible', 'aucun fournisseur de profils n’a répondu')
  erreur.echecs = echecs
  erreur.causeEchec = causeCommune(echecs)
  throw erreur
}
