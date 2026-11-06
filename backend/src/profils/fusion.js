/**
 * Règles de fusion d'un profil déjà connu, retrouvé par une nouvelle recherche (lot L1.3).
 * - Une valeur nouvelle et non vide remplace l'ancienne : le profil suit ce que la source dit aujourd'hui.
 * - Une valeur vide n'efface jamais une valeur connue : un extrait absent ne fait pas perdre le précédent.
 * - La source et la date de collecte suivent toujours la dernière collecte, sans compter comme un changement.
 * - Les données de l'utilisateur (note, étiquettes, lot L1.5) ne sont jamais dans ces champs : jamais écrasées.
 */

export const CHAMPS_FUSIONNES = ['nom', 'poste', 'entreprise', 'lieu', 'extrait', 'image']

// → { donnees : champs qui changent, change : au moins un champ a changé }
export function fusionner(existant, nouveau) {
  const donnees = {}
  for (const champ of CHAMPS_FUSIONNES) {
    const valeur = nouveau[champ]
    if (valeur != null && valeur !== existant[champ]) donnees[champ] = valeur
  }
  return { donnees, change: Object.keys(donnees).length > 0 }
}
