/** cloneme: P-06 — Paramètres : compte et déconnexion, ton par défaut des posts, webhook du scraper, à propos. */
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Save, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import useSessionStore, { useIdentite } from '../store/useSessionStore'
import useAppStore from '../store/useAppStore'
import Page from '../components/ui/Page'
import { Card, CardHeader } from '../components/ui/Card'
import { Field, Input, Select } from '../components/ui/Field'
import Button from '../components/ui/Button'
import { AUTEUR_PROJET } from '../lib/profil'
import { TONS_POST, MODELE_POST, TON_PAR_DEFAUT } from '../lib/posts'

export default function Settings() {
  const moi = useIdentite()
  const seDeconnecter = useSessionStore((s) => s.seDeconnecter)
  const navigate = useNavigate()
  const [sortie, setSortie] = useState(false)

  const quitter = async () => {
    setSortie(true)
    await seDeconnecter()
    toast.success('Déconnecté.')
    navigate('/connexion', { replace: true })
  }
  const { settings, enregistrerParametres } = useAppStore()
  const [enregistrement, setEnregistrement] = useState(false)
  const [form, setForm] = useState({
    ...settings,
    defaultTone: TONS_POST.includes(settings.defaultTone) ? settings.defaultTone : TON_PAR_DEFAUT,
  })

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
  }

  const handleSave = async () => {
    setEnregistrement(true)
    try {
      await enregistrerParametres({ defaultTone: form.defaultTone, scraperWebhook: form.scraperWebhook.trim() })
      toast.success('Paramètres sauvegardés !')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setEnregistrement(false)
    }
  }

  return (
    <Page largeur="moyen" surtitre="Compte" titre="Paramètres" description="Ton compte, et tes préférences de génération et du scraper, gardées avec lui.">
      <Card>
        <CardHeader titre="Mon compte" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pilule bg-sable text-xs font-semibold text-texte">{moi.initiales}</span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-texte">{moi.nomComplet}</span>
              <span className="block truncate text-xs text-texte-pale">{moi.email}</span>
            </span>
          </div>
          <Button variante="secondaire" icone={LogOut} chargement={sortie} onClick={quitter}>Se déconnecter</Button>
        </div>
      </Card>

      <Card className="space-y-5">
        <CardHeader titre="Génération des posts" marge={false} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Ton par défaut" htmlFor="defaultTone" aide="Pré-choisi à l'ouverture du générateur">
            <Select id="defaultTone" name="defaultTone" value={form.defaultTone} onChange={handleChange}>
              {TONS_POST.map((t) => <option key={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Modèle IA" aide="Choisi par le backend">
            <p className="champ bg-surface-douce text-texte-doux">{MODELE_POST.libelle}</p>
          </Field>
        </div>

        <Field label="Webhook du scraper (optionnel)" htmlFor="scraperWebhook"
          aide="Laisse vide pour passer par le backend. À remplir seulement pour viser un autre n8n.">
          <Input id="scraperWebhook" name="scraperWebhook" value={form.scraperWebhook}
            onChange={handleChange} placeholder="https://ton-instance.../webhook/scraper" />
        </Field>

        <Button icone={Save} chargement={enregistrement} onClick={handleSave}>Sauvegarder</Button>
      </Card>

      <Card>
        <CardHeader titre="À propos" />
        <dl className="grid grid-cols-[110px_1fr] gap-x-4 gap-y-2.5 text-sm">
          <dt className="text-texte-pale">Projet</dt><dd className="text-texte">LinkedAI — AI Job Automation SaaS</dd>
          <dt className="text-texte-pale">Auteur</dt><dd className="text-texte">{AUTEUR_PROJET}</dd>
          <dt className="text-texte-pale">Version</dt><dd className="text-texte">0.1.0 — Phase 1 MVP</dd>
          <dt className="text-texte-pale">Stack</dt><dd className="text-texte">React · Express · n8n · DeepSeek (OpenRouter) · Prisma</dd>
        </dl>
      </Card>
    </Page>
  )
}
