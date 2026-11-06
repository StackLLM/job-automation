/** Confirmation d'une suppression de profils (C-35, lot L1.7) : nombre affiché, annulation. */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ConfirmationSuppression from './ConfirmationSuppression'

const afficher = (props) => {
  const onConfirmer = vi.fn()
  const onAnnuler = vi.fn()
  render(<ConfirmationSuppression nombre={3} libelleConfirmer="Supprimer la sélection" onConfirmer={onConfirmer} onAnnuler={onAnnuler} {...props} />)
  return { onConfirmer, onAnnuler }
}

describe('ConfirmationSuppression', () => {
  it('rappelle le nombre de profils et dit que c’est définitif', () => {
    afficher()
    expect(screen.getByRole('alertdialog', { name: 'Confirmer la suppression de 3 profils' })).toBeInTheDocument()
    expect(screen.getByText('Supprimer les 3 profils, avec leurs notes et étiquettes ?')).toBeInTheDocument()
    expect(screen.getByText('Cette suppression est définitive.')).toBeInTheDocument()
  })

  it('un seul profil : au singulier', () => {
    afficher({ nombre: 1 })
    expect(screen.getByText('Supprimer ce profil, avec sa note et ses étiquettes ?')).toBeInTheDocument()
    expect(screen.getByRole('alertdialog', { name: 'Confirmer la suppression de 1 profil' })).toBeInTheDocument()
  })

  it('« Annuler » n’appelle pas la suppression', () => {
    const { onConfirmer, onAnnuler } = afficher()
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(onAnnuler).toHaveBeenCalledOnce()
    expect(onConfirmer).not.toHaveBeenCalled()
  })

  it('le bouton de confirmation supprime ; pendant la suppression, rien n’est cliquable deux fois', () => {
    const { onConfirmer } = afficher()
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer la sélection' }))
    expect(onConfirmer).toHaveBeenCalledOnce()
  })

  it('en cours : les deux boutons sont désactivés', () => {
    afficher({ enCours: true })
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Supprimer la sélection/ })).toBeDisabled()
  })
})
