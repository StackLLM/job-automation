/**
 * cloneme: C-32 — Reprise des données du navigateur (lot L0.7).
 * Bandeau en haut du contenu tant que ce navigateur garde des posts ou des paramètres d'avant les comptes.
 * « Importer » les envoie au compte, puis les efface du navigateur ; « Plus tard » le cache jusqu'au prochain chargement.
 * En cas d'échec, rien n'est effacé.
 */
import { useState } from 'react'
import toast from 'react-hot-toast'
import { UploadCloud } from 'lucide-react'
import Button from '@/components/ui/Button'
import useAppStore from '@/store/useAppStore'
import useSessionStore from '@/store/useSessionStore'
import { importerDonneesLocales } from '@/services/api'
import { lireAImporter, effacerAImporter, resumeAImporter, messageImport } from '@/lib/importLocal'

export default function ImportNavigateur() {
  const [donnees, setDonnees] = useState(lireAImporter)
  const [enCours, setEnCours] = useState(false)
  const chargerCompte = useAppStore((s) => s.chargerCompte)
  const userId = useSessionStore((s) => s.utilisateur?.id)

  if (!donnees) return null

  const importer = async () => {
    setEnCours(true)
    try {
      const resultat = await importerDonneesLocales(donnees)
      effacerAImporter()
      setDonnees(null)
      toast.success(messageImport(resultat))
      await chargerCompte(userId)
    } catch (err) {
      toast.error(`Import impossible : ${err.message}`)
    } finally {
      setEnCours(false)
    }
  }

  return (
    <div role="region" aria-label="Données du navigateur à importer"
      className="carte mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pilule bg-sable text-texte">
          <UploadCloud size={18} />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium text-texte">Ce navigateur garde {resumeAImporter(donnees)} d’avant ton compte.</span>
          <span className="block text-xs text-texte-pale">Importe-les pour les retrouver partout. Rien n’est effacé avant la fin de l’import.</span>
        </span>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button variante="fantome" petit onClick={() => setDonnees(null)} disabled={enCours}>Plus tard</Button>
        <Button petit icone={UploadCloud} chargement={enCours} onClick={importer}>Importer</Button>
      </div>
    </div>
  )
}
