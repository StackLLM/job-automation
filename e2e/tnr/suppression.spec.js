/**
 * Lot L1.7 — Suppression des profils par l'utilisateur (décision D-11 : jamais automatique).
 * Sélection par cases à cocher, « Tout sélectionner » limité aux profils affichés, confirmation C-35.
 */
import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { simulerApi, erreursConsole } from '../fixtures/aides.js'

const NOMS = ['Amina Test', 'Youssef Essai', 'Salma Cloud', 'Karim DevOps', 'Nadia Data']
const profils = () => NOMS.map((nom, i) => ({
  id: `pr-${i + 1}`, urlNormalisee: `https://www.linkedin.com/in/${nom.toLowerCase().replace(' ', '-')}`, nom,
  poste: i % 2 ? 'Architecte AWS' : 'Ingénieure Cloud', entreprise: null, lieu: null, extrait: null, image: null,
  source: i < 3 ? 'n8n' : 'navigateur', rechercheId: null, createdAt: new Date(Date.now() - i * 1000).toISOString(),
}))
const liste = (page) => page.getByRole('list', { name: 'Liste des profils' })
const cocher = (page, nom) => page.getByRole('checkbox', { name: `Sélectionner ${nom}` }).check()

test('TF — sélectionner 3 profils, supprimer, actualiser : 3 de moins, partout', async ({ page }) => {
  const erreurs = erreursConsole(page)
  const api = await simulerApi(page, {}, { profils: profils() })
  await page.goto('./scraper')
  await expect(page.getByText('Profils (5)')).toBeVisible()

  for (const nom of NOMS.slice(0, 3)) await cocher(page, nom)
  await expect(page.getByText('3 sélectionnés')).toBeVisible()
  await page.getByRole('button', { name: 'Supprimer la sélection' }).click()
  const confirmation = page.getByRole('alertdialog', { name: 'Confirmer la suppression de 3 profils' })
  await expect(confirmation).toContainText('Supprimer les 3 profils, avec leurs notes et étiquettes ?')
  await confirmation.getByRole('button', { name: 'Supprimer la sélection' }).click()

  await expect(page.getByText('3 profils supprimés.')).toBeVisible()
  expect(api.vers('profils/supprimer')[0].corps.ids.sort()).toEqual(['pr-1', 'pr-2', 'pr-3'])

  await page.reload()
  await expect(page.getByText('Profils (2)')).toBeVisible()
  for (const nom of NOMS.slice(0, 3)) await expect(liste(page).getByText(nom)).toHaveCount(0)

  // Ni dans l'export CSV, ni dans la recherche globale, ni au dashboard.
  const [telechargement] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exporter CSV' }).click()])
  const csv = readFileSync(await telechargement.path(), 'utf8')
  for (const nom of NOMS.slice(0, 3)) expect(csv).not.toContain(nom)
  expect(csv).toContain('Karim DevOps')

  await page.getByLabel('Rechercher une page, un post ou un profil').fill('Amina')
  await expect(page.getByText('Aucun résultat pour « Amina »')).toBeVisible()

  await page.goto('./dashboard')
  await expect(page.getByText('Nadia Data').first()).toBeVisible()
  await expect(page.getByText('Salma Cloud')).toHaveCount(0)
  expect(erreurs).toEqual([])
})

test('« Annuler » ne supprime rien et garde la sélection', async ({ page }) => {
  const api = await simulerApi(page, {}, { profils: profils() })
  await page.goto('./scraper')
  await cocher(page, 'Amina Test')
  await page.getByRole('button', { name: 'Supprimer la sélection' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Annuler' }).click()
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
  await expect(page.getByText('1 sélectionné', { exact: true })).toBeVisible()
  expect(api.vers('profils/supprimer')).toHaveLength(0)
  await page.getByRole('button', { name: 'Désélectionner' }).click()
  await expect(page.getByRole('button', { name: 'Supprimer la sélection' })).toHaveCount(0)
})

test('« Tout sélectionner » ne prend que les profils affichés par le filtre', async ({ page }) => {
  const api = await simulerApi(page, {}, { profils: profils() })
  await page.goto('./scraper')
  // Un profil coché, puis caché par un filtre : il n'est pas supprimé en douce.
  await cocher(page, 'Nadia Data')
  await page.getByLabel('Source').selectOption('n8n')
  await page.getByRole('checkbox', { name: 'Tout sélectionner (3)' }).check()
  await expect(page.getByText('3 sélectionnés')).toBeVisible()
  await page.getByRole('button', { name: 'Supprimer la sélection' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Supprimer la sélection' }).click()
  await expect(page.getByText('3 profils supprimés.')).toBeVisible()
  expect(api.vers('profils/supprimer')[0].corps.ids.sort()).toEqual(['pr-1', 'pr-2', 'pr-3'])

  await page.getByLabel('Source').selectOption('')
  await expect(page.getByText('Profils (2)')).toBeVisible()
  await expect(liste(page).getByText('Nadia Data')).toBeVisible()
})

test('erreur du serveur : rien n’est retiré de la liste, message clair', async ({ page }) => {
  await simulerApi(page, { 'profils/supprimer': () => ({ status: 500, json: { error: 'Erreur lors de la suppression des profils' } }) }, { profils: profils() })
  await page.goto('./scraper')
  await cocher(page, 'Amina Test')
  await page.getByRole('button', { name: 'Supprimer la sélection' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Supprimer la sélection' }).click()
  await expect(page.getByText('Le serveur a rencontré un problème. Réessaie ; si cela continue, préviens l’administrateur.')).toBeVisible()
  await expect(page.getByText('Profils (5)')).toBeVisible()
})

test.describe('mobile (375 px)', () => {
  test.use({ viewport: { width: 375, height: 812 } })
  test('cases, barre de sélection et confirmation tiennent sans défilement horizontal', async ({ page }) => {
    await simulerApi(page, {}, { profils: profils() })
    await page.goto('./scraper')
    await cocher(page, 'Amina Test')
    await cocher(page, 'Youssef Essai')
    await page.getByRole('button', { name: 'Supprimer la sélection' }).click()
    await expect(page.getByRole('alertdialog')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
  })
})
