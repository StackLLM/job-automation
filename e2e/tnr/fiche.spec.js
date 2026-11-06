/**
 * Lot L1.5 — Liste détaillée et fiche profil : tri, filtres, note, étiquettes, suppression, mobile.
 * Le serveur des profils est simulé (fixtures/aides.js) ; le vrai est testé dans backend/test/profilsCompte.test.js.
 */
import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { simulerApi, erreursConsole } from '../fixtures/aides.js'
import { profilsDuCompte, RECHERCHES } from '../fixtures/donnees.js'

const liste = (page) => page.getByRole('list', { name: 'Liste des profils' })
const fiche = (page) => page.getByRole('dialog')
const ouvrir = (page, nom) => liste(page).getByRole('button', { name: `Ouvrir la fiche de ${nom}` }).click()
const preparer = (page, options = {}) => simulerApi(page, {}, { profils: profilsDuCompte(), recherches: RECHERCHES, ...options })

test('TF — ouvrir une fiche, ajouter une note, actualiser : la note est là', async ({ page }) => {
  const erreurs = erreursConsole(page)
  const api = await preparer(page)
  await page.goto('./scraper')
  await ouvrir(page, 'Amina Test')
  await expect(page).toHaveURL(/\?profil=pr-1$/)

  await fiche(page).getByLabel('Note sur ce profil').fill('Rencontrée au meetup cloud, relancer en janvier.')
  await fiche(page).getByRole('button', { name: 'Enregistrer la note' }).click()
  await expect(page.getByText('Note enregistrée')).toBeVisible()
  expect(api.vers('profils/pr-1').at(-1)).toMatchObject({ methode: 'PATCH', corps: { note: 'Rencontrée au meetup cloud, relancer en janvier.' } })

  await page.reload()
  await expect(fiche(page)).toBeVisible()
  await expect(fiche(page).getByLabel('Note sur ce profil')).toHaveValue('Rencontrée au meetup cloud, relancer en janvier.')
  expect(erreurs).toEqual([])
})

test('la fiche montre toutes les données enregistrées, et « non renseigné » sinon', async ({ page }) => {
  await preparer(page)
  await page.goto('./scraper')
  await ouvrir(page, 'Amina Test')
  const f = fiche(page)
  await expect(f.getByRole('heading', { name: 'Amina Test' })).toBeVisible()
  await expect(f.getByText('Ingénieure Cloud', { exact: true })).toBeVisible()
  await expect(f.getByText('Exemple SA')).toBeVisible()
  await expect(f.getByText('Lieu non renseigné')).toBeVisible()
  await expect(f.getByText('Cloud, Kubernetes, Casablanca')).toBeVisible()
  await expect(f.getByText('n8n (Google)')).toBeVisible()
  await expect(f.getByText('ingenieur cloud — maroc (31 oct. 2026)')).toBeVisible()
  await expect(f.getByRole('link', { name: 'Ouvrir sur LinkedIn' })).toHaveAttribute('href', 'https://www.linkedin.com/in/amina-test')

  await page.keyboard.press('Escape')
  await expect(fiche(page)).toHaveCount(0)
  await expect(page).not.toHaveURL(/profil=/)

  await ouvrir(page, 'Youssef Essai')
  await expect(fiche(page).getByText('Entreprise non renseignée')).toBeVisible()
})

test('étiquettes : ajout, filtre, retrait ; gardées après actualisation et dans l’export CSV', async ({ page }) => {
  const api = await preparer(page)
  await page.goto('./scraper')
  await ouvrir(page, 'Amina Test')
  await fiche(page).getByLabel('Nouvelle étiquette').fill('recruteur')
  await fiche(page).getByLabel('Nouvelle étiquette').press('Enter')
  await expect(fiche(page).getByRole('list', { name: 'Étiquettes du profil' }).getByText('recruteur')).toBeVisible()
  // Une étiquette en double (casse ignorée) n'est pas ajoutée.
  await fiche(page).getByLabel('Nouvelle étiquette').fill('RECRUTEUR')
  await fiche(page).getByRole('button', { name: 'Ajouter' }).click()
  await expect(fiche(page).getByLabel('Nouvelle étiquette')).toHaveValue('')
  expect(api.serveur.profils[0].etiquettes).toEqual(['recruteur'])

  await page.keyboard.press('Escape')
  await page.getByLabel('Étiquette').selectOption('recruteur')
  await expect(liste(page).getByRole('listitem')).toHaveCount(1)
  await expect(liste(page).getByText('Amina Test')).toBeVisible()

  const [telechargement] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exporter CSV' }).click()])
  const csv = readFileSync(await telechargement.path(), 'utf8')
  expect(csv.split('\n')[0]).toBe('Nom,Titre,Lien,Snippet,Note,Etiquettes')
  expect(csv).toContain('"recruteur"')

  await page.reload()
  await page.getByLabel('Étiquette').selectOption('recruteur')
  await ouvrir(page, 'Amina Test')
  await fiche(page).getByRole('button', { name: 'Retirer l’étiquette recruteur' }).click()
  await expect(fiche(page).getByText('Aucune étiquette.')).toBeVisible()
  expect(api.serveur.profils[0].etiquettes).toEqual([])
})

test('tri par nom et filtres par source et recherche d’origine', async ({ page }) => {
  await preparer(page, { profils: [...profilsDuCompte(), { urlNormalisee: 'https://www.linkedin.com/in/brahim', nom: 'Brahim Import', poste: 'DevOps', entreprise: null, lieu: null, extrait: null, image: null, source: 'navigateur', id: 'pr-9', rechercheId: null, createdAt: '2026-01-01T00:00:00.000Z' }] })
  await page.goto('./scraper')
  const noms = () => liste(page).locator('li .truncate.font-medium').allTextContents()
  await expect(liste(page).getByRole('listitem')).toHaveCount(3)

  await page.getByLabel('Trier par').selectOption('nom')
  expect(await noms()).toEqual(['Amina Test', 'Brahim Import', 'Youssef Essai'])

  await page.getByLabel('Source').selectOption('navigateur')
  expect(await noms()).toEqual(['Brahim Import'])
  await page.getByLabel('Source').selectOption('')

  await page.getByLabel('Recherche', { exact: true }).selectOption('r-1')
  expect(await noms()).toEqual(['Amina Test', 'Youssef Essai'])
  await page.getByLabel('Filtrer les profils').fill('zzz')
  await page.getByRole('button', { name: 'Effacer les filtres' }).click()
  await expect(liste(page).getByRole('listitem')).toHaveCount(3)
})

test('supprimer depuis la fiche : annulable, puis définitif', async ({ page }) => {
  const api = await preparer(page)
  await page.goto('./scraper')
  await ouvrir(page, 'Youssef Essai')
  await fiche(page).getByRole('button', { name: 'Supprimer ce profil' }).click()
  await fiche(page).getByRole('button', { name: 'Annuler' }).click()
  expect(api.vers('profils/pr-2')).toHaveLength(0)

  await fiche(page).getByRole('button', { name: 'Supprimer ce profil' }).click()
  await fiche(page).getByRole('button', { name: 'Confirmer la suppression' }).click()
  await expect(page.getByText('Profil supprimé')).toBeVisible()
  await expect(fiche(page)).toHaveCount(0)
  await expect(page.getByText('Profils (1)')).toBeVisible()
  await page.reload()
  await expect(page.getByText('Profils (1)')).toBeVisible()
  await expect(liste(page).getByText('Youssef Essai')).toHaveCount(0)
})

test.describe('mobile (375 px)', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('liste et fiche lisibles, sans défilement horizontal ; la fiche prend tout l’écran', async ({ page }) => {
    await preparer(page, { profils: profilsDuCompte().map((p, i) => (i === 0 ? { ...p, nom: 'Amina '.repeat(12).trim(), etiquettes: ['recruteur', 'cloud', 'à relancer'] } : p)) })
    await page.goto('./scraper')
    await expect(liste(page)).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)

    await liste(page).getByRole('button').first().click()
    const boite = await fiche(page).boundingBox()
    expect(boite.width).toBe(375)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
    await expect(fiche(page).getByRole('button', { name: 'Fermer la fiche' })).toBeFocused()
  })
})
