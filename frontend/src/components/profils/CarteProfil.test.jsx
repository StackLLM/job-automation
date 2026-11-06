/** Carte d'un profil (C-33, lot L1.5) : profil complet, sans image, sans poste, nom très long. */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CarteProfil from './CarteProfil'

const COMPLET = {
  id: 'p-1', name: 'Amina Test', title: 'Ingénieure Cloud · Exemple SA', poste: 'Ingénieure Cloud', entreprise: 'Exemple SA',
  lieu: 'Rabat', link: 'https://www.linkedin.com/in/amina-test', image: 'https://media.exemple.test/a.jpg', source: 'serper',
  etiquettes: ['recruteur', 'cloud'], note: 'Relancer', createdAt: '2026-10-20T10:00:00Z', collecteLe: '2026-10-31T10:00:00Z',
}
const afficher = (profil, onOuvrir = () => {}) => render(<ul><CarteProfil profil={profil} onOuvrir={onOuvrir} /></ul>)

describe('CarteProfil', () => {
  it('profil complet : nom, poste · entreprise, lieu, source, date de collecte, étiquettes, note, photo', () => {
    const { container } = afficher(COMPLET)
    expect(screen.getByText('Amina Test')).toBeInTheDocument()
    expect(screen.getByText('Ingénieure Cloud · Exemple SA')).toBeInTheDocument()
    expect(screen.getByText('Rabat')).toBeInTheDocument()
    expect(screen.getByText('Serper (Google)')).toBeInTheDocument()
    expect(screen.getByText('31 oct. 2026')).toBeInTheDocument()
    expect(screen.getByText('recruteur')).toBeInTheDocument()
    expect(screen.getByText('Avec une note')).toBeInTheDocument()
    expect(container.querySelector('img')).toHaveAttribute('src', COMPLET.image)
  })

  it('sans image : l’initiale du nom', () => {
    const { container } = afficher({ ...COMPLET, image: null })
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('A')).toBeInTheDocument()
  })

  it('sans poste ni entreprise ni lieu : « non renseigné », pas de case vide', () => {
    afficher({ ...COMPLET, title: null, poste: null, entreprise: null, lieu: null, etiquettes: [], note: null })
    expect(screen.getByText('Poste non renseigné')).toBeInTheDocument()
    expect(screen.queryByText('Rabat')).toBeNull()
    expect(screen.queryByText('Avec une note')).toBeNull()
  })

  it('nom très long : coupé à l’affichage, entier pour les lecteurs d’écran', () => {
    const long = 'Amina '.repeat(30).trim()
    afficher({ ...COMPLET, name: long })
    expect(screen.getByText(long)).toHaveClass('truncate')
    expect(screen.getByRole('button', { name: `Ouvrir la fiche de ${long}` })).toBeInTheDocument()
  })

  it('un clic ouvre la fiche de ce profil', () => {
    const onOuvrir = vi.fn()
    afficher(COMPLET, onOuvrir)
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir la fiche de Amina Test' }))
    expect(onOuvrir).toHaveBeenCalledWith(COMPLET)
  })
})
