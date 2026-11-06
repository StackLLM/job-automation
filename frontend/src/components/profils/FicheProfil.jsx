/**
 * cloneme: C-34 — Fiche d'un profil (lot L1.5) : panneau à droite, plein écran sur mobile.
 * Toutes les informations enregistrées, l'extrait complet, l'historique de collecte, la note libre,
 * les étiquettes, et les actions : ouvrir sur LinkedIn, copier le lien, supprimer (confirmé dans le panneau).
 * Échap ou le voile ferment la fiche.
 */
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { X, ExternalLink, Copy, Trash2, Save, Plus, MapPin, Building2, BriefcaseBusiness } from 'lucide-react'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { Avatar } from './CarteProfil'
import ConfirmationSuppression from './ConfirmationSuppression'
import useAppStore from '@/store/useAppStore'
import { libelleSource, libelleRecherche, dateCourte, nouvelleEtiquette, ETIQUETTES_MAX } from '@/lib/profils'

const NOTE_MAX = 2000

function Ligne({ icone: Icone, children }) {
  return (
    <p className="flex min-w-0 items-start gap-2 text-sm text-texte-doux">
      <Icone size={15} className="mt-0.5 shrink-0 text-texte-pale" />
      <span className="min-w-0 break-words">{children}</span>
    </p>
  )
}

function Section({ titre, children }) {
  return (
    <section className="space-y-2 border-t border-ligne pt-4">
      <h3 className="libelle">{titre}</h3>
      {children}
    </section>
  )
}

export default function FicheProfil({ profil, onFermer }) {
  const recherches = useAppStore((s) => s.recherches)
  const modifierProfil = useAppStore((s) => s.modifierProfil)
  const supprimerProfil = useAppStore((s) => s.supprimerProfil)

  const [note, setNote] = useState(profil.note ?? '')
  const [saisie, setSaisie] = useState('')
  const [enregistrement, setEnregistrement] = useState(false)
  const [confirmer, setConfirmer] = useState(false)
  const [suppression, setSuppression] = useState(false)
  const fermer = useRef(null)

  // Ouverture : le focus va au bouton de fermeture ; Échap ferme.
  useEffect(() => {
    fermer.current?.focus()
    const touche = (e) => { if (e.key === 'Escape') onFermer() }
    window.addEventListener('keydown', touche)
    return () => window.removeEventListener('keydown', touche)
  }, [onFermer])

  const recherche = recherches.find((r) => r.id === profil.rechercheId)
  const etiquettes = profil.etiquettes || []
  const noteModifiee = (note.trim() || null) !== (profil.note ?? null)

  const enregistrer = async (partiel, message) => {
    setEnregistrement(true)
    try {
      await modifierProfil(profil.id, partiel)
      if (message) toast.success(message)
      return true
    } catch (err) {
      toast.error(err.message)
      return false
    } finally {
      setEnregistrement(false)
    }
  }

  const ajouterEtiquette = async (e) => {
    e.preventDefault()
    const etiquette = nouvelleEtiquette(saisie, etiquettes)
    if (!etiquette) { setSaisie(''); return }
    if (await enregistrer({ etiquettes: [...etiquettes, etiquette] })) setSaisie('')
  }

  const copierLien = async () => {
    try {
      await navigator.clipboard.writeText(profil.link)
      toast.success('Lien copié')
    } catch {
      toast.error('Copie impossible : sélectionne le lien à la main.')
    }
  }

  const supprimer = async () => {
    setSuppression(true)
    try {
      await supprimerProfil(profil.id)
      toast.success('Profil supprimé')
      onFermer()
    } catch (err) {
      toast.error(err.message)
      setSuppression(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-voile" onClick={onFermer} aria-hidden="true" />
      <aside role="dialog" aria-modal="true" aria-labelledby="fiche-profil-titre"
        className="relative flex h-full w-full flex-col bg-surface shadow-flottante sm:max-w-md">
        <header className="flex items-start gap-3 border-b border-ligne p-5">
          <Avatar profil={profil} grand />
          <div className="min-w-0 flex-1">
            <h2 id="fiche-profil-titre" className="break-words text-base font-semibold text-texte">{profil.name || 'Nom non renseigné'}</h2>
            <p className="mt-0.5 text-xs text-texte-pale">{libelleSource(profil.source)}</p>
          </div>
          <button ref={fermer} type="button" onClick={onFermer} aria-label="Fermer la fiche"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pilule text-texte-doux transition-colors duration-rapide hover:bg-surface-douce focus-visible:outline-none focus-visible:shadow-focus">
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <div className="space-y-1.5">
            <Ligne icone={BriefcaseBusiness}>{profil.poste ?? profil.title ?? 'Poste non renseigné'}</Ligne>
            <Ligne icone={Building2}>{profil.entreprise || 'Entreprise non renseignée'}</Ligne>
            <Ligne icone={MapPin}>{profil.lieu || 'Lieu non renseigné'}</Ligne>
          </div>

          <div className="flex flex-wrap gap-2">
            {profil.link && (
              <a href={profil.link} target="_blank" rel="noreferrer" className="btn-secondaire">
                <ExternalLink size={16} /> Ouvrir sur LinkedIn
              </a>
            )}
            {profil.link && <Button variante="secondaire" icone={Copy} onClick={copierLien}>Copier le lien</Button>}
          </div>

          <Section titre="Extrait">
            <p className="whitespace-pre-line break-words text-sm leading-relaxed text-texte-doux">{profil.snippet || 'Aucun extrait.'}</p>
          </Section>

          <Section titre="Étiquettes">
            {etiquettes.length > 0 ? (
              <ul className="flex flex-wrap gap-1.5" aria-label="Étiquettes du profil">
                {etiquettes.map((e) => (
                  <li key={e}>
                    <Badge ton="succes">
                      {e}
                      <button type="button" disabled={enregistrement} aria-label={`Retirer l’étiquette ${e}`}
                        onClick={() => enregistrer({ etiquettes: etiquettes.filter((x) => x !== e) })}
                        className="-mr-0.5 rounded-pilule hover:text-texte focus-visible:outline-none focus-visible:shadow-focus">
                        <X size={12} />
                      </button>
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-texte-pale">Aucune étiquette.</p>
            )}
            {etiquettes.length < ETIQUETTES_MAX && (
              <form onSubmit={ajouterEtiquette} className="flex gap-2">
                <Input aria-label="Nouvelle étiquette" value={saisie} onChange={(e) => setSaisie(e.target.value)}
                  maxLength={30} placeholder="recruteur, à relancer…" className="min-w-0 flex-1" />
                <Button type="submit" variante="secondaire" icone={Plus} disabled={!saisie.trim() || enregistrement}>Ajouter</Button>
              </form>
            )}
          </Section>

          <Section titre="Note">
            <Field htmlFor="note-profil" aide={`${note.length} / ${NOTE_MAX}`}>
              <Textarea id="note-profil" aria-label="Note sur ce profil" className="min-h-28" maxLength={NOTE_MAX}
                value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ce que tu veux retenir de ce contact…" />
            </Field>
            <Button icone={Save} chargement={enregistrement} disabled={!noteModifiee}
              onClick={() => enregistrer({ note }, 'Note enregistrée')}>
              Enregistrer la note
            </Button>
          </Section>

          <Section titre="Historique de collecte">
            <dl className="grid grid-cols-[130px_1fr] gap-x-3 gap-y-1.5 text-sm">
              <dt className="text-texte-pale">Ajouté le</dt><dd className="text-texte">{dateCourte(profil.createdAt)}</dd>
              <dt className="text-texte-pale">Dernière collecte</dt><dd className="text-texte">{dateCourte(profil.collecteLe ?? profil.createdAt)}</dd>
              <dt className="text-texte-pale">Recherche d’origine</dt>
              <dd className="break-words text-texte">{recherche ? libelleRecherche(recherche) : 'Aucune (import ou recherche supprimée)'}</dd>
            </dl>
          </Section>
        </div>

        <footer className="border-t border-ligne p-5">
          {confirmer ? (
            <ConfirmationSuppression nombre={1} libelleConfirmer="Confirmer la suppression" enCours={suppression}
              onConfirmer={supprimer} onAnnuler={() => setConfirmer(false)} className="border-0 p-0" />
          ) : (
            <Button variante="fantome" icone={Trash2} onClick={() => setConfirmer(true)}>Supprimer ce profil</Button>
          )}
        </footer>
      </aside>
    </div>
  )
}
