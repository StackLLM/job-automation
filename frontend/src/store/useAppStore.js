/**
 * Données de l'utilisateur.
 * - Posts, paramètres (lot L0.7) et profils scrapés (lot L1.1) : sur le serveur, rattachés au compte.
 *   Le store n'en garde qu'une copie, chargée à la connexion (chargerCompte) et vidée à la déconnexion (viderCompte).
 * - Lettres et offres sauvegardées : encore dans le navigateur (localStorage, clé « linkedai-storage »).
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { listerPosts, lireParametres, enregistrerParametres, listerTousLesProfils, supprimerTousLesProfils, listerRecherches, modifierProfil, supprimerProfil, supprimerSelection } from '../services/api'
import { PARAMETRES_PAR_DEFAUT, extraireAImporter, mettreDeCote } from '../lib/importLocal'

const POSTS_AFFICHES = 50

const useAppStore = create(
  persist(
    (set, get) => ({
      // ─── Données du compte ────────────────────────────
      // compte : « vide » (rien de chargé), « chargement », « pret » ; compteDe : l'utilisateur chargé.
      compte: 'vide',
      compteDe: null,

      chargerCompte: async (userId) => {
        set({ compte: 'chargement', compteDe: userId })
        try {
          const [{ posts, total }, parametres, profils, recherches] = await Promise.all([listerPosts(), lireParametres(), listerTousLesProfils(), listerRecherches()])
          if (get().compteDe !== userId) return // un autre compte a pris la place entre-temps
          set({ posts, totalPosts: total, settings: { ...PARAMETRES_PAR_DEFAUT, ...parametres }, scrapedProfiles: profils, recherches, compte: 'pret' })
        } catch (err) {
          if (get().compteDe === userId) set({ compte: 'pret' })
          throw err
        }
      },

      viderCompte: () => set({ posts: [], totalPosts: 0, settings: { ...PARAMETRES_PAR_DEFAUT }, scrapedProfiles: [], recherches: [], compte: 'vide', compteDe: null }),

      // ─── Posts générés (copie de ceux du compte) ──────
      posts: [],
      totalPosts: 0,
      // post : la ligne renvoyée par le serveur après la génération.
      ajouterPost: (post) =>
        set((state) => ({
          posts: [post, ...state.posts].slice(0, POSTS_AFFICHES),
          totalPosts: state.totalPosts + 1,
        })),

      // ─── Profils scrapés (copie de ceux du compte) ────
      // Plus récents d'abord. Relue en entier après chaque recherche : le serveur écarte les doublons.
      scrapedProfiles: [],
      // Recherches du compte (lot L1.5) : filtre « recherche d'origine » et historique de la fiche.
      recherches: [],
      rechargerProfils: async () => {
        const userId = get().compteDe
        const [profils, recherches] = await Promise.all([listerTousLesProfils(), listerRecherches()])
        if (get().compteDe === userId) set({ scrapedProfiles: profils, recherches })
      },
      // Note et étiquettes d'un profil (fiche, lot L1.5) : le serveur fait foi, sa réponse remplace la copie.
      modifierProfil: async (id, partiel) => {
        const profil = await modifierProfil(id, partiel)
        set((state) => ({ scrapedProfiles: state.scrapedProfiles.map((p) => (p.id === id ? profil : p)) }))
        return profil
      },
      supprimerProfil: async (id) => {
        await supprimerProfil(id)
        set((state) => ({ scrapedProfiles: state.scrapedProfiles.filter((p) => p.id !== id) }))
      },
      // Une sélection (lot L1.7) : renvoie le nombre supprimé par le serveur.
      supprimerProfils: async (ids) => {
        const { supprimes } = await supprimerSelection(ids)
        const retires = new Set(ids)
        set((state) => ({ scrapedProfiles: state.scrapedProfiles.filter((p) => !retires.has(p.id)) }))
        return supprimes
      },
      viderProfils: async () => {
        await supprimerTousLesProfils()
        set({ scrapedProfiles: [] })
      },

      // ─── Lettres générées ─────────────────────────────
      letters: [],
      addLetter: (letter) =>
        set((state) => ({
          letters: [{ ...letter, id: Date.now(), createdAt: new Date().toISOString() }, ...state.letters],
        })),

      // ─── Offres sauvegardées ──────────────────────────
      savedJobs: [],
      toggleSavedJob: (job) => {
        const exists = get().savedJobs.find((j) => j.link === job.link)
        if (exists) {
          set((state) => ({ savedJobs: state.savedJobs.filter((j) => j.link !== job.link) }))
        } else {
          set((state) => ({ savedJobs: [...state.savedJobs, job] }))
        }
      },

      // ─── Paramètres (copie de ceux du compte) ─────────
      // defaultTone : une valeur de TONS_POST (lib/posts.js) ; scraperWebhook vide : le scraper passe par le backend.
      settings: { ...PARAMETRES_PAR_DEFAUT },
      enregistrerParametres: async (partiel) => {
        const parametres = await enregistrerParametres(partiel)
        set({ settings: { ...PARAMETRES_PAR_DEFAUT, ...parametres } })
      },
    }),
    {
      name: 'linkedai-storage',
      // Version 1 (lot L0.7) : posts et paramètres quittent le navigateur. Version 2 (lot L1.1) : les profils aussi.
      // Ce qu'un ancien stockage contient encore est mis de côté pour être importé dans le compte,
      // puis retiré de cette clé.
      version: 2,
      migrate: (etat, version) => {
        if (version >= 2) return etat
        mettreDeCote(extraireAImporter(etat))
        const reste = { ...etat }
        delete reste.posts
        delete reste.settings
        delete reste.scrapedProfiles
        return reste
      },
      partialize: (state) => ({
        letters: state.letters.slice(0, 20),
        savedJobs: state.savedJobs,
      }),
    }
  )
)

export default useAppStore
