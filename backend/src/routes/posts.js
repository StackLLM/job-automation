/**
 * Génération des posts LinkedIn par OpenRouter (deepseek), posts du compte et journaux techniques.
 * Lot L0.5 : l'utilisateur vient toujours de la session (req.utilisateur, posé par exigerSession),
 * jamais du corps ni de l'URL. Chacun ne voit que ses propres journaux.
 * Lot L0.7 : chaque post généré est aussi gardé dans la table Post du compte (l'historique du front).
 */
import { Router } from 'express'
import axios from 'axios'
import { prisma } from '../lib/prisma.js'

const router = Router()

const MODELE = 'deepseek/deepseek-chat'
const LONGUEUR_MAX = 2000
export const POSTS_AFFICHES = 50

const construirePrompt = ({ type, description, tech, tone }) => `Tu es un expert LinkedIn copywriter. Rédige un post LinkedIn en français pour un ingénieur.

Type de post: ${type || 'Projet technique'}
Description: ${description}
Technologies: ${tech || 'non spécifié'}
Ton souhaité: ${tone || 'Professionnel'}

Règles:
- Accroche forte dès la première ligne
- Contenu concret et utile
- Terminer par une question engageante
- 5 à 8 hashtags pertinents à la fin
- Entre 150 et 250 mots
- Ton humain et authentique

Réponds uniquement avec le texte du post, sans commentaire.`

// POST /api/posts/generate
// La clé OpenRouter reste ici, côté serveur : le navigateur ne la voit jamais.
router.post('/generate', async (req, res) => {
  const { type, description, tech, technologies, tone } = req.body ?? {}

  if (!description?.trim()) {
    return res.status(400).json({ error: 'La description est obligatoire' })
  }
  if (description.length > LONGUEUR_MAX) {
    return res.status(400).json({ error: `La description est trop longue (${LONGUEUR_MAX} caractères maximum)` })
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENROUTER_API_KEY non configurée sur le serveur' })
  }

  const userTechnologies = String(technologies || tech || '').slice(0, 300)

  try {
    const openRouterRes = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: MODELE,
        messages: [{ role: 'user', content: construirePrompt({ type, description, tech: userTechnologies, tone }) }],
        max_tokens: 1000,
        temperature: 0.8,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
          'X-Title': 'LinkedAI',
        },
        timeout: 60_000,
      }
    )

    const generatedContent = openRouterRes.data?.choices?.[0]?.message?.content
    if (!generatedContent) {
      return res.status(502).json({ error: 'Réponse OpenRouter invalide' })
    }

    const [log, enregistre] = await prisma.$transaction([
      prisma.generatedPostLog.create({ data: {
        userId: req.utilisateur.id,
        type: type || null,
        description,
        technologies: userTechnologies || null,
        tone: tone || null,
        model: MODELE,
        generatedContent,
        rawResponse: JSON.stringify(openRouterRes.data),
      } }),
      // Le modèle est gardé sous son nom court, comme le front l'affiche (« deepseek »).
      prisma.post.create({ data: { userId: req.utilisateur.id, type: type || null, model: 'deepseek', content: generatedContent } }),
    ])

    return res.json({ success: true, post: generatedContent, log, enregistre })
  } catch (err) {
    const message = err.response?.data?.error?.message || err.message
    console.error('[Posts] Erreur OpenRouter:', message)
    return res.status(502).json({ error: `Erreur OpenRouter : ${message}` })
  }
})

// GET /api/posts : les posts du compte, les plus récents d'abord (même limite que l'ancien historique local).
router.get('/', async (req, res) => {
  try {
    const where = { userId: req.utilisateur.id }
    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where, orderBy: { createdAt: 'desc' }, take: POSTS_AFFICHES,
        select: { id: true, type: true, model: true, content: true, createdAt: true },
      }),
      prisma.post.count({ where }),
    ])
    return res.json({ posts, total })
  } catch (err) {
    console.error('[Posts] Erreur Prisma:', err.message)
    return res.status(500).json({ error: 'Erreur lors de la lecture des posts' })
  }
})

// GET /api/posts/logs : les 50 derniers journaux de l'utilisateur connecté (un ?userId= est ignoré).
router.get('/logs', async (req, res) => {
  try {
    const logs = await prisma.generatedPostLog.findMany({
      where: { userId: req.utilisateur.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return res.json({ success: true, logs })
  } catch (err) {
    console.error('[Posts] Erreur Prisma:', err.message)
    return res.status(500).json({ error: 'Erreur lors de la lecture des logs' })
  }
})

export default router
