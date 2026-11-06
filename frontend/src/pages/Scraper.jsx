/** cloneme: P-03 — Scraper LinkedIn : recherche via le backend (profils normalisés), ou webhook n8n réglé à la main ; profils gardés sur le compte (lot L1.1) ; liste triée et filtrée, fiche profil (lot L1.5), sélection à supprimer (lot L1.7), export CSV. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import axios from 'axios'
import { ScanSearch, Download, Trash2, UsersRound, Settings, CircleCheck, CircleAlert, Search, X } from 'lucide-react'
import useAppStore from '../store/useAppStore'
import { avecActivite } from '../store/useActiviteStore'
import { exporterProfilsCsv } from '../lib/exportCsv'
import { rechercherProfils, enregistrerLotProfils, annulerRecherche } from '../services/api'
import { bilanRecherche, profilsGardes } from '../lib/bilanRecherche'
import { messageErreurRecherche, messageErreurWebhook, pagesDemandees } from '../lib/messagesRecherche'
import Page from '../components/ui/Page'
import { Card, CardHeader } from '../components/ui/Card'
import { Field, Input, Select } from '../components/ui/Field'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'
import CarteProfil from '../components/profils/CarteProfil'
import FicheProfil from '../components/profils/FicheProfil'
import ConfirmationSuppression from '../components/profils/ConfirmationSuppression'
import { TRIS, trierProfils, filtrerProfils, etiquettesDe, sourcesDe, libelleSource as libelleSourceProfil, libelleRecherche } from '../lib/profils'

const envScraperWebhook = import.meta.env.VITE_N8N_SCRAPER_WEBHOOK || ''

// Nom affiché du fournisseur qui a répondu ; « secours » quand un fournisseur précédent a échoué.
const SOURCES = { serper: 'Serper (Google)', brave: 'Brave', n8n: 'n8n (Google)' }
const libelleSource = (source, secours) => `${SOURCES[source] || source}${secours ? ' (secours)' : ''}`

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
  const { scrapedProfiles, recherches, rechargerProfils, viderProfils, supprimerProfils, settings } = useAppStore()
  const webhookPerso = settings.scraperWebhook?.trim() || envScraperWebhook
  // Toujours vrai, comme avant le lot L1.2 : le backend sert de source par défaut. Le badge reste affiché.
  const hasScraperWebhook = true

  const [form, setForm] = useState({
    query: 'ingenieur cloud maroc',
    location: 'maroc',
    maxPages: 1,
  })
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('')
  // Tri et filtres de la liste (lot L1.5).
  const [tri, setTri] = useState('collecte')
  const [filtres, setFiltres] = useState({ rechercheId: '', source: '', etiquette: '' })
  const changerFiltre = (e) => setFiltres((f) => ({ ...f, [e.target.name]: e.target.value }))

  // Fiche ouverte : dans l'adresse (?profil=<id>), pour la retrouver après actualisation.
  const [parametres, setParametres] = useSearchParams()
  const profilOuvert = scrapedProfiles.find((p) => p.id && p.id === parametres.get('profil'))
  const ouvrirFiche = (p) => setParametres((prev) => { const n = new URLSearchParams(prev); n.set('profil', p.id); return n })
  const fermerFiche = useCallback(() => setParametres((prev) => { const n = new URLSearchParams(prev); n.delete('profil'); return n }), [setParametres])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
  }

  // Lot L1.6 : la recherche en cours peut être annulée ; l'écran d'attente montre le temps écoulé.
  const controleur = useRef(null)
  const idRecherche = useRef(null)
  const [debut, setDebut] = useState(null)
  const [secondes, setSecondes] = useState(0)
  useEffect(() => {
    if (!debut) return undefined
    const minuteur = setInterval(() => setSecondes(Math.floor((Date.now() - debut) / 1000)), 1000)
    return () => clearInterval(minuteur)
  }, [debut])
  const annuler = () => {
    // Le backend est prévenu en plus : derrière un proxy, il ne voit pas toujours la connexion se couper.
    if (idRecherche.current) annulerRecherche(idRecherche.current).catch(() => {})
    controleur.current?.abort()
  }

  // Une erreur → un message clair ; une annulation n'est pas une erreur.
  const signaler = ({ message, annulee }) => (annulee ? toast(message, { icon: 'ℹ' }) : toast.error(message))

  const signalerResultat = (bilan, { source, secours } = {}) => {
    if (profilsGardes(bilan) > 0) {
      // Lot L1.3 : « 3 nouveaux, 2 mis à jour, 5 déjà à jour, 1 rejeté ».
      toast.success(`Recherche terminée : ${bilanRecherche(bilan)}${source ? ` — source : ${libelleSource(source, secours)}` : ''}`)
    } else if (bilan.rejetes) {
      toast(`Aucun profil exploitable : ${bilan.rejetes} résultats sans lien de profil valide.`, { icon: '!' })
    } else {
      toast('Aucun profil trouvé pour cette recherche.', { icon: '!' })
    }
  }

  // Recherche par le backend : profils normalisés, rejets comptés, enregistrés sur le compte.
  const lancerParBackend = async (signal) => {
    try {
      const resultat = await avecActivite(rechercherProfils({
        requete: form.query, lieu: form.location, pages: Number(form.maxPages), idRecherche: idRecherche.current,
      }, { signal }))
      if (resultat.profils.length > 0) await rechargerProfils()
      signalerResultat(resultat, resultat)
    } catch (err) {
      signaler(messageErreurRecherche(err))
    }
  }

  // Webhook réglé à la main : appel direct et lecture souple de la réponse, puis enregistrement par le backend.
  const lancerParWebhook = async (signal) => {
    let reponse
    try {
      const prompt = `scrape linkedin ${form.query} ${form.location} maxPages:${form.maxPages}`
      reponse = await avecActivite(axios.post(
        webhookPerso,
        { query: form.query, location: form.location, maxPages: Number(form.maxPages), message: prompt, chatInput: prompt },
        { responseType: 'text', transformResponse: [(data) => data], timeout: 120000, signal }
      ))
    } catch (err) {
      signaler(messageErreurWebhook(err))
      return
    }

    const profiles = findProfiles(reponse.data)
    if (profiles.length === 0) {
      toast('Ton webhook n8n a répondu, mais sans aucun profil exploitable.', { icon: '!' })
      return
    }
    try {
      const bilan = await enregistrerLotProfils({ profils: profiles, requete: form.query, lieu: form.location })
      await rechargerProfils()
      signalerResultat(bilan)
    } catch (err) {
      signaler(messageErreurRecherche(err))
    }
  }

  const handleLaunch = async () => {
    controleur.current = new AbortController()
    idRecherche.current = crypto.randomUUID()
    setLoading(true)
    setSecondes(0)
    setDebut(Date.now())
    try {
      await (webhookPerso ? lancerParWebhook : lancerParBackend)(controleur.current.signal)
    } finally {
      controleur.current = null
      idRecherche.current = null
      setDebut(null)
      setLoading(false)
    }
  }

  // « Vider » demande une confirmation (lot L1.6) : la suppression est définitive.
  // Suppressions (lots L1.6 et L1.7) : toujours confirmées (C-35), jamais automatiques (D-11).
  const [confirmation, setConfirmation] = useState(null) // null, « tout » ou « selection »
  const [suppressionEnCours, setSuppressionEnCours] = useState(false)
  const annoncerSuppression = (n) => toast.success(`${n} profil${n > 1 ? 's' : ''} supprimé${n > 1 ? 's' : ''}.`)
  const supprimer = async (action) => {
    setSuppressionEnCours(true)
    try {
      annoncerSuppression(await action())
      setSelection(new Set())
    } catch (err) {
      signaler(messageErreurRecherche(err))
    } finally {
      setSuppressionEnCours(false)
      setConfirmation(null)
    }
  }
  const vider = () => supprimer(async () => { const n = scrapedProfiles.length; await viderProfils(); return n })

  // Sélection : seulement des profils encore dans la liste.
  const [selection, setSelection] = useState(() => new Set())
  const choisir = useCallback((p, coche) => setSelection((avant) => {
    const apres = new Set(avant)
    if (coche) apres.add(p.id); else apres.delete(p.id)
    return apres
  }), [])
  const supprimerSelection = () => supprimer(() => supprimerProfils(selectionVisible))

  const filtered = useMemo(
    () => trierProfils(filtrerProfils(scrapedProfiles, { texte: filter, ...filtres }), tri),
    [scrapedProfiles, filter, filtres, tri]
  )
  const etiquettes = useMemo(() => etiquettesDe(scrapedProfiles), [scrapedProfiles])
  const sources = useMemo(() => sourcesDe(scrapedProfiles), [scrapedProfiles])
  // Sélection limitée aux profils affichés : un filtre qui en cache ne les supprime pas en douce.
  const selectionVisible = useMemo(() => filtered.filter((p) => selection.has(p.id)).map((p) => p.id), [filtered, selection])
  const tousVisiblesChoisis = filtered.length > 0 && selectionVisible.length === filtered.length
  const choisirVisibles = (coche) => setSelection(coche ? new Set(filtered.map((p) => p.id).filter(Boolean)) : new Set())
  const filtreActif = Boolean(filter || filtres.rechercheId || filtres.source || filtres.etiquette)
  const effacerFiltres = () => { setFilter(''); setFiltres({ rechercheId: '', source: '', etiquette: '' }) }

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
            {loading ? 'Recherche en cours…' : 'Lancer le scraper'}
          </Button>
          {!hasScraperWebhook && (
            <Button variante="secondaire" icone={Settings} onClick={() => navigate('/settings')}>Configurer le webhook</Button>
          )}
          {scrapedProfiles.length > 0 && (
            <>
              <Button variante="secondaire" icone={Download} onClick={() => exporterProfilsCsv(scrapedProfiles)}>
                Exporter CSV
              </Button>
              <Button variante="fantome" icone={Trash2} onClick={() => setConfirmation('tout')} disabled={confirmation === 'tout'}>
                Vider
              </Button>
            </>
          )}
        </div>

        {/* Attente (lot L1.6) : n8n reçoit toutes les pages en un appel, l'avancement page par page n'est pas connu. */}
        {loading && (
          <div role="status" className="flex flex-col gap-3 rounded-controle bg-surface-douce p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-texte">
              Recherche en cours — {pagesDemandees(form.maxPages)} · <span className="tabular-nums">{secondes} s</span>
              <span className="block text-xs text-texte-pale">Une page prend en général quelques secondes ; au-delà de deux minutes, la recherche s’arrête.</span>
            </p>
            <Button variante="secondaire" icone={X} onClick={annuler}>Annuler la recherche</Button>
          </div>
        )}

        {confirmation === 'tout' && (
          <ConfirmationSuppression nombre={scrapedProfiles.length} libelleConfirmer="Tout supprimer" enCours={suppressionEnCours}
            onConfirmer={vider} onAnnuler={() => setConfirmation(null)} />
        )}
      </Card>

      <Card>
        {scrapedProfiles.length > 0 ? (
          <>
            <CardHeader
              titre={`Profils (${scrapedProfiles.length})`}
              action={
                <div className="flex h-9 w-full max-w-[150px] items-center sm:max-w-[220px] gap-2 rounded-pilule border border-ligne bg-surface px-3 focus-within:border-accent focus-within:shadow-focus">
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
            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Field label="Trier par" htmlFor="tri">
                <Select id="tri" value={tri} onChange={(e) => setTri(e.target.value)}>
                  {TRIS.map((t) => <option key={t.id} value={t.id}>{t.libelle}</option>)}
                </Select>
              </Field>
              <Field label="Recherche" htmlFor="rechercheId">
                <Select id="rechercheId" name="rechercheId" value={filtres.rechercheId} onChange={changerFiltre}>
                  <option value="">Toutes</option>
                  {recherches.map((r) => <option key={r.id} value={r.id}>{libelleRecherche(r)}</option>)}
                </Select>
              </Field>
              <Field label="Source" htmlFor="source">
                <Select id="source" name="source" value={filtres.source} onChange={changerFiltre}>
                  <option value="">Toutes</option>
                  {sources.map((s) => <option key={s} value={s}>{libelleSourceProfil(s)}</option>)}
                </Select>
              </Field>
              <Field label="Étiquette" htmlFor="etiquette">
                <Select id="etiquette" name="etiquette" value={filtres.etiquette} onChange={changerFiltre}>
                  <option value="">Toutes</option>
                  {etiquettes.map((e) => <option key={e} value={e}>{e}</option>)}
                </Select>
              </Field>
            </div>
            {filtered.length > 0 && (
              <div className="mb-2 flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-texte-doux">
                    <input type="checkbox" className="h-4 w-4 accent-primaire"
                      checked={tousVisiblesChoisis} onChange={(e) => choisirVisibles(e.target.checked)} />
                    Tout sélectionner ({filtered.length})
                  </label>
                  {selectionVisible.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-texte-doux" aria-live="polite">{selectionVisible.length} sélectionné{selectionVisible.length > 1 ? 's' : ''}</span>
                      <Button petit variante="fantome" onClick={() => setSelection(new Set())}>Désélectionner</Button>
                      <Button petit variante="secondaire" icone={Trash2} onClick={() => setConfirmation('selection')} disabled={confirmation === 'selection'}>
                        Supprimer la sélection
                      </Button>
                    </div>
                  )}
                </div>
                {confirmation === 'selection' && selectionVisible.length > 0 && (
                  <ConfirmationSuppression nombre={selectionVisible.length} libelleConfirmer="Supprimer la sélection" enCours={suppressionEnCours}
                    onConfirmer={supprimerSelection} onAnnuler={() => setConfirmation(null)} />
                )}
              </div>
            )}
            {filtered.length > 0 ? (
              <ul className="-mx-3 divide-y divide-ligne" aria-label="Liste des profils">
                {filtered.map((p, i) => (
                  <CarteProfil key={p.id || `${p.link}-${i}`} profil={p} onOuvrir={ouvrirFiche}
                    selectionne={selection.has(p.id)} onSelection={p.id ? choisir : undefined} />
                ))}
              </ul>
            ) : (
              <EmptyState icone={Search} titre="Aucun profil ne correspond"
                texte={filter ? `Rien pour « ${filter} » avec ces filtres.` : 'Aucun profil avec ces filtres.'}
                action={filtreActif && <Button petit variante="secondaire" onClick={effacerFiltres}>Effacer les filtres</Button>} />
            )}
          </>
        ) : (
          !loading && (
            <EmptyState icone={UsersRound} titre="Aucun profil pour l'instant" texte="Lance le scraper pour voir les profils ici." />
          )
        )}
        {loading && scrapedProfiles.length === 0 && (
          // Squelettes à la forme des cartes C-33.
          <ul className="space-y-1" aria-label="Chargement des profils">
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex items-start gap-3 px-3 py-3">
                <span className="h-10 w-10 shrink-0 animate-pulse rounded-pilule bg-surface-douce" />
                <span className="flex-1 space-y-2 pt-1">
                  <span className="block h-3 w-2/5 animate-pulse rounded-pilule bg-surface-douce" />
                  <span className="block h-3 w-3/4 animate-pulse rounded-pilule bg-surface-douce" />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {profilOuvert && <FicheProfil key={profilOuvert.id} profil={profilOuvert} onFermer={fermerFiche} />}
    </Page>
  )
}
