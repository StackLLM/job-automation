// Préparation commune des tests : assertions DOM (toBeInTheDocument…) et nettoyage du rendu entre deux tests.
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => cleanup())

// Node 25 et plus a son propre localStorage, inutilisable sans --localstorage-file, qui masque celui de jsdom.
// Un stockage en mémoire le remplace dans ce cas (en CI, Node 22 garde celui de jsdom).
if (typeof window.localStorage?.clear !== 'function') {
  const donnees = new Map()
  const stockage = {
    getItem: (cle) => (donnees.has(cle) ? donnees.get(cle) : null),
    setItem: (cle, valeur) => { donnees.set(cle, String(valeur)) },
    removeItem: (cle) => { donnees.delete(cle) },
    clear: () => donnees.clear(),
    key: (i) => [...donnees.keys()][i] ?? null,
    get length() { return donnees.size },
  }
  Object.defineProperty(window, 'localStorage', { value: stockage, configurable: true })
}
