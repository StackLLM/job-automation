/**
 * Bilan d'une recherche de profils (lot L1.3), tel que le renvoie le backend :
 * { nouveaux, misAJour, inchanges, rejetes } → « 3 nouveaux, 2 mis à jour, 5 déjà à jour, 1 rejeté ».
 * Seuls les nombres non nuls sont cités ; rejeté = résultat sans lien de profil valide.
 */
const accorder = (n, singulier, pluriel) => `${n} ${n > 1 ? pluriel : singulier}`

export function bilanRecherche({ nouveaux = 0, misAJour = 0, inchanges = 0, rejetes = 0 }) {
  const morceaux = []
  if (nouveaux) morceaux.push(accorder(nouveaux, 'nouveau', 'nouveaux'))
  if (misAJour) morceaux.push(`${misAJour} mis à jour`)
  if (inchanges) morceaux.push(`${inchanges} déjà à jour`)
  if (rejetes) morceaux.push(accorder(rejetes, 'rejeté', 'rejetés'))
  return morceaux.join(', ')
}

// Nombre de profils gardés sur le compte après la recherche (nouveaux et déjà connus).
export const profilsGardes = ({ nouveaux = 0, misAJour = 0, inchanges = 0 }) => nouveaux + misAJour + inchanges
