/** cloneme: C-01 — Cadre de l'application : sidebar, barre du haut, contenu qui défile, import des données du navigateur (C-32). */
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import TopLoader from '@/components/lightswind/TopLoader'
import ImportNavigateur from '@/components/compte/ImportNavigateur'
import useActiviteStore from '@/store/useActiviteStore'

export default function Layout() {
  const enCours = useActiviteStore((s) => s.enCours)

  return (
    <div className="min-h-screen bg-app md:h-screen md:overflow-hidden">
      <TopLoader isLoading={enCours > 0} />
      <div className="flex min-h-screen md:h-full md:min-h-0">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col md:overflow-hidden">
          <Topbar />
          <main className="flex-1 px-4 pb-[calc(var(--hauteur-nav-mobile)+24px)] pt-1 sm:px-6 md:overflow-y-auto md:pb-8">
            <ImportNavigateur />
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
