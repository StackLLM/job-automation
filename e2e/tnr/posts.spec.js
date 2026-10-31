/** TNR-GLOBAL 1 à 3 — Générateur de posts : génération, ressources, visuel et export PNG. */
import { test, expect } from '@playwright/test'
import { simulerApi, erreursConsole } from '../fixtures/aides.js'
import { RESSOURCES } from '../fixtures/donnees.js'

test.describe('TNR 1 — génération d’un post', () => {
  test('envoie le formulaire au backend, affiche le post et le garde dans l’historique', async ({ page }) => {
    const erreurs = erreursConsole(page)
    const api = await simulerApi(page)
    await page.goto('./posts')

    await page.getByLabel('Type de post').selectOption('Storytelling')
    await page.getByLabel('Description').fill('Ma veille LinkedIn automatisée avec n8n')
    await page.getByLabel('Technologies').fill('n8n, Express')
    await page.getByLabel('Ton').selectOption('Humain')
    await page.getByRole('button', { name: 'Générer le post' }).click()

    await expect(page.getByText('Post généré !')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Post généré' })).toBeVisible()
    await expect(page.locator('textarea').last()).toHaveValue(/J’ai automatisé ma veille LinkedIn/)
    await expect(page.getByText('Historique (1)')).toBeVisible()

    expect(api.vers('posts/generate')).toHaveLength(1)
    expect(api.vers('posts/generate')[0].corps).toEqual({
      type: 'Storytelling', description: 'Ma veille LinkedIn automatisée avec n8n', tech: 'n8n, Express', tone: 'Humain',
    })

    // Lot L0.7 : le post est gardé dans le compte, et relu depuis le serveur après actualisation.
    expect(api.serveur.posts[0]).toMatchObject({ type: 'Storytelling', model: 'deepseek' })
    await page.reload()
    await expect(page.getByText('Historique (1)')).toBeVisible()
    expect(erreurs).toEqual([])
  })

  test('refuse une description vide sans appeler le backend', async ({ page }) => {
    const api = await simulerApi(page)
    await page.goto('./posts')
    await page.getByRole('button', { name: 'Générer le post' }).click()
    await expect(page.getByText('Décris ton projet ou ton sujet.')).toBeVisible()
    expect(api.vers('posts/generate')).toHaveLength(0)
  })

  test('affiche l’erreur du backend quand la génération échoue', async ({ page }) => {
    await simulerApi(page, { 'posts/generate': () => ({ status: 502, json: { error: 'Erreur OpenRouter : Modèle indisponible' } }) })
    await page.goto('./posts')
    await page.getByLabel('Description').fill('Un sujet')
    await page.getByRole('button', { name: 'Générer le post' }).click()
    await expect(page.getByText(/Erreur: .*Modèle indisponible/)).toBeVisible()
    await expect(page.getByText('Historique (0)')).toBeVisible()
  })
})

// Génère un post simulé, point de départ des parcours 2 et 3.
async function genererUnPost(page) {
  await page.goto('./posts')
  await page.getByLabel('Description').fill('Ma veille LinkedIn automatisée avec n8n')
  await page.getByLabel('Technologies').fill('n8n')
  await page.getByRole('button', { name: 'Générer le post' }).click()
  await expect(page.getByRole('heading', { name: 'Post généré' })).toBeVisible()
}

test('TNR 2 — ressources : documentation et conseils du post', async ({ page }) => {
  const erreurs = erreursConsole(page)
  const api = await simulerApi(page)
  await genererUnPost(page)

  await page.getByRole('button', { name: 'Trouver des ressources' }).click()

  await expect(page.getByText('Ressources trouvées !')).toBeVisible()
  await expect(page.getByRole('tab', { name: `Ressources (${RESSOURCES.documents.length})` })).toBeVisible()
  for (const doc of RESSOURCES.documents) {
    await expect(page.getByRole('link', { name: new RegExp(doc.title) })).toHaveAttribute('href', doc.url)
  }
  for (const conseil of RESSOURCES.tips) await expect(page.getByText(conseil)).toBeVisible()

  const appel = api.vers('n8n/resource-suggestions')[0]
  expect(appel.corps).toMatchObject({ tech: 'n8n', type: 'Projet technique' })
  expect(appel.corps.post).toContain('J’ai automatisé ma veille LinkedIn')
  expect(erreurs).toEqual([])
})

test('TNR 3 — visuel IA : génération dans l’iframe isolée puis export PNG', async ({ page }) => {
  const erreurs = erreursConsole(page)
  const api = await simulerApi(page)
  await genererUnPost(page)

  await page.getByRole('tab', { name: 'Visuel IA' }).click()
  await page.getByRole('button', { name: 'Générer le visuel' }).click()

  await expect(page.getByText('Visuel généré !')).toBeVisible()
  await expect(page.getByText('Architecture', { exact: true })).toBeVisible()
  const iframe = page.locator('iframe[title="Visuel LinkedIn"]')
  await expect(iframe).toHaveAttribute('sandbox', 'allow-scripts')
  await expect(page.frameLocator('iframe[title="Visuel LinkedIn"]').getByText('Visuel de test')).toBeVisible()
  expect(api.vers('n8n/generate-visual')).toHaveLength(1)

  const [telechargement] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'PNG' }).click(),
  ])
  expect(telechargement.suggestedFilename()).toMatch(/^linkedin-visual-\d+\.png$/)
  const chemin = await telechargement.path()
  const { readFileSync } = await import('node:fs')
  const octets = readFileSync(chemin)
  expect(octets.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a') // signature PNG
  expect(octets.length).toBeGreaterThan(1000)
  await expect(page.getByText('PNG téléchargé !')).toBeVisible()
  // Comportement actuel connu : html-to-image ne peut pas lire la feuille de police Google (autre domaine)
  // et le dit dans la console. L'export n'en est pas affecté ; toute autre erreur fait échouer le test.
  const CONNUES = /^Error (inlining remote css file|while reading CSS rules from https:\/\/fonts\.googleapis\.com)/
  expect(erreurs.filter((e) => !CONNUES.test(e))).toEqual([])
})
