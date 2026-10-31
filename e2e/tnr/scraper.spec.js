/**
 * TNR-GLOBAL 4 — Scraper : recherche par le backend (profils normalisés, lot L1.2), filtre, export CSV,
 * profils gardés sur le compte (lot L1.1) ; et webhook n8n réglé à la main dans Paramètres, appelé directement,
 * dont les profils sont ensuite enregistrés par le backend.
 */
import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { simulerApi, erreursConsole, lireStockage } from '../fixtures/aides.js'
import { PROFILS, PROFILS_NORMALISES, profilsDuCompte } from '../fixtures/donnees.js'

test('lance une recherche, affiche, filtre, exporte et garde les profils', async ({ page }) => {
  const erreurs = erreursConsole(page)
  const api = await simulerApi(page)
  await page.goto('./scraper')

  await expect(page.getByText('Aucun profil pour l\'instant')).toBeVisible()
  await page.getByLabel('Requête').fill('ingenieur cloud')
  await page.getByLabel('Localisation').fill('casablanca')
  await page.getByLabel('Pages max').selectOption('2')
  await page.getByRole('button', { name: 'Lancer le scraper' }).click()

  await expect(page.getByText(`${PROFILS_NORMALISES.length} profils recuperes !`)).toBeVisible()
  await expect(page.getByText('— source : n8n (Google)')).toBeVisible()
  await expect(page.getByText(`Profils (${PROFILS_NORMALISES.length})`)).toBeVisible()
  for (const p of PROFILS_NORMALISES) await expect(page.getByRole('cell', { name: p.nom })).toBeVisible()
  // Poste et entreprise séparés par le backend, réunis pour l'affichage actuel.
  await expect(page.getByRole('cell', { name: 'Ingénieure Cloud · Exemple SA' })).toBeVisible()

  expect(api.vers('profils/rechercher')[0].corps).toEqual({ requete: 'ingenieur cloud', lieu: 'casablanca', pages: 2 })
  expect(api.vers('n8n/scraper')).toHaveLength(0)

  // Filtre local.
  await page.getByLabel('Filtrer les profils').fill('aws')
  await expect(page.getByRole('cell', { name: 'Youssef Essai' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Amina Test' })).toHaveCount(0)
  await page.getByLabel('Filtrer les profils').fill('')

  // Export CSV : tous les profils, pas seulement ceux filtrés.
  const [telechargement] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exporter CSV' }).click(),
  ])
  expect(telechargement.suggestedFilename()).toMatch(/\.csv$/)
  const csv = readFileSync(await telechargement.path(), 'utf8')
  for (const p of PROFILS_NORMALISES) {
    expect(csv).toContain(p.nom)
    expect(csv).toContain(p.urlNormalisee)
  }

  // Lot L1.1 : les profils sont sur le compte, relus après actualisation ; le navigateur n'en garde plus.
  expect(api.serveur.profils).toHaveLength(PROFILS_NORMALISES.length)
  await page.reload()
  await expect(page.getByText(`Profils (${PROFILS_NORMALISES.length})`)).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Ingénieure Cloud · Exemple SA' })).toBeVisible()
  expect((await lireStockage(page)).state).not.toHaveProperty('scrapedProfiles')
  expect(erreurs).toEqual([])
})

test('relancer la même recherche n’ajoute aucun doublon', async ({ page }) => {
  const api = await simulerApi(page)
  await page.goto('./scraper')
  await page.getByRole('button', { name: 'Lancer le scraper' }).click()
  await expect(page.getByText(`Profils (${PROFILS_NORMALISES.length})`)).toBeVisible()
  await page.getByRole('button', { name: 'Lancer le scraper' }).click()
  await expect(page.getByText(`(${PROFILS_NORMALISES.length} déjà dans ta liste)`)).toBeVisible()
  await expect(page.getByText(`Profils (${PROFILS_NORMALISES.length})`)).toBeVisible()
  expect(api.serveur.profils).toHaveLength(PROFILS_NORMALISES.length)
})

test('« Vider » supprime les profils du compte', async ({ page }) => {
  const api = await simulerApi(page, {}, { profils: profilsDuCompte() })
  await page.goto('./scraper')
  await expect(page.getByText(`Profils (${PROFILS_NORMALISES.length})`)).toBeVisible()
  await page.getByRole('button', { name: 'Vider' }).click()
  await expect(page.getByText('Aucun profil pour l\'instant')).toBeVisible()
  expect(api.vers('profils').filter((a) => a.methode === 'DELETE')).toHaveLength(1)
  await page.reload()
  await expect(page.getByText('Aucun profil pour l\'instant')).toBeVisible()
})

test('signale les résultats ignorés faute de lien de profil valide', async ({ page }) => {
  await simulerApi(page, { 'profils/rechercher': () => ({ status: 200, json: { profils: PROFILS_NORMALISES.slice(0, 1), rejetes: 3, source: 'n8n' } }) })
  await page.goto('./scraper')
  await page.getByRole('button', { name: 'Lancer le scraper' }).click()
  await expect(page.getByText('1 profils recuperes ! (3 ignorés : lien de profil invalide)')).toBeVisible()
})

test('indique le fournisseur de secours quand le premier a échoué', async ({ page }) => {
  await simulerApi(page, { 'profils/rechercher': () => ({ status: 200, json: { profils: PROFILS_NORMALISES, rejetes: 0, source: 'brave', secours: true } }) })
  await page.goto('./scraper')
  await page.getByRole('button', { name: 'Lancer le scraper' }).click()
  await expect(page.getByText('— source : Brave (secours)')).toBeVisible()
})

test('dit quand aucun profil n’est trouvé', async ({ page }) => {
  await simulerApi(page, { 'profils/rechercher': () => ({ status: 200, json: { profils: [], rejetes: 0, source: 'n8n' } }) })
  await page.goto('./scraper')
  await page.getByRole('button', { name: 'Lancer le scraper' }).click()
  await expect(page.getByText('Aucun profil trouvé pour cette recherche.')).toBeVisible()
  await expect(page.getByText('Aucun profil pour l\'instant')).toBeVisible()
})

test('signale une erreur du backend sans ajouter de profil', async ({ page }) => {
  await simulerApi(page, { 'profils/rechercher': () => ({ status: 502, json: { error: 'La recherche de profils a échoué : aucun fournisseur n’a répondu.' } }) })
  await page.goto('./scraper')
  await page.getByRole('button', { name: 'Lancer le scraper' }).click()
  await expect(page.getByText('La recherche de profils a échoué : aucun fournisseur n’a répondu.')).toBeVisible()
  await expect(page.getByText('Aucun profil pour l\'instant')).toBeVisible()
})

test('un webhook réglé dans Paramètres est appelé directement, sans passer par le backend', async ({ page }) => {
  const WEBHOOK = 'http://n8n-perso.test/webhook/scraper'
  const api = await simulerApi(page, {}, { parametres: { scraperWebhook: WEBHOOK } })
  const appelsWebhook = []
  await page.route(WEBHOOK, (route) => {
    appelsWebhook.push(route.request().postDataJSON())
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ profiles: PROFILS }) })
  })
  await page.goto('./scraper')
  await page.getByRole('button', { name: 'Lancer le scraper' }).click()

  await expect(page.getByText(`Profils (${PROFILS.length})`)).toBeVisible()
  expect(appelsWebhook).toHaveLength(1)
  expect(appelsWebhook[0]).toMatchObject({ query: 'ingenieur cloud maroc', location: 'maroc', maxPages: 1 })
  expect(api.vers('profils/rechercher')).toHaveLength(0)
  // Les profils du webhook sont gardés sur le compte par le backend.
  expect(api.vers('profils/lot')[0].corps).toMatchObject({ requete: 'ingenieur cloud maroc', lieu: 'maroc', profils: PROFILS })
  expect(api.serveur.profils.map((p) => p.source)).toEqual(['webhook', 'webhook'])
})

test('TF L1.1 — recherche, actualisation, déconnexion, reconnexion : les mêmes profils', async ({ page }) => {
  await simulerApi(page)
  await page.goto('./scraper')
  await page.getByRole('button', { name: 'Lancer le scraper' }).click()
  await expect(page.getByText(`Profils (${PROFILS_NORMALISES.length})`)).toBeVisible()

  await page.reload()
  await expect(page.getByText(`Profils (${PROFILS_NORMALISES.length})`)).toBeVisible()

  await page.goto('./settings')
  await page.getByRole('button', { name: 'Se déconnecter' }).click()
  await expect(page).toHaveURL(/\/connexion$/)
  await page.getByLabel('E-mail').fill('amina@exemple.test')
  await page.getByLabel('Mot de passe').fill('mot-de-passe-solide-1')
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)

  await page.goto('./scraper')
  await expect(page.getByText(`Profils (${PROFILS_NORMALISES.length})`)).toBeVisible()
  for (const p of PROFILS_NORMALISES) await expect(page.getByRole('cell', { name: p.nom })).toBeVisible()
})
