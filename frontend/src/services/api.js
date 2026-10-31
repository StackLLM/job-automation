/**
 * Tous les appels réseau du front, tous vers le backend (jamais vers OpenRouter ni n8n en direct).
 * Exception : la page Scraper vise directement un webhook n8n si l'utilisateur en règle un (voir Scraper.jsx).
 */
import axios from 'axios'

// Adresse du backend. En local : le proxy Vite ('/api'). En démo : VITE_API_URL, l'adresse publique du backend.
export const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')

// Client du backend : envoie le cookie de session (lot L0.4), même quand le backend est sur un autre domaine.
// Le webhook n8n réglé à la main dans Paramètres n'utilise pas ce client : il ne reçoit jamais le cookie.
export const client = axios.create({ baseURL: API_BASE, withCredentials: true })

// Session expirée ou absente pendant l'utilisation : l'API répond 401, la session est oubliée
// et l'utilisateur revient à la page de connexion (voir store/useSessionStore.js).
let quandSessionExpire = () => {}
export const surSessionExpiree = (rappel) => { quandSessionExpire = rappel }
client.interceptors.response.use(undefined, (err) => {
  if (err.response?.status === 401 && !String(err.config?.url).startsWith('/auth/')) quandSessionExpire()
  return Promise.reject(err)
})

// Generateur de posts : la clé OpenRouter reste sur le backend, le navigateur ne la voit jamais.
// Renvoie { texte, post } : post est la ligne gardée dans l'historique du compte.
export async function generatePost({ type, description, tech, tone }) {
  try {
    const res = await client.post('/posts/generate', { type, description, tech, tone }, { timeout: 90000 })
    return { texte: res.data.post, post: res.data.enregistre }
  } catch (err) {
    if (err.response?.data?.error) throw new Error(err.response.data.error)
    if (!err.response) throw new Error('Backend injoignable : lance-le avec npm run dev (voir README).')
    throw err
  }
}

export const getResources = async ({ post, tech, type }) => {
  const res = await client.post('/n8n/resource-suggestions', { post, tech, type })
  return res.data
}

// Generateur de visuels IA
export const generateVisual = async ({ post, tech, type }) => {
  const res = await client.post('/n8n/generate-visual', { post, tech, type })
  return res.data
}

// Profil normalisé par le backend → forme lue par la table, l'export CSV, la recherche globale et le dashboard
// (name, title, link…). id, createdAt et rechercheId existent pour un profil enregistré sur le compte (lot L1.1).
export const versProfilLocal = (p) => ({
  ...(p.id && { id: p.id, createdAt: p.createdAt, rechercheId: p.rechercheId }),
  name: p.nom,
  title: [p.poste, p.entreprise].filter(Boolean).join(' · ') || null,
  link: p.urlNormalisee,
  snippet: p.extrait,
  image: p.image,
  poste: p.poste,
  entreprise: p.entreprise,
  lieu: p.lieu,
  source: p.source,
})

// Recherche de profils : le backend choisit le fournisseur, normalise les résultats et les enregistre sur le compte.
// Renvoie { profils (forme locale), rejetes, source, secours, nouveaux, dejaLa }.
export async function rechercherProfils({ requete, lieu, pages }) {
  try {
    const res = await client.post('/profils/rechercher', { requete, lieu, pages }, { timeout: 130000 })
    return { ...res.data, profils: res.data.profils.map(versProfilLocal) }
  } catch (err) {
    if (err.response?.data?.error) throw new Error(err.response.data.error)
    if (!err.response) throw new Error('Backend injoignable : lance-le avec npm run dev (voir README).')
    throw err
  }
}

// ─── Données du compte (lot L0.7) ──────────────────────────────────────────
// Les erreurs du backend arrivent avec leur message lisible.
const lisible = (err) => {
  if (err.response?.data?.error) return new Error(err.response.data.error)
  if (!err.response) return new Error('Backend injoignable : lance-le avec npm run dev (voir README).')
  return err
}

// Les 50 derniers posts du compte, et leur nombre total.
export async function listerPosts() {
  try { return (await client.get('/posts')).data } catch (err) { throw lisible(err) }
}

export async function lireParametres() {
  try { return (await client.get('/compte/parametres')).data.parametres } catch (err) { throw lisible(err) }
}

export async function enregistrerParametres(parametres) {
  try { return (await client.put('/compte/parametres', parametres)).data.parametres } catch (err) { throw lisible(err) }
}

// { posts, settings } du navigateur → { posts: { importes, dejaLa, ecartes }, parametres }
export async function importerDonneesLocales(donnees) {
  try { return (await client.post('/compte/import-local', donnees)).data } catch (err) { throw lisible(err) }
}

// ─── Profils du compte (lot L1.1) ──────────────────────────────────────────
export const PROFILS_PAR_PAGE = 200

// Tous les profils du compte, page par page (plus récents d'abord), en forme locale.
export async function listerTousLesProfils() {
  try {
    const profils = []
    for (let page = 1; ; page++) {
      const { data } = await client.get('/profils', { params: { page, parPage: PROFILS_PAR_PAGE } })
      profils.push(...data.profils.map(versProfilLocal))
      if (profils.length >= data.total || data.profils.length === 0) return profils
    }
  } catch (err) { throw lisible(err) }
}

// Profils reçus d'un webhook n8n réglé à la main → enregistrés sur le compte. Renvoie { nouveaux, dejaLa, rejetes }.
export async function enregistrerLotProfils({ profils, requete, lieu }) {
  try { return (await client.post('/profils/lot', { profils, requete, lieu })).data } catch (err) { throw lisible(err) }
}

// « Vider » : supprime tous les profils du compte. Renvoie { supprimes }.
export async function supprimerTousLesProfils() {
  try { return (await client.delete('/profils')).data } catch (err) { throw lisible(err) }
}
