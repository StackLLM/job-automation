/**
 * Reprise des données gardées dans le navigateur avant les comptes (lot L0.7).
 * Les posts et les paramètres vivent maintenant sur le serveur. À la mise à jour du stockage local
 * (store/useAppStore.js, version 1), ceux du navigateur sont mis de côté sous CLE_A_IMPORTER,
 * puis proposés à l'import (components/compte/ImportNavigateur.jsx).
 * Ils ne sont effacés qu'après un import réussi.
 */

export const CLE_A_IMPORTER = 'linkedai-a-importer'
export const PARAMETRES_PAR_DEFAUT = { defaultTone: 'Professionnel', scraperWebhook: '' }

const sontParDefaut = (settings) =>
  !settings || Object.entries(PARAMETRES_PAR_DEFAUT).every(([cle, valeur]) => (settings[cle] ?? valeur) === valeur)

// État persistant de la version 0 → ce qui mérite un import, ou null s'il n'y a rien.
// Des paramètres restés à leurs valeurs par défaut ne sont pas proposés.
export function extraireAImporter(etat) {
  const posts = Array.isArray(etat?.posts) ? etat.posts.filter((p) => p && p.content) : []
  const settings = sontParDefaut(etat?.settings) ? null : { ...PARAMETRES_PAR_DEFAUT, ...etat.settings }
  return posts.length || settings ? { posts, settings } : null
}

// Accès au stockage protégés : il peut être absent ou refusé (navigation privée).
export function lireAImporter() {
  try {
    const brut = window.localStorage.getItem(CLE_A_IMPORTER)
    return brut ? JSON.parse(brut) : null
  } catch {
    return null
  }
}

export function mettreDeCote(donnees) {
  if (!donnees) return
  try {
    // Un premier dépôt n'est jamais écrasé : il n'a peut-être pas encore été importé.
    if (!window.localStorage.getItem(CLE_A_IMPORTER)) window.localStorage.setItem(CLE_A_IMPORTER, JSON.stringify(donnees))
  } catch { /* stockage indisponible : rien à reprendre */ }
}

export function effacerAImporter() {
  try { window.localStorage.removeItem(CLE_A_IMPORTER) } catch { /* rien à faire */ }
}

// Phrase qui dit ce que le navigateur garde : « 2 posts et tes paramètres ».
export function resumeAImporter(donnees) {
  const morceaux = []
  const n = donnees?.posts?.length || 0
  if (n) morceaux.push(`${n} post${n > 1 ? 's' : ''}`)
  if (donnees?.settings) morceaux.push('tes paramètres')
  return morceaux.join(' et ')
}

// Réponse du serveur → message de fin d'import.
export function messageImport({ posts, parametres }) {
  const morceaux = []
  if (posts.importes) morceaux.push(`${posts.importes} post${posts.importes > 1 ? 's' : ''} importé${posts.importes > 1 ? 's' : ''}`)
  if (posts.dejaLa) morceaux.push(`${posts.dejaLa} déjà dans ton compte`)
  if (parametres === 'importes') morceaux.push('paramètres importés')
  return morceaux.length ? `${morceaux.join(', ')}.` : 'Rien de nouveau à importer.'
}
