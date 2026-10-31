/**
 * Session de l'utilisateur (lot L0.4), en mémoire seulement : la vérité est le cookie httpOnly du backend.
 * statut : « inconnu » au chargement de l'app, puis « connecte » ou « deconnecte ».
 */
import { create } from 'zustand'
import { sessionCourante, connecter, inscrire, deconnecter } from '../services/auth'
import { surSessionExpiree } from '../services/api'
import { identite } from '../lib/profil'
import useAppStore from './useAppStore'

const useSessionStore = create((set) => ({
  statut: 'inconnu',
  utilisateur: null,

  definir: (utilisateur) => set({ utilisateur, statut: utilisateur ? 'connecte' : 'deconnecte' }),

  charger: async () => {
    try {
      const utilisateur = await sessionCourante()
      set({ utilisateur, statut: utilisateur ? 'connecte' : 'deconnecte' })
    } catch {
      set({ utilisateur: null, statut: 'deconnecte' })
    }
  },

  seConnecter: async (identifiants) => {
    const utilisateur = await connecter(identifiants)
    set({ utilisateur, statut: 'connecte' })
  },

  sInscrire: async (donnees) => {
    const utilisateur = await inscrire(donnees)
    set({ utilisateur, statut: 'connecte' })
  },

  seDeconnecter: async () => {
    try { await deconnecter() } finally { oublier() }
  },
}))

// Sans session, les données du compte précédent ne restent pas en mémoire (lot L0.7).
function oublier() {
  useSessionStore.setState({ utilisateur: null, statut: 'deconnecte' })
  useAppStore.getState().viderCompte()
}

// Une réponse 401 de l'API pendant l'utilisation : la session a expiré ou a été fermée ailleurs.
surSessionExpiree(oublier)

// Identité affichée de l'utilisateur connecté.
export const useIdentite = () => identite(useSessionStore((s) => s.utilisateur))

export default useSessionStore
