/**
 * Fournisseur de profils « n8n » : le workflow linkedin-scraper-webhook (Google Custom Search).
 * Premier fournisseur, puis secours du fournisseur payant à partir du lot L1.4 (décision D-06).
 * Contrat d'un fournisseur : { nom, rechercher({ requete, lieu, pages }) → Promise<ProfilBrut[]> },
 * où ProfilBrut = { titre, lien, extrait, image }. Une panne lève une ErreurFournisseur.
 */
import axios from 'axios'
import { ErreurFournisseur, estUnDelai } from './erreurs.js'

// Le workflow répond { profiles }, mais d'anciennes versions renvoyaient d'autres formes : on les accepte toutes.
export function extraireListe(donnees) {
  let d = donnees
  if (typeof d === 'string') {
    try { d = JSON.parse(d) } catch { return null }
  }
  if (Array.isArray(d)) return d
  for (const cle of ['profiles', 'data', 'items', 'results']) {
    if (Array.isArray(d?.[cle])) return d[cle]
  }
  return null
}

// Le workflow coupe déjà le titre Google sur « - » (name, title) : on le recompose pour la normalisation.
const versBrut = (p) => ({
  titre: [p?.name, p?.title].filter(Boolean).join(' - '),
  lien: p?.link ?? p?.url ?? null,
  extrait: p?.snippet ?? null,
  image: p?.image ?? null,
})

export const n8n = {
  nom: 'n8n',

  async rechercher({ requete, lieu, pages }) {
    const base = (process.env.N8N_BASE_URL || 'http://localhost:5678').replace(/\/$/, '')
    let reponse
    try {
      reponse = await axios.post(`${base}/webhook/scraper`, { query: requete, location: lieu, maxPages: pages }, {
        timeout: 120_000,
        responseType: 'text',
        transformResponse: [(data) => data],
        validateStatus: () => true,
      })
    } catch (err) {
      throw new ErreurFournisseur('n8n', estUnDelai(err) ? 'delai' : 'injoignable', err.message)
    }

    // 429 ou 402 : le quota Google Custom Search du workflow est épuisé (lot L1.6).
    if (reponse.status === 429 || reponse.status === 402) throw new ErreurFournisseur('n8n', 'quota', `n8n a répondu ${reponse.status}`)
    if (reponse.status >= 400) throw new ErreurFournisseur('n8n', 'statut', `n8n a répondu ${reponse.status}`)
    const liste = extraireListe(reponse.data)
    if (!liste) throw new ErreurFournisseur('n8n', 'illisible', 'réponse de n8n illisible')
    return liste.map(versBrut)
  },
}
