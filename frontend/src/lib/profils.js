/**
 * Liste des profils (lot L1.5) : tri, filtres et libellés, sans état ni appel réseau.
 * Les profils sont dans la forme lue par le front (services/api.js versProfilLocal).
 */

// Nom affiché du fournisseur d'un profil.
export const LIBELLES_SOURCE = {
  serper: 'Serper (Google)', brave: 'Brave', n8n: 'n8n (Google)', webhook: 'Webhook n8n', navigateur: 'Import du navigateur',
}
export const libelleSource = (source) => LIBELLES_SOURCE[source] || source || 'Source inconnue'

// Libellés courts : ils tiennent dans le sélecteur à 375 px. Dates : la plus récente d'abord ; nom : de A à Z.
export const TRIS = [
  { id: 'collecte', libelle: 'Collecte' },
  { id: 'ajout', libelle: 'Ajout' },
  { id: 'nom', libelle: 'Nom' },
]

const temps = (date) => (date ? new Date(date).getTime() : 0)
const comparerNoms = (a, b) => (a.name || '').localeCompare(b.name || '', 'fr', { sensitivity: 'base' })

// Nouvelle liste triée ; l'ordre d'origine départage les égalités.
export function trierProfils(profils, tri = 'collecte') {
  const liste = profils.map((p, i) => [p, i])
  const comparer = {
    collecte: ([a], [b]) => temps(b.collecteLe ?? b.createdAt) - temps(a.collecteLe ?? a.createdAt),
    ajout: ([a], [b]) => temps(b.createdAt) - temps(a.createdAt),
    nom: ([a], [b]) => comparerNoms(a, b),
  }[tri] ?? (() => 0)
  return liste.sort((x, y) => comparer(x, y) || x[1] - y[1]).map(([p]) => p)
}

const contient = (texte, q) => (texte || '').toLowerCase().includes(q)

// filtres : { texte, rechercheId, source, etiquette } ; un filtre vide ne filtre pas.
export function filtrerProfils(profils, { texte = '', rechercheId = '', source = '', etiquette = '' } = {}) {
  const q = texte.trim().toLowerCase()
  return profils.filter((p) =>
    (!q || [p.name, p.title, p.snippet, p.lieu, p.note, ...(p.etiquettes || [])].some((t) => contient(t, q))) &&
    (!rechercheId || p.rechercheId === rechercheId) &&
    (!source || p.source === source) &&
    (!etiquette || (p.etiquettes || []).includes(etiquette)))
}

// Valeurs présentes dans la liste, pour proposer des filtres qui donnent toujours un résultat.
export const etiquettesDe = (profils) => [...new Set(profils.flatMap((p) => p.etiquettes || []))].sort((a, b) => a.localeCompare(b, 'fr'))
export const sourcesDe = (profils) => [...new Set(profils.map((p) => p.source).filter(Boolean))]

// « 31 oct. 2026 »
export const dateCourte = (date) =>
  date ? new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : 'non renseignée'

// Libellé d'une recherche : « ingenieur cloud — maroc (31 oct. 2026) ».
export const libelleRecherche = (r) => `${r.requete}${r.lieu ? ` — ${r.lieu}` : ''} (${dateCourte(r.createdAt)})`

// Étiquette saisie → propre, ou null si vide ou déjà là (casse ignorée).
export const ETIQUETTES_MAX = 10
export const ETIQUETTE_MAX = 30
export function nouvelleEtiquette(saisie, existantes = []) {
  const propre = saisie.trim().replace(/\s+/g, ' ').slice(0, ETIQUETTE_MAX)
  if (!propre || existantes.some((e) => e.toLowerCase() === propre.toLowerCase())) return null
  return propre
}

// Question de la confirmation de suppression (C-35, lot L1.7).
export const phraseSuppression = (nombre) =>
  nombre === 1
    ? 'Supprimer ce profil, avec sa note et ses étiquettes ?'
    : `Supprimer les ${nombre} profils, avec leurs notes et étiquettes ?`
