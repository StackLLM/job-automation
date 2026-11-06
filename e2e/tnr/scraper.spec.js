/**
 * TNR-GLOBAL 4 — Scraper : recherche par le backend (profils normalisés, lot L1.2), filtre, export CSV,
 * profils gardés sur le compte (lot L1.1) ; et webhook n8n réglé à la main dans Paramètres, appelé directement,
 * dont les profils sont ensuite enregistrés par le backend.
 */
import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { simulerApi, erreursConsole, lireStockage } from '../fixtures/aides.js'
import { PROFILS, PROFILS_NORMALISES, profilsDuCompte } from '../fixtures/donnees.js'

// Un texte dans la liste des profils (cartes C-33, lot L1.5).
const dansListe = (page, texte) => page.getByRole('list', { name: 'Liste des profils' }).getByText(texte, { exact: true })

test('lance une recherche, affiche, filtre, exporte et garde les profils', async ({ page }) => {
  const erreurs = erreursConsole(page)
  const api = await simulerApi(page)
  await page.goto('./scraper')

  await expect(page.getByText('Aucun profil pour l\'instant')).toBeVisible()
  await page.getByLabel('Requête').fill('ingenieur cloud')
  await page.getByLabel('Localisation').fill('casablanca')
  await page.getByLabel('Pages max').selectOption('2')
  await page.getByRole('button', { name: 'Lancer le scraper' }).click()

  await expect(page.getByText(`Recherche terminée : ${PROFILS_NORMALISES.length} nouveaux — source : n8n (Google)`)).toBeVisible()
  await expect(page.getByText('— source : n8n (Google)')).toBeVisible()
  await expect(page.getByText(`Profils (${PROFILS_NORMALISES.length})`)).toBeVisible()
  for (const p of PROFILS_NORMALISES) await expect(dansListe(page, p.nom)).toBeVisible()
  // Poste et entreprise séparés par le backend, réunis pour l'affichage actuel.
  await expect(dansListe(page, 'Ingénieure Cloud · Exemple SA')).toBeVisible()

  expect(api.vers('profils/rechercher')[0].corps).toEqual({ requete: 'ingenieur cloud', lieu: 'casablanca', pages: 2, idRecherche: expect.stringMatching(/^[0-9a-f-]{36}$/) })
  expect(api.vers('n8n/scraper')).toHaveLength(0)

  // Filtre local.
  await page.getByLabel('Filtrer les profils').fill('aws')
  await expect(dansListe(page, 'Youssef Essai')).toBeVisible()
  await expect(dansListe(page, 'Amina Test')).toHaveCount(0)
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
  await expect(dansListe(page, 'Ingénieure Cloud · Exemple SA')).toBeVisible()
  expect((await lireStockage(page)).state).not.toHaveProperty('scrapedProfiles')
  expect(erreurs).toEqual([])
})

test('L1.3 — relancer la même recherche n’ajoute aucun doublon', async ({ page }) => {
  const api = await simulerApi(page)
  await page.goto('./scraper')
  await page.getByRole('button', { name: 'Lancer le scraper' }).click()
  await expect(page.getByText(`Profils (${PROFILS_NORMALISES.length})`)).toBeVisible()
  await page.getByRole('button', { name: 'Lancer le scraper' }).click()
  await expect(page.getByText(`Recherche terminée : ${PROFILS_NORMALISES.length} déjà à jour — source : n8n (Google)`)).toBeVisible()
  await expect(page.getByText(`Profils (${PROFILS_NORMALISES.length})`)).toBeVisible()
  expect(api.serveur.profils).toHaveLength(PROFILS_NORMALISES.length)
})

test('« Vider » demande une confirmation, annulable, puis supprime les profils du compte', async ({ page }) => {
  const api = await simulerApi(page, {}, { profils: profilsDuCompte() })
  await page.goto('./scraper')
  await expect(page.getByText(`Profils (${PROFILS_NORMALISES.length})`)).toBeVisible()
  await page.getByRole('button', { name: 'Vider' }).click()
  const confirmation = page.getByRole('alertdialog', { name: `Confirmer la suppression de ${PROFILS_NORMALISES.length} profils` })
  await expect(confirmation).toContainText(`Supprimer les ${PROFILS_NORMALISES.length} profils, avec leurs notes et étiquettes ?`)
  await confirmation.getByRole('button', { name: 'Annuler' }).click()
  await expect(confirmation).toHaveCount(0)
  expect(api.vers('profils').filter((a) => a.methode === 'DELETE')).toHaveLength(0)
  await expect(page.getByText(`Profils (${PROFILS_NORMALISES.length})`)).toBeVisible()

  await page.getByRole('button', { name: 'Vider' }).click()
  await confirmation.getByRole('button', { name: 'Tout supprimer' }).click()
  await expect(page.getByText(`${PROFILS_NORMALISES.length} profils supprimés.`)).toBeVisible()
  await expect(page.getByText('Aucun profil pour l\'instant')).toBeVisible()
  expect(api.vers('profils').filter((a) => a.methode === 'DELETE')).toHaveLength(1)
  await page.reload()
  await expect(page.getByText('Aucun profil pour l\'instant')).toBeVisible()
})

test('signale les résultats ignorés faute de lien de profil valide', async ({ page }) => {
  await simulerApi(page, { 'profils/rechercher': () => ({ status: 200, json: { profils: PROFILS_NORMALISES.slice(0, 1), rejetes: 3, source: 'n8n', nouveaux: 1, misAJour: 0, inchanges: 0 } }) })
  await page.goto('./scraper')
  await page.getByRole('button', { name: 'Lancer le scraper' }).click()
  await expect(page.getByText('Recherche terminée : 1 nouveau, 3 rejetés — source : n8n (Google)')).toBeVisible()
})

test('indique le fournisseur de secours quand le premier a échoué', async ({ page }) => {
  await simulerApi(page, { 'profils/rechercher': () => ({ status: 200, json: { profils: PROFILS_NORMALISES, rejetes: 0, source: 'brave', secours: true, nouveaux: 2, misAJour: 0, inchanges: 0 } }) })
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

// Lot L1.6 : chaque erreur simulée donne un message différent et compréhensible, sans texte technique.
const ERREURS = [
  ['429 — trop de recherches', { status: 429, json: { error: 'Trop de requêtes, réessaie dans une minute.' } }, 'Trop de recherches en une minute. Attends un peu avant de relancer.'],
  ['403 — origine refusée', { status: 403, json: { error: 'Origine non autorisée.' } }, 'Le serveur a refusé la demande : cette page n’est pas autorisée à l’appeler.'],
  ['500 — serveur', { status: 500, json: { error: 'Les profils ont été trouvés mais n’ont pas pu être enregistrés.' } }, 'Le serveur a rencontré un problème. Réessaie ; si cela continue, préviens l’administrateur.'],
  ['502 — quota épuisé', { status: 502, json: { error: 'x', cause: 'quota' } }, 'Le quota des services de recherche est épuisé. Réessaie plus tard.'],
  ['502 — clé refusée', { status: 502, json: { error: 'x', cause: 'cle' } }, 'Le service de recherche refuse sa clé d’accès : elle est à vérifier dans la configuration du serveur.'],
  ['502 — source trop lente', { status: 502, json: { error: 'x', cause: 'delai' } }, 'Le service de recherche a mis trop de temps à répondre. Réessaie dans quelques minutes.'],
  ['502 — aucune source', { status: 502, json: { error: 'x', cause: 'indisponible' } }, 'Aucune source de profils n’a répondu. Réessaie dans quelques minutes.'],
]
for (const [cas, reponse, message] of ERREURS) {
  test(`erreur ${cas} : message clair, aucun profil ajouté`, async ({ page }) => {
    await simulerApi(page, { 'profils/rechercher': () => reponse })
    await page.goto('./scraper')
    await page.getByRole('button', { name: 'Lancer le scraper' }).click()
    await expect(page.getByText(message, { exact: true })).toBeVisible()
    await expect(page.getByText('Aucun profil pour l\'instant')).toBeVisible()
  })
}

test('erreur réseau : le serveur est injoignable', async ({ page }) => {
  await simulerApi(page)
  await page.route('**/api/profils/rechercher', (route) => route.abort('connectionrefused'))
  await page.goto('./scraper')
  await page.getByRole('button', { name: 'Lancer le scraper' }).click()
  await expect(page.getByText('Impossible de joindre le serveur. Vérifie ta connexion internet, puis réessaie.')).toBeVisible()
})

test('recherche longue : temps écoulé, squelettes, puis annulation sans erreur ni profil', async ({ page }) => {
  const api = await simulerApi(page, {}, {})
  let liberer
  let corpsRecherche
  await page.route('**/api/profils/rechercher', (route) => {
    corpsRecherche = route.request().postDataJSON()
    return new Promise((r) => { liberer = () => r(route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }).catch(() => {})) })
  })
  await page.goto('./scraper')
  await page.getByLabel('Pages max').selectOption('5')
  await page.getByRole('button', { name: 'Lancer le scraper' }).click()

  const attente = page.getByRole('status').filter({ hasText: 'Recherche en cours' })
  await expect(attente).toContainText('jusqu’à 5 pages')
  await expect(attente).toContainText(/[1-9] s/)
  await expect(page.getByRole('list', { name: 'Chargement des profils' })).toBeVisible()

  await page.getByRole('button', { name: 'Annuler la recherche' }).click()
  await expect(page.getByText('Recherche annulée : rien n’a été enregistré.')).toBeVisible()
  // Le backend est prévenu avec l'identifiant de la recherche (un proxy ne lui transmet pas toujours la coupure).
  const id = corpsRecherche.idRecherche
  expect(id).toMatch(/^[0-9a-f-]{36}$/)
  expect(api.vers('profils/annuler-recherche')[0].corps).toEqual({ idRecherche: id })
  await expect(attente).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Lancer le scraper' })).toBeEnabled()
  await expect(page.getByText('Aucun profil pour l\'instant')).toBeVisible()
  liberer?.()
  expect(api.serveur.profils).toHaveLength(0)
})

test('webhook réglé à la main en erreur : message qui renvoie à Paramètres', async ({ page }) => {
  const WEBHOOK = 'http://n8n-perso.test/webhook/scraper'
  await simulerApi(page, {}, { parametres: { scraperWebhook: WEBHOOK } })
  await page.route(WEBHOOK, (route) => route.fulfill({ status: 404, headers: { 'access-control-allow-origin': '*' }, body: 'Not found' }))
  await page.goto('./scraper')
  await page.getByRole('button', { name: 'Lancer le scraper' }).click()
  await expect(page.getByText('Ton webhook n8n a répondu par une erreur (code 404). Vérifie son adresse dans Paramètres.')).toBeVisible()
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
  for (const p of PROFILS_NORMALISES) await expect(dansListe(page, p.nom)).toBeVisible()
})

test('L1.3 — un profil retrouvé avec un nouveau poste est mis à jour, sans doublon', async ({ page }) => {
  const api = await simulerApi(page, {}, { profils: profilsDuCompte().map((p, i) => (i === 0 ? { ...p, poste: 'Ancien poste' } : p)) })
  await page.goto('./scraper')
  await expect(dansListe(page, 'Ancien poste · Exemple SA')).toBeVisible()
  await page.getByRole('button', { name: 'Lancer le scraper' }).click()
  await expect(page.getByText('Recherche terminée : 1 mis à jour, 1 déjà à jour — source : n8n (Google)')).toBeVisible()
  await expect(dansListe(page, 'Ingénieure Cloud · Exemple SA')).toBeVisible()
  await expect(page.getByText(`Profils (${PROFILS_NORMALISES.length})`)).toBeVisible()
  expect(api.serveur.profils).toHaveLength(PROFILS_NORMALISES.length)
})
