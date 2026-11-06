/**
 * cloneme: C-33 — Carte d'un profil dans la liste (lot L1.5) : photo, nom, poste · entreprise, lieu,
 * source, date de collecte, étiquettes. Toute la carte ouvre la fiche (C-34).
 * Lot L1.7 : avec onSelection, une case à cocher à gauche ajoute le profil à la sélection à supprimer.
 */
import { MapPin, StickyNote } from 'lucide-react'
import Badge from '@/components/ui/Badge'
import { libelleSource, dateCourte } from '@/lib/profils'

export function Avatar({ profil, grand = false }) {
  const taille = grand ? 'h-14 w-14 text-base' : 'h-10 w-10 text-xs'
  return profil.image ? (
    <img src={profil.image} alt="" className={`${taille} shrink-0 rounded-pilule object-cover`} />
  ) : (
    <span aria-hidden="true" className={`${taille} flex shrink-0 items-center justify-center rounded-pilule bg-sable font-semibold text-texte`}>
      {(profil.name || '?').charAt(0).toUpperCase()}
    </span>
  )
}

export default function CarteProfil({ profil, onOuvrir, selectionne = false, onSelection }) {
  const sousTitre = [profil.poste ?? profil.title, profil.entreprise].filter(Boolean).join(' · ')
  return (
    <li className="flex items-start">
      {onSelection && (
        <label className="flex shrink-0 cursor-pointer items-center self-stretch pl-3">
          <input type="checkbox" checked={selectionne} onChange={(e) => onSelection(profil, e.target.checked)}
            aria-label={`Sélectionner ${profil.name || 'ce profil'}`} className="h-4 w-4 accent-primaire" />
        </label>
      )}
      <button type="button" onClick={() => onOuvrir(profil)} aria-label={`Ouvrir la fiche de ${profil.name || 'ce profil'}`}
        className="flex w-full min-w-0 items-start gap-3 rounded-controle px-3 py-3 text-left transition-colors duration-rapide hover:bg-app focus-visible:bg-app focus-visible:outline-none focus-visible:shadow-focus">
        <Avatar profil={profil} />
        <span className="min-w-0 flex-1 space-y-1">
          <span className="flex min-w-0 items-baseline justify-between gap-3">
            <span className="truncate text-sm font-medium text-texte">{profil.name || 'Nom non renseigné'}</span>
            <span className="shrink-0 text-xs text-texte-pale">{dateCourte(profil.collecteLe ?? profil.createdAt)}</span>
          </span>
          <span className="block truncate text-xs text-texte-doux">{sousTitre || 'Poste non renseigné'}</span>
          <span className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {profil.lieu && (
              <span className="inline-flex items-center gap-1 text-xs text-texte-pale"><MapPin size={12} />{profil.lieu}</span>
            )}
            <Badge>{libelleSource(profil.source)}</Badge>
            {(profil.etiquettes || []).map((e) => <Badge key={e} ton="succes">{e}</Badge>)}
            {profil.note && <span className="inline-flex items-center text-texte-pale" title="Note"><StickyNote size={12} /><span className="sr-only">Avec une note</span></span>}
          </span>
        </span>
      </button>
    </li>
  )
}
