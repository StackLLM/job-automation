/**
 * Reprise des données gardées dans le navigateur avant les comptes (lots L0.7 et L1.1).
 * Les posts, les paramètres et les profils vivent maintenant sur le serveur. À la mise à jour du stockage local
 * (store/useAppStore.js, version 2), ceux du navigateur sont mis de côté sous CLE_A_IMPORTER,
 * puis proposés à l'import (components/compte/ImportNavigateur.jsx).
 * Ils ne sont effacés qu'après un import réussi.
 */

export const CLE_A_IMPORTER = 'linkedai-a-importer'
export const PARAMETRES_PAR_DEFAUT = { defaultTone: 'Professionnel', scraperWebhook: '' }

const sontParDefaut = (settings) =>
  !settings || Object.entries(PARAMETRES_PAR_DEFAUT).every(([cle, valeur]) => (settings[cle] ?? valeur) === valeur)

// État persistant d'une version 0 ou 1 → ce qui mérite un import, ou null s'il n'y a rien.
// Des paramètres restés à leurs valeurs par défaut ne sont pas proposés.
export function extraireAImporter(etat) {
  const posts = Array.isArray(etat?.posts) ? etat.posts.filter((p) => p && p.content) : []
  const settings = sontParDefaut(etat?.settings) ? null : { ...PARAMETRES_PAR_DEFAUT, ...etat.settings }
  const profils = Array.isArray(etat?.scrapedProfiles) ? etat.scrapedProfiles.filter((p) => p && p.link) : []
  return posts.length || settings || profils.length ? { posts, settings, profils } : null
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
    // Il est seulement complété par ce qu'il n'avait pas (les profils d'un dépôt fait en version 1, par exemple).
    const deja = lireAImporter() || {}
    const complet = {
      posts: deja.posts?.length ? deja.posts : donnees.posts || [],
      settings: deja.settings || donnees.settings || null,
      profils: deja.profils?.length ? deja.profils : donnees.profils || [],
    }
    window.localStorage.setItem(CLE_A_IMPORTER, JSON.stringify(complet))
  } catch { /* stockage indisponible : rien à reprendre */ }
}

export function effacerAImporter() {
  try { window.localStorage.removeItem(CLE_A_IMPORTER) } catch { /* rien à faire */ }
}

const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`

// Phrase qui dit ce que le navigateur garde : « 2 posts, 3 profils et tes paramètres ».
export function resumeAImporter(donnees) {
  const morceaux = []
  if (donnees?.posts?.length) morceaux.push(pluriel(donnees.posts.length, 'post'))
  if (donnees?.profils?.length) morceaux.push(pluriel(donnees.profils.length, 'profil'))
  if (donnees?.settings) morceaux.push('tes paramètres')
  return morceaux.length > 1 ? `${morceaux.slice(0, -1).join(', ')} et ${morceaux.at(-1)}` : morceaux.join('')
}

// Réponse du serveur → message de fin d'import.
export function messageImport({ posts, parametres, profils = { importes: 0, dejaLa: 0 } }) {
  const morceaux = []
  if (posts.importes) morceaux.push(`${pluriel(posts.importes, 'post')} importé${posts.importes > 1 ? 's' : ''}`)
  if (profils.importes) morceaux.push(`${pluriel(profils.importes, 'profil')} importé${profils.importes > 1 ? 's' : ''}`)
  const dejaLa = posts.dejaLa + profils.dejaLa
  if (dejaLa) morceaux.push(`${dejaLa} déjà dans ton compte`)
  if (parametres === 'importes') morceaux.push('paramètres importés')
  return morceaux.length ? `${morceaux.join(', ')}.` : 'Rien de nouveau à importer.'
}
