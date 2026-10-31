/**
 * Données de l'utilisateur.
 * - Posts et paramètres : sur le serveur, rattachés au compte (lot L0.7). Le store n'en garde qu'une copie,
 *   chargée à la connexion (chargerCompte) et vidée à la déconnexion (viderCompte).
 * - Profils scrapés, lettres, offres sauvegardées : encore dans le navigateur (localStorage,
 *   clé « linkedai-storage »), jusqu'aux lots L1.1 et L4.3.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { listerPosts, lireParametres, enregistrerParametres } from '../services/api'
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
          const [{ posts, total }, parametres] = await Promise.all([listerPosts(), lireParametres()])
          if (get().compteDe !== userId) return // un autre compte a pris la place entre-temps
          set({ posts, totalPosts: total, settings: { ...PARAMETRES_PAR_DEFAUT, ...parametres }, compte: 'pret' })
        } catch (err) {
          if (get().compteDe === userId) set({ compte: 'pret' })
          throw err
        }
      },

      viderCompte: () => set({ posts: [], totalPosts: 0, settings: { ...PARAMETRES_PAR_DEFAUT }, compte: 'vide', compteDe: null }),

      // ─── Posts générés (copie de ceux du compte) ──────
      posts: [],
      totalPosts: 0,
      // post : la ligne renvoyée par le serveur après la génération.
      ajouterPost: (post) =>
        set((state) => ({
          posts: [post, ...state.posts].slice(0, POSTS_AFFICHES),
          totalPosts: state.totalPosts + 1,
        })),

      // ─── Profils scrapés ──────────────────────────────
      scrapedProfiles: [],
      setScrapedProfiles: (profiles) => set({ scrapedProfiles: profiles }),
      addProfiles: (profiles) =>
        set((state) => ({
          scrapedProfiles: [...profiles, ...state.scrapedProfiles],
        })),
      clearProfiles: () => set({ scrapedProfiles: [] }),

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
      // Version 1 (lot L0.7) : posts et paramètres quittent le navigateur. Ceux d'une version 0
      // sont mis de côté pour être importés dans le compte, puis retirés de cette clé.
      version: 1,
      migrate: (etat, version) => {
        if (version < 1) {
          mettreDeCote(extraireAImporter(etat))
          const reste = { ...etat }
          delete reste.posts
          delete reste.settings
          return reste
        }
        return etat
      },
      partialize: (state) => ({
        letters: state.letters.slice(0, 20),
        savedJobs: state.savedJobs,
        scrapedProfiles: state.scrapedProfiles.slice(0, 200),
      }),
    }
  )
)

export default useAppStore
