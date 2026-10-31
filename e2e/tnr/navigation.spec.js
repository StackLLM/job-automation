/** TNR-GLOBAL 5 à 9 — Dashboard, recherche globale, paramètres, 404, mobile, et toutes les routes. */
import { test, expect } from '@playwright/test'
import { simulerApi, erreursConsole, prechargerNavigateur } from '../fixtures/aides.js'
import { etatNavigateur, postsDuCompte, PROFILS } from '../fixtures/donnees.js'

test.describe('TNR 5 — dashboard', () => {
  test('montre les états vides sur un navigateur neuf', async ({ page }) => {
    const erreurs = erreursConsole(page)
    await simulerApi(page)
    await page.goto('./dashboard')
    await expect(page.getByText('Aucun post généré')).toBeVisible()
    await expect(page.getByText('Aucun profil scrapé')).toBeVisible()
    expect(erreurs).toEqual([])
  })

  test('reflète les posts du compte et les profils du navigateur', async ({ page }) => {
    const erreurs = erreursConsole(page)
    await simulerApi(page, {}, { posts: postsDuCompte() })
    await prechargerNavigateur(page, etatNavigateur())
    await page.goto('./dashboard')

    await expect(page.getByText('Mon pipeline Terraform en production').first()).toBeVisible()
    await expect(page.getByText('Ma première mission cloud').first()).toBeVisible()
    for (const p of PROFILS) await expect(page.getByText(p.name).first()).toBeVisible()
    await expect(page.getByText('Profils scrapés')).toBeVisible()
    await expect(page.getByText('Aucun post généré')).toHaveCount(0)
    expect(erreurs).toEqual([])
  })
})

test.describe('TNR 6 — recherche globale', () => {
  test('ouvre une page au clavier', async ({ page }) => {
    await simulerApi(page)
    await page.goto('./dashboard')
    const champ = page.getByLabel('Rechercher une page, un post ou un profil')
    await champ.fill('scraper')
    await champ.press('Enter')
    await expect(page).toHaveURL(/\/scraper$/)
    await expect(page.getByRole('heading', { name: 'Scraper LinkedIn' })).toBeVisible()
  })

  test('trouve un post de l’historique et l’ouvre dans le générateur', async ({ page }) => {
    await simulerApi(page, {}, { posts: postsDuCompte() })
    await prechargerNavigateur(page, etatNavigateur())
    await page.goto('./dashboard')
    await page.getByLabel('Rechercher une page, un post ou un profil').fill('terraform')
    await page.getByRole('button', { name: 'Mon pipeline Terraform en production Projet technique', exact: true }).click()
    await expect(page).toHaveURL(/\/posts$/)
    await expect(page.locator('textarea').last()).toHaveValue(/Mon pipeline Terraform en production/)
  })

  test('dit quand rien ne correspond', async ({ page }) => {
    await simulerApi(page)
    await page.goto('./dashboard')
    await page.getByLabel('Rechercher une page, un post ou un profil').fill('zzzintrouvable')
    await expect(page.getByText('Aucun résultat pour « zzzintrouvable »')).toBeVisible()
  })
})

test('TNR 7 — paramètres : le ton par défaut est gardé et repris par le générateur', async ({ page }) => {
  const erreurs = erreursConsole(page)
  const api = await simulerApi(page)
  await page.goto('./settings')

  await page.getByLabel('Ton par défaut').selectOption('Startup')
  await page.getByRole('button', { name: 'Sauvegarder' }).click()
  await expect(page.getByText('Paramètres sauvegardés !')).toBeVisible()

  await page.reload()
  await expect(page.getByLabel('Ton par défaut')).toHaveValue('Startup')
  expect(api.serveur.parametres.defaultTone).toBe('Startup')
  expect(api.vers('compte/parametres').filter((a) => a.methode === 'PUT')).toHaveLength(1)

  await page.goto('./posts')
  await expect(page.getByLabel('Ton')).toHaveValue('Startup')
  expect(erreurs).toEqual([])
})

test('TNR 8 — page 404 et retour au dashboard', async ({ page }) => {
  await simulerApi(page)
  await page.goto('./adresse-qui-n-existe-pas')
  await expect(page.getByText('Page introuvable')).toBeVisible()
  await page.getByRole('button', { name: 'Retour au dashboard' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
})

test.describe('TNR 9 — mobile (375 px)', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('barre de navigation en bas, sans défilement horizontal, sur chaque page', async ({ page }) => {
    const erreurs = erreursConsole(page)
    await simulerApi(page, {}, { posts: postsDuCompte() })
    await prechargerNavigateur(page, etatNavigateur())
    await page.goto('./dashboard')

    const nav = page.getByRole('navigation', { name: 'Navigation principale' })
    await expect(nav).toBeVisible()
    for (const court of ['Accueil', 'Posts', 'Scraper', 'Lettre', 'Offres', 'Réglages']) {
      await nav.getByRole('link', { name: court }).click()
      const largeur = await page.evaluate(() => document.documentElement.scrollWidth)
      expect(largeur, `défilement horizontal sur « ${court} »`).toBeLessThanOrEqual(375)
    }
    await expect(page).toHaveURL(/\/settings$/)
    expect(erreurs).toEqual([])
  })
})

test('toutes les routes de la navigation s’ouvrent depuis la sidebar', async ({ page }) => {
  const erreurs = erreursConsole(page)
  await simulerApi(page)
  await page.goto('./dashboard')

  const pages = [
    ['Générateur de posts', /\/posts$/, 'Générateur de posts'],
    ['Scraper LinkedIn', /\/scraper$/, 'Scraper LinkedIn'],
    ['Lettre de motivation', /\/lettre$/, 'Adaptation de lettre de motivation'],
    ["Offres d'emploi", /\/offres$/, "Recherche d'offres intelligente"],
    ['Paramètres', /\/settings$/, 'Paramètres'],
    ['Dashboard', /\/dashboard$/, null],
  ]
  const nav = page.getByRole('navigation', { name: 'Navigation principale' })
  for (const [lien, url, titre] of pages) {
    await nav.getByRole('link', { name: lien }).click()
    await expect(page).toHaveURL(url)
    if (titre) await expect(page.getByRole('heading', { name: titre }).first()).toBeVisible()
  }
  expect(erreurs).toEqual([])
})
