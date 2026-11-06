/**
 * cloneme: C-35 — Confirmation d'une suppression de profils (lot L1.7) : le nombre de profils concernés,
 * « Annuler » ou le bouton de confirmation. Sert à la fiche (C-34), à la sélection et à « Vider ».
 * Rien n'est supprimé sans ce second clic : la suppression est définitive (décision D-11).
 */
import { Trash2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import { phraseSuppression } from '@/lib/profils'

export default function ConfirmationSuppression({ nombre, libelleConfirmer, onConfirmer, onAnnuler, enCours = false, className = '' }) {
  return (
    <div role="alertdialog" aria-label={`Confirmer la suppression de ${nombre} profil${nombre > 1 ? 's' : ''}`}
      className={`flex flex-col gap-3 rounded-controle border border-ligne p-4 sm:flex-row sm:items-center sm:justify-between ${className}`}>
      <p className="text-sm text-texte">
        {phraseSuppression(nombre)}
        <span className="block text-xs text-texte-pale">Cette suppression est définitive.</span>
      </p>
      <div className="flex shrink-0 gap-2">
        <Button variante="fantome" onClick={onAnnuler} disabled={enCours}>Annuler</Button>
        <Button icone={Trash2} chargement={enCours} onClick={onConfirmer}>{libelleConfirmer}</Button>
      </div>
    </div>
  )
}
