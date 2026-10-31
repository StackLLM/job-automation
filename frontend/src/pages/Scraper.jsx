/** cloneme: P-03 — Scraper LinkedIn : recherche via le backend (profils normalisés), ou webhook n8n réglé à la main ; profils gardés sur le compte (lot L1.1) ; filtre, export CSV. */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import axios from 'axios'
import { ScanSearch, Download, Trash2, UsersRound, Settings, CircleCheck, CircleAlert, Search } from 'lucide-react'
import useAppStore from '../store/useAppStore'
import { avecActivite } from '../store/useActiviteStore'
import { exporterProfilsCsv } from '../lib/exportCsv'
import { rechercherProfils, enregistrerLotProfils } from '../services/api'
import Page from '../components/ui/Page'
import { Card, CardHeader } from '../components/ui/Card'
import { Field, Input, Select } from '../components/ui/Field'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'
import TableProfils from '../components/scraper/TableProfils'

const envScraperWebhook = import.meta.env.VITE_N8N_SCRAPER_WEBHOOK || ''

// Nom affiché du fournisseur qui a répondu ; « secours » quand un fournisseur précédent a échoué.
const SOURCES = { serper: 'Serper (Google)', brave: 'Brave', n8n: 'n8n (Google)' }
const libelleSource = (source, secours) => `${SOURCES[source] || source}${secours ? ' (secours)' : ''}`
// « (3 déjà dans ta liste) » quand une partie des profils était déjà sur le compte.
const mentionDejaLa = (dejaLa) => (dejaLa ? ` (${dejaLa} déjà dans ta liste)` : '')

// Par défaut, la recherche passe par le backend, qui choisit le fournisseur et normalise les profils.
// Un webhook réglé dans Paramètres (ou VITE_N8N_SCRAPER_WEBHOOK) est appelé directement, comme avant.

const parseMaybeJson = (value) => {
  if (typeof value !== 'string') return value

  const text = value.trim()
  if (!text) return []

  try {
    return JSON.parse(text)
  } catch {
    return value
  }
}

const findProfiles = (data) => {
  const parsed = parseMaybeJson(data)

  if (Array.isArray(parsed)) return parsed
  if (Array.isArray(parsed?.data)) return parsed.data
  if (Array.isArray(parsed?.profiles)) return parsed.profiles
  if (Array.isArray(parsed?.items)) return parsed.items
  if (Array.isArray(parsed?.results)) return parsed.results

  const nestedOutput = parseMaybeJson(parsed?.output || parsed?.text || parsed?.message)
  if (Array.isArray(nestedOutput)) return nestedOutput
  if (Array.isArray(nestedOutput?.data)) return nestedOutput.data
  if (Array.isArray(nestedOutput?.profiles)) return nestedOutput.profiles

  return []
}

export default function Scraper() {
  const navigate = useNavigate()
  const { scrapedProfiles, rechargerProfils, viderProfils, settings } = useAppStore()
  const webhookPerso = settings.scraperWebhook?.trim() || envScraperWebhook
  // Toujours vrai, comme avant le lot L1.2 : le backend sert de source par défaut. Le badge reste affiché ;
  // l'écran du scraper est repris aux lots L1.5 et L1.6.
  const hasScraperWebhook = true

  const [form, setForm] = useState({
    query: 'ingenieur cloud maroc',
    location: 'maroc',
    maxPages: 1,
  })
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('')

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
  }

  // Recherche par le backend : profils déjà normalisés, rejets comptés.
  const lancerParBackend = async () => {
    try {
      const { profils, rejetes, source, secours, dejaLa } = await avecActivite(rechercherProfils({
        requete: form.query, lieu: form.location, pages: Number(form.maxPages),
      }))
      if (profils.length > 0) {
        await rechargerProfils()
        toast.success(`${profils.length} profils recuperes !${mentionDejaLa(dejaLa)}${rejetes ? ` (${rejetes} ignorés : lien de profil invalide)` : ''} — source : ${libelleSource(source, secours)}`)
      } else {
        toast(rejetes ? `Aucun profil exploitable : ${rejetes} résultats sans lien de profil valide.` : 'Aucun profil trouvé pour cette recherche.', { icon: '!' })
      }
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleLaunch = async () => {
    setLoading(true)
    if (!webhookPerso) {
      await lancerParBackend()
      setLoading(false)
      return
    }

    // Webhook réglé à la main : appel direct et lecture souple de la réponse, comme avant le lot L1.2.
    const scraperWebhook = webhookPerso
    try {
      const prompt = `scrape linkedin ${form.query} ${form.location} maxPages:${form.maxPages}`
      const res = await avecActivite(axios.post(
        scraperWebhook,
        {
          query: form.query,
          location: form.location,
          maxPages: Number(form.maxPages),
          message: prompt,
          chatInput: prompt,
        },
        {
          responseType: 'text',
          transformResponse: [(data) => data],
          timeout: 120000,
        }
      ))

      console.log('Reponse n8n:', res.data)

      const profiles = findProfiles(res.data)

      if (profiles.length > 0) {
        // Les profils du webhook passent aussi par le backend, qui les valide et les garde sur le compte.
        const { nouveaux, dejaLa, rejetes } = await enregistrerLotProfils({ profils: profiles, requete: form.query, lieu: form.location })
        await rechargerProfils()
        if (nouveaux + dejaLa > 0) toast.success(`${nouveaux + dejaLa} profils recuperes !${mentionDejaLa(dejaLa)}`)
        else toast(`Aucun profil exploitable : ${rejetes} résultats sans lien de profil valide.`, { icon: '!' })
      } else {
        toast("n8n a repondu, mais aucun profil exploitable n'a ete retourne.", { icon: '!' })
        console.log('Data brute:', res.data)
      }
    } catch (err) {
      console.error('Erreur:', err)
      if (err.response?.status) {
        toast.error(`Erreur n8n ${err.response.status}: verifie l'URL du webhook.`)
      } else if (err.message.includes('Network Error')) {
        toast.error('Erreur reseau/CORS: le webhook n8n doit autoriser cette app.')
      } else {
        toast.error(`Erreur: ${err.message}`)
      }
    } finally {
      setLoading(false)
    }
  }

  const filtered = scrapedProfiles.filter((p) => {
    const q = filter.toLowerCase()
    return (
      p.name?.toLowerCase().includes(q) ||
      p.title?.toLowerCase().includes(q) ||
      p.snippet?.toLowerCase().includes(q)
    )
  })

  return (
    <Page
      surtitre="Prospection"
      titre="Scraper LinkedIn"
      description="Récupère des profils LinkedIn publics via ton workflow n8n (Google Custom Search)."
    >
      <Card className="space-y-5">
        <CardHeader
          titre="Lancer le scraper"
          marge={false}
          action={hasScraperWebhook
            ? <Badge ton="succes" icone={CircleCheck}>n8n configuré</Badge>
            : <Badge ton="attention" icone={CircleAlert}>Webhook à configurer</Badge>}
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Requête" htmlFor="query">
            <Input id="query" name="query" value={form.query} onChange={handleChange} placeholder="ex: ingenieur cloud maroc" />
          </Field>
          <Field label="Localisation" htmlFor="location">
            <Input id="location" name="location" value={form.location} onChange={handleChange} placeholder="maroc, casablanca..." />
          </Field>
          <Field label="Pages max" htmlFor="maxPages">
            <Select id="maxPages" name="maxPages" value={form.maxPages} onChange={handleChange}>
              <option value={1}>1 page (10 profils)</option>
              <option value={2}>2 pages (20 profils)</option>
              <option value={5}>5 pages (50 profils)</option>
              <option value={10}>10 pages (100 profils)</option>
            </Select>
          </Field>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button icone={ScanSearch} chargement={loading} onClick={handleLaunch}>
            {loading ? 'Scraping en cours…' : 'Lancer le scraper'}
          </Button>
          {!hasScraperWebhook && (
            <Button variante="secondaire" icone={Settings} onClick={() => navigate('/settings')}>Configurer le webhook</Button>
          )}
          {scrapedProfiles.length > 0 && (
            <>
              <Button variante="secondaire" icone={Download} onClick={() => exporterProfilsCsv(scrapedProfiles)}>
                Exporter CSV
              </Button>
              <Button variante="fantome" icone={Trash2} onClick={() => viderProfils().then(() => toast.success('Profils supprimes'), (err) => toast.error(err.message))}>
                Vider
              </Button>
            </>
          )}
        </div>
      </Card>

      <Card>
        {scrapedProfiles.length > 0 ? (
          <>
            <CardHeader
              titre={`Profils (${scrapedProfiles.length})`}
              action={
                <div className="flex h-9 w-full max-w-[220px] items-center gap-2 rounded-pilule border border-ligne bg-surface px-3 focus-within:border-accent focus-within:shadow-focus">
                  <Search size={14} className="shrink-0 text-texte-pale" />
                  <input
                    className="min-w-0 flex-1 bg-transparent text-xs text-texte placeholder:text-texte-pale focus:outline-none"
                    placeholder="Filtrer…"
                    aria-label="Filtrer les profils"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  />
                </div>
              }
            />
            {filtered.length > 0 ? (
              <TableProfils profils={filtered} />
            ) : (
              <EmptyState icone={Search} titre="Aucun profil ne correspond" texte={`Rien pour « ${filter} ».`}
                action={<Button petit variante="secondaire" onClick={() => setFilter('')}>Effacer le filtre</Button>} />
            )}
          </>
        ) : (
          !loading && (
            <EmptyState icone={UsersRound} titre="Aucun profil pour l'instant" texte="Lance le scraper pour voir les profils ici." />
          )
        )}
        {loading && scrapedProfiles.length === 0 && (
          <div className="space-y-2" aria-label="Chargement des profils">
            {[0, 1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded-controle bg-surface-douce" />)}
          </div>
        )}
      </Card>
    </Page>
  )
}
