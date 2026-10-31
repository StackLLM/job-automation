/**
 * Lot L0.7 — Reprise des données du navigateur.
 * Un navigateur utilisé avant les comptes (stockage version 0) garde des posts et des paramètres :
 * l'app les met de côté, propose de les importer, et ne les efface qu'après un import réussi.
 */
import { test, expect } from '@playwright/test'
import { simulerApi, erreursConsole, prechargerNavigateur, lireAImporter, lireStockage } from '../fixtures/aides.js'
import { etatAncienNavigateur } from '../fixtures/donnees.js'

const bandeau = (page) => page.getByRole('region', { name: 'Données du navigateur à importer' })

test('TF — un navigateur préparé : importer, puis les mêmes chiffres au dashboard', async ({ page }) => {
  const erreurs = erreursConsole(page)
  const api = await simulerApi(page)
  await prechargerNavigateur(page, etatAncienNavigateur())
  await page.goto('./dashboard')

  // Avant : le compte est vide, le navigateur garde 2 posts et des paramètres, mis de côté.
  await expect(bandeau(page)).toContainText('Ce navigateur garde 2 posts et tes paramètres')
  await expect(page.getByText('Aucun post généré')).toBeVisible()
  expect((await lireAImporter(page)).posts).toHaveLength(2)
  const stockage = await lireStockage(page)
  expect(stockage.version).toBe(1)
  expect(stockage.state).not.toHaveProperty('posts')
  expect(stockage.state.scrapedProfiles).toHaveLength(2)

  await bandeau(page).getByRole('button', { name: 'Importer' }).click()
  await expect(page.getByText('2 posts importés.')).toBeVisible()
  await expect(bandeau(page)).toHaveCount(0)

  // Après : les posts sont dans le compte et au dashboard ; le navigateur n'a plus rien à importer.
  await expect(page.getByText('Mon pipeline Terraform en production').first()).toBeVisible()
  await expect(page.getByText('Ma première mission cloud').first()).toBeVisible()
  expect(await lireAImporter(page)).toBeNull()
  expect(api.vers('compte/import-local')).toHaveLength(1)
  expect(api.vers('compte/import-local')[0].corps.settings).toEqual({ defaultTone: 'Startup', scraperWebhook: '' })

  await page.reload()
  await expect(page.getByText('Mon pipeline Terraform en production').first()).toBeVisible()
  await expect(bandeau(page)).toHaveCount(0)
  expect(erreurs).toEqual([])
})

test('relancer l’import n’ajoute aucun doublon', async ({ page }) => {
  const api = await simulerApi(page)
  const etat = etatAncienNavigateur()
  await prechargerNavigateur(page, etat)
  await page.goto('./posts')
  await bandeau(page).getByRole('button', { name: 'Importer' }).click()
  await expect(page.getByText('Historique (2)')).toBeVisible()

  // Le même contenu revient (autre navigateur, autre sauvegarde) : rien de nouveau.
  await page.evaluate(([cle, valeur]) => window.localStorage.setItem(cle, valeur), ['linkedai-a-importer', JSON.stringify({ posts: etat.state.posts, settings: null })])
  await page.reload()
  await bandeau(page).getByRole('button', { name: 'Importer' }).click()
  await expect(page.getByText('2 déjà dans ton compte.')).toBeVisible()
  await expect(page.getByText('Historique (2)')).toBeVisible()
  expect(api.serveur.posts).toHaveLength(2)
})

test('« Plus tard » cache le bandeau sans rien effacer', async ({ page }) => {
  const api = await simulerApi(page)
  await prechargerNavigateur(page, etatAncienNavigateur())
  await page.goto('./dashboard')
  await bandeau(page).getByRole('button', { name: 'Plus tard' }).click()
  await expect(bandeau(page)).toHaveCount(0)
  expect(await lireAImporter(page)).not.toBeNull()
  expect(api.vers('compte/import-local')).toHaveLength(0)

  await page.reload()
  await expect(bandeau(page)).toBeVisible()
})

test('un import qui échoue garde les données du navigateur', async ({ page }) => {
  await simulerApi(page, { 'compte/import-local': () => ({ status: 500, json: { error: 'L’import des données du navigateur a échoué. Rien n’a été effacé.' } }) })
  await prechargerNavigateur(page, etatAncienNavigateur())
  await page.goto('./dashboard')
  await bandeau(page).getByRole('button', { name: 'Importer' }).click()
  await expect(page.getByText(/Import impossible : .*Rien n’a été effacé/)).toBeVisible()
  await expect(bandeau(page)).toBeVisible()
  expect((await lireAImporter(page)).posts).toHaveLength(2)
})

test('un navigateur neuf ne propose rien', async ({ page }) => {
  await simulerApi(page)
  await page.goto('./dashboard')
  await expect(page.getByText('Aucun post généré')).toBeVisible()
  await expect(bandeau(page)).toHaveCount(0)
})
