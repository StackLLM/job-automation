/**
 * cloneme: C-31 — Garde des routes (lot L0.4).
 * RouteProtegee : sans session, renvoie vers /connexion en retenant la page demandée.
 * Connecté, charge d'abord les posts et paramètres du compte (lot L0.7) : les pages les lisent dès leur ouverture.
 * RoutePublique : les pages de compte renvoient au dashboard quand on est déjà connecté.
 */
import { useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import useSessionStore from '@/store/useSessionStore'
import useAppStore from '@/store/useAppStore'

function useSession() {
  const statut = useSessionStore((s) => s.statut)
  const charger = useSessionStore((s) => s.charger)
  useEffect(() => { if (statut === 'inconnu') charger() }, [statut, charger])
  return statut
}

const Chargement = () => (
  <div className="flex min-h-screen items-center justify-center bg-app" aria-label="Chargement de la session">
    <Loader2 size={24} className="animate-spin text-texte-pale" />
  </div>
)

// Données du compte connecté. Un échec n'empêche pas d'utiliser l'app : elle s'ouvre vide, avec un message.
function useDonneesCompte(userId) {
  const compte = useAppStore((s) => s.compte)
  const compteDe = useAppStore((s) => s.compteDe)
  const chargerCompte = useAppStore((s) => s.chargerCompte)
  const aCharger = Boolean(userId) && compteDe !== userId
  useEffect(() => {
    if (aCharger) chargerCompte(userId).catch((err) => toast.error(`Données du compte indisponibles : ${err.message}`))
  }, [aCharger, userId, chargerCompte])
  return aCharger || compte === 'chargement' ? 'chargement' : 'pret'
}

export function RouteProtegee() {
  const statut = useSession()
  const userId = useSessionStore((s) => s.utilisateur?.id)
  const donnees = useDonneesCompte(userId)
  const location = useLocation()
  if (statut === 'inconnu') return <Chargement />
  if (statut === 'deconnecte') return <Navigate to="/connexion" replace state={{ depuis: location.pathname }} />
  if (donnees === 'chargement') return <Chargement />
  return <Outlet />
}

export function RoutePublique() {
  const statut = useSession()
  if (statut === 'inconnu') return <Chargement />
  if (statut === 'connecte') return <Navigate to="/dashboard" replace />
  return <Outlet />
}
