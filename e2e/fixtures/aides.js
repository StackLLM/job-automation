/**
 * Outils communs des tests de bout en bout.
 * - simulerApi : remplace le backend (posts, n8n, profils, comptes) par des réponses fixes et note chaque appel ;
 *   tout appel /api non prévu échoue, pour qu'un nouvel appel ne passe pas inaperçu.
 *   Par défaut, un utilisateur est connecté (UTILISATEUR) ; { connecte: false } simule un visiteur.
 *   Les posts, paramètres (lot L0.7) et profils (lot L1.1) du compte vivent dans un petit serveur en mémoire :
 *   { posts, parametres, profils } fixent son contenu de départ ; api.serveur permet de le lire.
 * - Les ressources externes (police Google, html-to-image sur jsDelivr) sont servies en local :
 *   la suite tourne sans Internet.
 * - erreursConsole : erreurs JavaScript et console de la page.
 */
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { POST_GENERE, RESSOURCES, VISUEL, PROFILS, PROFILS_NORMALISES } from './donnees.js'

const require = createRequire(import.meta.url)
const HTML_TO_IMAGE = readFileSync(require.resolve('html-to-image/dist/html-to-image.js'), 'utf8')

export const CLE_STOCKAGE = 'linkedai-storage'

export const UTILISATEUR = { id: 'u-1', name: 'Amina Test', email: 'amina@exemple.test', emailVerified: false }
const sessionDe = (utilisateur) => ({ session: { id: 's-1', userId: utilisateur.id, expiresAt: '2099-01-01T00:00:00.000Z' }, user: utilisateur })

const REPONSES = {
  'n8n/resource-suggestions': () => ({ status: 200, json: RESSOURCES }),
  'n8n/generate-visual': () => ({ status: 200, json: VISUEL }),
  'n8n/scraper': () => ({ status: 200, json: { profiles: PROFILS } }),
}

// Profil du navigateur ou d'un webhook ({ name, title, link… }) → forme serveur, comme depuisFormeLocale du backend.
const depuisFormeLocale = (p, source) => ({
  urlNormalisee: p.link, nom: p.name ?? null, poste: p.poste !== undefined ? p.poste : p.title ?? null,
  entreprise: p.entreprise ?? null, lieu: p.lieu ?? null, extrait: p.snippet ?? null, image: p.image ?? null, source: p.source ?? source,
})

export async function simulerApi(page, remplacements = {}, { connecte = true, posts = [], parametres = {}, profils = [], recherches = [] } = {}) {
  const appels = []
  const serveur = {
    posts: [...posts], parametres: { defaultTone: 'Professionnel', scraperWebhook: '', ...parametres },
    profils: profils.map((p) => ({ note: null, etiquettes: [], ...p })), recherches: [...recherches],
  }
  // Mêmes règles que le backend : une URL n'est gardée qu'une fois ; les nouveaux passent devant, dans l'ordre reçu ;
  // un profil déjà connu prend les valeurs nouvelles non vides (lot L1.3), sauf à l'import (mettreAJour: false).
  const CHAMPS_FUSIONNES = ['nom', 'poste', 'entreprise', 'lieu', 'extrait', 'image']
  const enregistrerProfils = (lot, { mettreAJour = true } = {}) => {
    const parUrl = new Map(serveur.profils.map((p) => [p.urlNormalisee, p]))
    const nouveaux = lot.filter((p) => p.urlNormalisee && !parUrl.has(p.urlNormalisee))
      .map((p, i) => ({ ...p, id: `pr-${serveur.profils.length + i + 1}`, note: null, etiquettes: [], createdAt: new Date().toISOString(), collecteLe: new Date().toISOString() }))
    let misAJour = 0
    for (const p of mettreAJour ? lot : []) {
      const existant = parUrl.get(p.urlNormalisee)
      if (!existant) continue
      const change = CHAMPS_FUSIONNES.filter((c) => p[c] != null && p[c] !== existant[c])
      for (const c of change) existant[c] = p[c]
      if (change.length) misAJour += 1
    }
    serveur.profils.unshift(...nouveaux)
    return { nouveaux: nouveaux.length, misAJour, inchanges: lot.length - nouveaux.length - misAJour }
  }
  const DONNEES = {
    'posts': () => ({ status: 200, json: { posts: serveur.posts.slice(0, 50), total: serveur.posts.length } }),
    'posts/generate': (corps) => {
      const enregistre = { id: `p-${serveur.posts.length + 1}`, type: corps.type, model: 'deepseek', content: POST_GENERE, createdAt: new Date().toISOString() }
      serveur.posts.unshift(enregistre)
      return { status: 200, json: { success: true, post: POST_GENERE, enregistre } }
    },
    'profils': (_corps, methode) => {
      if (methode === 'DELETE') {
        const supprimes = serveur.profils.length
        serveur.profils = []
        return { status: 200, json: { supprimes } }
      }
      return { status: 200, json: { profils: serveur.profils.slice(0, 200), total: serveur.profils.length, page: 1, parPage: 200 } }
    },
    'profils/rechercher': () => ({ status: 200, json: { profils: PROFILS_NORMALISES, rejetes: 0, source: 'n8n', secours: false, ...enregistrerProfils(PROFILS_NORMALISES) } }),
    'profils/recherches': () => ({ status: 200, json: { recherches: serveur.recherches } }),
    'profils/annuler-recherche': () => ({ status: 204, json: null }),
    // Une sélection (lot L1.7) : les identifiants inconnus sont ignorés.
    'profils/supprimer': (corps) => {
      const ids = new Set(corps.ids)
      const avant = serveur.profils.length
      serveur.profils = serveur.profils.filter((p) => !ids.has(p.id))
      return { status: 200, json: { supprimes: avant - serveur.profils.length } }
    },
    // PATCH et DELETE d'un profil (lot L1.5) : 404 s'il n'existe pas.
    'profils/:id': (corps, methode, id) => {
      const profil = serveur.profils.find((p) => p.id === id)
      if (!profil) return { status: 404, json: { error: 'Profil introuvable' } }
      if (methode === 'DELETE') {
        serveur.profils = serveur.profils.filter((p) => p !== profil)
        return { status: 204, json: null }
      }
      if ('note' in corps) profil.note = corps.note?.trim() || null
      if ('etiquettes' in corps) profil.etiquettes = corps.etiquettes
      return { status: 200, json: { profil } }
    },
    'profils/lot': (corps) => {
      const valides = corps.profils.filter((p) => p.link)
      return { status: 200, json: { ...enregistrerProfils(valides.map((p) => depuisFormeLocale(p, 'webhook'))), rejetes: corps.profils.length - valides.length } }
    },
    'compte/parametres': (corps, methode) => {
      if (methode === 'PUT') serveur.parametres = { ...serveur.parametres, ...corps }
      return { status: 200, json: { parametres: serveur.parametres } }
    },
    // Même règle que le backend : un post déjà importé (même id local) n'est pas recréé.
    'compte/import-local': (corps) => {
      const deja = new Set(serveur.posts.map((p) => p.idLocal))
      const nouveaux = (corps.posts || []).filter((p) => !deja.has(String(p.id)))
      serveur.posts.push(...nouveaux.map((p) => ({ ...p, id: `i-${p.id}`, idLocal: String(p.id) })))
      serveur.posts.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      const profilsImportes = enregistrerProfils((corps.profils || []).map((p) => depuisFormeLocale(p, 'navigateur')), { mettreAJour: false })
      return { status: 200, json: {
        posts: { importes: nouveaux.length, dejaLa: (corps.posts || []).length - nouveaux.length, ecartes: 0 },
        parametres: 'conserves',
        profils: { importes: profilsImportes.nouveaux, dejaLa: profilsImportes.inchanges, ecartes: 0 },
      } }
    },
  }
  // La session suit les connexions et déconnexions simulées pendant le test.
  let utilisateur = connecte ? UTILISATEUR : null
  const COMPTE = {
    'auth/get-session': () => ({ status: 200, json: utilisateur ? sessionDe(utilisateur) : null }),
    'auth/sign-in/email': (corps) => {
      if (corps?.password !== 'mot-de-passe-solide-1') return { status: 401, json: { code: 'INVALID_EMAIL_OR_PASSWORD', message: 'Invalid email or password' } }
      utilisateur = { ...UTILISATEUR, email: corps.email }
      return { status: 200, json: { user: utilisateur } }
    },
    'auth/sign-up/email': (corps) => {
      utilisateur = { ...UTILISATEUR, name: corps.name, email: corps.email }
      return { status: 200, json: { user: utilisateur } }
    },
    'auth/sign-out': () => { utilisateur = null; return { status: 200, json: { success: true } } },
    'auth/request-password-reset': () => ({ status: 200, json: { status: true } }),
    'auth/reset-password': (corps) => (corps?.token === 'jeton-valide'
      ? { status: 200, json: { status: true } }
      : { status: 400, json: { code: 'INVALID_TOKEN', message: 'Invalid token' } }),
  }

  await page.route('**/api/**', async (route) => {
    const requete = route.request()
    const chemin = new URL(requete.url()).pathname.replace(/^.*\/api\//, '')
    const corps = requete.postDataJSON?.() ?? null
    appels.push({ chemin, methode: requete.method(), corps })

    const idProfil = chemin.match(/^profils\/([^/]+)$/)?.[1]
    const parId = idProfil && !DONNEES[chemin] ? DONNEES['profils/:id'] : null
    const reponse = (remplacements[chemin] || REPONSES[chemin] || DONNEES[chemin] || parId || COMPTE[chemin])?.(corps ?? {}, requete.method(), idProfil)
    if (!reponse) return route.fulfill({ status: 599, body: `Appel non simulé : ${chemin}` })
    if (reponse.status === 204) return route.fulfill({ status: 204 })
    return route.fulfill({ status: reponse.status, contentType: 'application/json', body: JSON.stringify(reponse.json) })
  })

  await page.route('https://cdn.jsdelivr.net/npm/html-to-image@*/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: HTML_TO_IMAGE }))
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) =>
    route.fulfill({ status: 200, contentType: 'text/css', body: '' }))

  return {
    appels,
    serveur,
    vers: (chemin) => appels.filter((a) => a.chemin === chemin),
  }
}

// Remplit le stockage du navigateur avant le chargement, une seule fois (une actualisation garde l'état de l'app).
export async function prechargerNavigateur(page, etat) {
  await page.addInitScript(([cle, valeur]) => {
    if (!window.localStorage.getItem(cle)) window.localStorage.setItem(cle, valeur)
  }, [CLE_STOCKAGE, JSON.stringify(etat)])
}

export function erreursConsole(page) {
  const erreurs = []
  page.on('console', (msg) => { if (msg.type() === 'error') erreurs.push(msg.text()) })
  page.on('pageerror', (err) => erreurs.push(err.message))
  return erreurs
}

export const CLE_A_IMPORTER = 'linkedai-a-importer'
export const lireAImporter = (page) =>
  page.evaluate((cle) => JSON.parse(window.localStorage.getItem(cle) || 'null'), CLE_A_IMPORTER)

export const lireStockage = (page) =>
  page.evaluate((cle) => JSON.parse(window.localStorage.getItem(cle) || 'null'), CLE_STOCKAGE)
