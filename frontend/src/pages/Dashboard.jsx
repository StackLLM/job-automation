/** cloneme: P-01 — Dashboard : direction Nexora, données réelles du store uniquement. */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { PenLine, ScanSearch, FileText, BriefcaseBusiness, Download, Settings, Linkedin, BarChart3, UsersRound } from 'lucide-react'
import toast from 'react-hot-toast'
import useAppStore from '@/store/useAppStore'
import Page from '@/components/ui/Page'
import { Card, CardHeader } from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import Tabs from '@/components/ui/Tabs'
import ListeActivite from '@/components/ui/ListeActivite'
import Button from '@/components/ui/Button'
import Accueil from '@/components/dashboard/Accueil'
import CarteVisuelle from '@/components/dashboard/CarteVisuelle'
import CarteChiffre from '@/components/dashboard/CarteChiffre'
import ActionsRapides from '@/components/dashboard/ActionsRapides'
import ListeActions from '@/components/dashboard/ListeActions'
import Donut from '@/components/charts/Donut'
import Histogramme from '@/components/charts/Histogramme'
import { entreeCarte } from '@/lib/animations'
import { postsParJour, comparaisonSemaine, repartitionParType, dateRelative } from '@/lib/stats'
import { titrePost } from '@/lib/posts'
import { exporterProfilsCsv } from '@/lib/exportCsv'

const ACTIONS_RAPIDES = [
  { label: 'Générer un post', to: '/posts',   icone: PenLine },
  { label: 'Lancer le scraper', to: '/scraper', icone: ScanSearch },
  { label: 'Adapter une lettre', to: '/lettre',  icone: FileText },
  { label: 'Chercher des offres', to: '/offres',  icone: BriefcaseBusiness },
]

const PERIODES = [
  { id: 'mois', label: '30 jours' },
  { id: 'tout', label: 'Tout' },
]

export default function Dashboard() {
  const navigate = useNavigate()
  const { posts, totalPosts, scrapedProfiles, letters, savedJobs } = useAppStore()
  const [periode, setPeriode] = useState('tout')

  const semaine = useMemo(() => comparaisonSemaine(posts), [posts])
  const parJour = useMemo(() => postsParJour(posts, 7), [posts])
  const repartition = useMemo(() => repartitionParType(posts, periode), [posts, periode])

  const actions = [
    {
      label: 'Exporter les profils (CSV)',
      aide: scrapedProfiles.length ? `${scrapedProfiles.length} profils` : 'Aucun profil pour l\'instant',
      icone: Download,
      desactive: scrapedProfiles.length === 0,
      onClick: () => { exporterProfilsCsv(scrapedProfiles); toast.success('Export CSV lancé') },
    },
    { label: 'Configurer n8n', aide: 'Webhook du scraper, modèle par défaut', icone: Settings, onClick: () => navigate('/settings') },
    { label: 'Ouvrir LinkedIn', aide: 'Publier ton dernier post', icone: Linkedin, onClick: () => window.open('https://www.linkedin.com/feed/', '_blank', 'noopener,noreferrer') },
  ]

  return (
    <Page>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* ── Zone principale ── */}
        <div className="min-w-0 space-y-5">
          {/* Accueil + carte chiffre clé, posés sur le fond dégradé (A-02, A-03) */}
          <motion.div variants={entreeCarte} className="relative overflow-hidden rounded-carte bg-hero p-5 sm:p-7">
            <div className="absolute inset-y-0 right-0 hidden w-[48%] md:block">
              <CarteVisuelle />
            </div>
            <div className="relative space-y-6">
              <Accueil />
              <CarteChiffre
                libelle="Posts générés"
                valeur={totalPosts}
                cetteSemaine={semaine.cetteSemaine}
                ecart={semaine.ecart}
                lien="/posts"
                secondaires={[
                  { libelle: 'Profils scrapés', valeur: scrapedProfiles.length },
                  { libelle: 'Lettres créées', valeur: letters.length },
                  { libelle: 'Offres sauvées', valeur: savedJobs.length },
                ]}
              />
            </div>
          </motion.div>

          <ActionsRapides actions={ACTIONS_RAPIDES} />

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader titre="Derniers posts" lien="/posts" />
              {posts.length > 0 ? (
                <ListeActivite
                  elements={posts.slice(0, 4).map((p) => ({
                    cle: p.id,
                    icone: <PenLine size={16} />,
                    titre: titrePost(p.content),
                    meta: dateRelative(p.createdAt),
                    valeur: p.type,
                    sousValeur: p.model,
                    onClick: () => navigate('/posts', { state: { postId: p.id } }),
                  }))}
                />
              ) : (
                <EmptyState
                  icone={PenLine}
                  titre="Aucun post généré"
                  texte="Tes posts apparaîtront ici, avec leur date et leur modèle."
                  action={<Button petit onClick={() => navigate('/posts')}>Générer un post</Button>}
                />
              )}
            </Card>

            <Card>
              <CardHeader
                titre="Répartition par type"
                action={<Tabs onglets={PERIODES} actif={periode} onChange={setPeriode} />}
              />
              {repartition.total > 0 ? (
                <Donut segments={repartition.segments} total={repartition.total} libelleTotal="posts" />
              ) : (
                <EmptyState
                  icone={BarChart3}
                  titre={periode === 'mois' ? 'Aucun post sur 30 jours' : 'Pas encore de données'}
                  texte="La répartition se calcule à partir de tes posts générés."
                />
              )}
            </Card>
          </div>
        </div>

        {/* ── Colonne de droite ── */}
        <div className="grid min-w-0 grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-1 xl:content-start">
          <Card>
            <CardHeader titre="Activité" sousTitre="Posts générés sur 7 jours" lien="/posts" />
            <div className="mb-4 flex items-start gap-3 rounded-controle bg-surface-douce p-3">
              <BarChart3 size={18} className="mt-0.5 shrink-0 text-texte-doux" />
              <p className="text-xs leading-relaxed text-texte-doux">
                {semaine.cetteSemaine === 0 && semaine.semainePrecedente === 0
                  ? 'Aucun post sur les deux dernières semaines.'
                  : `${semaine.cetteSemaine} post${semaine.cetteSemaine > 1 ? 's' : ''} cette semaine, ${
                    semaine.ecart === 0 ? 'autant que' : `${Math.abs(semaine.ecart)} de ${semaine.ecart > 0 ? 'plus' : 'moins'} que`
                  } la semaine d'avant.`}
              </p>
            </div>
            <Histogramme donnees={parJour} />
          </Card>

          <Card>
            <CardHeader titre="Derniers profils" lien="/scraper" />
            {scrapedProfiles.length > 0 ? (
              <ListeActivite
                elements={scrapedProfiles.slice(0, 4).map((p, i) => ({
                  cle: `${p.link || p.name}-${i}`,
                  icone: p.image
                    ? <img src={p.image} alt="" className="h-full w-full object-cover" />
                    : <span className="text-xs font-semibold">{(p.name || '?').charAt(0)}</span>,
                  titre: p.name || 'Profil sans nom',
                  meta: p.title || '—',
                  href: p.link,
                }))}
              />
            ) : (
              <EmptyState
                icone={UsersRound}
                titre="Aucun profil scrapé"
                texte="Lance le scraper pour récupérer des profils LinkedIn."
                action={<Button petit variante="secondaire" onClick={() => navigate('/scraper')}>Ouvrir le scraper</Button>}
              />
            )}
          </Card>

          <Card className="md:col-span-2 xl:col-span-1">
            <CardHeader titre="Actions rapides" />
            <ListeActions actions={actions} />
          </Card>
        </div>
      </div>
    </Page>
  )
}
