/** cloneme: P-02 — Générateur de posts LinkedIn : génération par le backend, ressources n8n, visuel IA. */
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { PenLine, Copy, BookOpen, Sparkles, RefreshCw, ExternalLink, Lightbulb, History } from 'lucide-react'
import useAppStore from '../store/useAppStore'
import { avecActivite } from '../store/useActiviteStore'
import { generatePost, getResources } from '../services/api'
import VisualCardGenerator from '../components/posts/VisualCardGenerator'
import Page from '../components/ui/Page'
import { Card, CardHeader } from '../components/ui/Card'
import { Field, Input, Select, Textarea } from '../components/ui/Field'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Tabs from '../components/ui/Tabs'
import EmptyState from '../components/ui/EmptyState'
import ListeActivite from '../components/ui/ListeActivite'
import { TYPES_POST, TONS_POST, MODELE_POST, TON_PAR_DEFAUT, titrePost } from '../lib/posts'
import { dateRelative } from '../lib/stats'

export default function PostGenerator() {
  const { posts, totalPosts, ajouterPost, settings } = useAppStore()
  const location = useLocation()
  const navigate = useNavigate()

  // Le ton de départ vient des paramètres (une ancienne valeur inconnue retombe sur le ton par défaut).
  const [form, setForm] = useState(() => ({
    type: TYPES_POST[0],
    description: '',
    tech: '',
    tone: TONS_POST.includes(settings.defaultTone) ? settings.defaultTone : TON_PAR_DEFAUT,
  }))
  const [result,    setResult]    = useState('')
  const [resources, setResources] = useState(null)
  const [loading,   setLoading]   = useState(false)
  const [loadingRes,setLoadingRes]= useState(false)
  const [activeTab, setActiveTab] = useState('post') // 'post' | 'resources' | 'visual'

  // Ouverture depuis le dashboard, la recherche ou les notifications : charge le post demandé.
  useEffect(() => {
    const postId = location.state?.postId
    if (!postId) return
    const post = posts.find((p) => p.id === postId)
    if (post) {
      setResult(post.content)
      setActiveTab('post')
    }
    navigate(location.pathname, { replace: true, state: null })
  }, [location.state, location.pathname, posts, navigate])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
  }

  const handleGenerate = async () => {
    if (!form.description.trim()) { toast.error('Décris ton projet ou ton sujet.'); return }
    setLoading(true)
    try {
      const { texte, post } = await avecActivite(generatePost({
        type: form.type, description: form.description,
        tech: form.tech, tone: form.tone,
      }))
      setResult(texte)
      setResources(null)
      if (post) ajouterPost(post)
      toast.success('Post généré !')
      setActiveTab('post')
    } catch (err) {
      console.error(err)
      toast.error(`Erreur: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleGetResources = async () => {
    if (!result) { toast.error('Génère un post d\'abord'); return }
    setLoadingRes(true)
    try {
      const data = await avecActivite(getResources({ post: result, tech: form.tech, type: form.type }))
      setResources(data)
      setActiveTab('resources')
      toast.success('Ressources trouvées !')
    } catch (err) {
      toast.error(`Erreur ressources: ${err.message}`)
    } finally {
      setLoadingRes(false)
    }
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(result)
    toast.success('Copié !')
  }

  const onglets = [
    { id: 'post', label: 'Post', icone: PenLine },
    { id: 'resources', label: `Ressources${resources ? ` (${resources.documents?.length || 0})` : ''}`, icone: BookOpen },
    { id: 'visual', label: 'Visuel IA', icone: Sparkles },
  ]

  return (
    <Page
      surtitre="Contenu"
      titre="Générateur de posts"
      description="Décris ton sujet et choisis un ton : l'IA rédige un post LinkedIn prêt à publier."
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">

        {/* ── Formulaire ── */}
        <Card className="space-y-4 lg:self-start">
          <CardHeader titre="Paramètres du post" marge={false} />
          <Field label="Type de post" htmlFor="type">
            <Select id="type" name="type" value={form.type} onChange={handleChange}>
              {TYPES_POST.map((t) => <option key={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Description" htmlFor="description">
            <Textarea id="description" name="description" className="min-h-28"
              value={form.description} onChange={handleChange}
              placeholder="Ex: J'ai automatisé l'extraction de profils LinkedIn avec n8n..." />
          </Field>
          <Field label="Technologies" htmlFor="tech">
            <Input id="tech" name="tech" value={form.tech} onChange={handleChange}
              placeholder="n8n, Python, AWS, React..." />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Ton" htmlFor="tone">
              <Select id="tone" name="tone" value={form.tone} onChange={handleChange}>
                {TONS_POST.map((t) => <option key={t}>{t}</option>)}
              </Select>
            </Field>
            <Field label="Modèle IA">
              <p className="champ bg-surface-douce text-texte-doux">{MODELE_POST.libelle}</p>
            </Field>
          </div>
          <Button className="w-full" icone={PenLine} chargement={loading} onClick={handleGenerate}>
            {loading ? 'Génération…' : 'Générer le post'}
          </Button>
        </Card>

        {/* ── Résultat + Ressources + Visuel ── */}
        <Card className="flex min-h-[420px] flex-col gap-4">
          {result && <Tabs onglets={onglets} actif={activeTab} onChange={setActiveTab} />}

          {activeTab === 'post' && (
            result ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-[15px] font-semibold text-texte">Post généré</h2>
                  <Badge>{result.length} caractères</Badge>
                </div>
                <Textarea className="min-h-64 flex-1"
                  value={result} onChange={(e) => setResult(e.target.value)} />
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Button icone={Copy} onClick={copyToClipboard}>Copier</Button>
                  <Button variante="secondaire" icone={BookOpen} chargement={loadingRes} onClick={handleGetResources}>
                    {loadingRes ? 'Recherche…' : 'Trouver des ressources'}
                  </Button>
                  <a href="https://www.linkedin.com/feed/" target="_blank" rel="noreferrer" className="btn-secondaire">
                    <ExternalLink size={16} /> LinkedIn
                  </a>
                  <Button variante="fantome" icone={RefreshCw} onClick={handleGenerate} disabled={loading} aria-label="Regénérer">
                    Regénérer
                  </Button>
                </div>
              </>
            ) : (
              <EmptyState
                className="flex-1"
                icone={PenLine}
                titre="Le post apparaîtra ici"
                texte="Remplis la description puis clique sur « Générer le post »."
              />
            )
          )}

          {activeTab === 'resources' && (
            <div className="flex-1 space-y-5 overflow-y-auto">
              {resources ? (
                <>
                  {resources.documents?.length > 0 && (
                    <div>
                      <p className="libelle">Documentation utile</p>
                      <div className="space-y-2">
                        {resources.documents.map((doc, i) => (
                          <a key={i} href={doc.url} target="_blank" rel="noreferrer"
                            className="ligne-liste justify-between border border-ligne">
                            <span className="min-w-0 truncate text-sm text-texte">{doc.title}</span>
                            <Badge className="shrink-0">{doc.type}</Badge>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {resources.tips?.length > 0 && (
                    <div>
                      <p className="libelle">Conseils</p>
                      <ul className="space-y-1.5">
                        {resources.tips.map((tip, i) => (
                          <li key={i} className="flex gap-2 text-xs leading-relaxed text-texte-doux">
                            <Lightbulb size={14} className="mt-0.5 shrink-0 text-texte-pale" /><span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <EmptyState
                  icone={BookOpen}
                  titre="Pas encore de ressources"
                  texte="Clique sur « Trouver des ressources » après avoir généré un post."
                  action={<Button petit variante="secondaire" chargement={loadingRes} onClick={handleGetResources}>Trouver des ressources</Button>}
                />
              )}
            </div>
          )}

          {activeTab === 'visual' && (
            <div className="flex-1">
              <VisualCardGenerator
                post={result}
                tech={form.tech}
                type={form.type}
              />
            </div>
          )}
        </Card>
      </div>

      {/* ── Historique ── */}
      <Card>
        <CardHeader titre={`Historique (${totalPosts})`} sousTitre="Les 50 derniers posts de ton compte" />
        {posts.length > 0 ? (
          <div className="-mx-2 max-h-80 overflow-y-auto px-2">
            <ListeActivite
              elements={posts.map((p) => ({
                cle: p.id,
                icone: <History size={16} />,
                titre: titrePost(p.content),
                meta: `${dateRelative(p.createdAt)} · ${p.type} · ${p.model}`,
                valeur: 'Charger',
                onClick: () => { setResult(p.content); setActiveTab('post'); toast.success('Post chargé') },
              }))}
            />
          </div>
        ) : (
          <EmptyState icone={History} titre="Aucun post pour l'instant" texte="Chaque post généré est ajouté ici automatiquement." />
        )}
      </Card>
    </Page>
  )
}
