/**
 * Outils communs des tests de bout en bout.
 * - simulerApi : remplace le backend (posts, n8n, profils, comptes) par des réponses fixes et note chaque appel ;
 *   tout appel /api non prévu échoue, pour qu'un nouvel appel ne passe pas inaperçu.
 *   Par défaut, un utilisateur est connecté (UTILISATEUR) ; { connecte: false } simule un visiteur.
 *   Les posts et paramètres du compte (lot L0.7) vivent dans un petit serveur en mémoire :
 *   { posts, parametres } fixent son contenu de départ ; api.serveur permet de le lire.
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
  'profils/rechercher': () => ({ status: 200, json: { profils: PROFILS_NORMALISES, rejetes: 0, source: 'n8n' } }),
}

export async function simulerApi(page, remplacements = {}, { connecte = true, posts = [], parametres = {} } = {}) {
  const appels = []
  const serveur = { posts: [...posts], parametres: { defaultTone: 'Professionnel', scraperWebhook: '', ...parametres } }
  const DONNEES = {
    'posts': () => ({ status: 200, json: { posts: serveur.posts.slice(0, 50), total: serveur.posts.length } }),
    'posts/generate': (corps) => {
      const enregistre = { id: `p-${serveur.posts.length + 1}`, type: corps.type, model: 'deepseek', content: POST_GENERE, createdAt: new Date().toISOString() }
      serveur.posts.unshift(enregistre)
      return { status: 200, json: { success: true, post: POST_GENERE, enregistre } }
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
      return { status: 200, json: { posts: { importes: nouveaux.length, dejaLa: (corps.posts || []).length - nouveaux.length, ecartes: 0 }, parametres: 'conserves' } }
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

    const reponse = (remplacements[chemin] || REPONSES[chemin] || DONNEES[chemin] || COMPTE[chemin])?.(corps, requete.method())
    if (!reponse) return route.fulfill({ status: 599, body: `Appel non simulé : ${chemin}` })
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
