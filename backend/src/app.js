/**
 * Application Express de LinkedAI, sans démarrage du serveur.
 * Séparée de index.js pour que les tests l'importent (Supertest) sans ouvrir de port.
 * À appeler après le chargement de .env : CORS_ORIGINS et les réglages de connexion sont lus ici.
 */
import express  from 'express'
import cors     from 'cors'
import morgan   from 'morgan'
import { toNodeHandler } from 'better-auth/node'

import postRoutes    from './routes/posts.js'
import n8nRoutes     from './routes/n8n.js'
import profilRoutes  from './profils/routes.js'
import compteRoutes  from './compte/routes.js'
import { limiter }   from './lib/rateLimit.js'
import { creerAuth, exigerSession } from './auth/index.js'

export const VERSION = '0.1.0'

// Origines autorisées à appeler l'API depuis un navigateur, séparées par des virgules.
export const originesAutorisees = () =>
  (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:3001')
    .split(',').map((o) => o.trim()).filter(Boolean)

// Options pour les tests : `garde` remplace la vérification de session, `limiteConnexion` coupe
// la limite de tentatives de Better Auth.
export function creerApp({ journal = true, garde, limiteConnexion = true } = {}) {
  const app = express()
  const auth = creerAuth({ originesAutorisees: originesAutorisees(), limiteConnexion })

  // Derrière un tunnel (cloudflared, ngrok), l'IP réelle est dans X-Forwarded-For.
  app.set('trust proxy', 1)

  // credentials : le navigateur envoie le cookie de session, seulement depuis ces origines.
  app.use(cors({ origin: originesAutorisees(), credentials: true }))
  if (journal) app.use(morgan('dev'))

  // Une requête qui modifie des données, envoyée par un navigateur depuis un autre site, est refusée.
  // (Sans en-tête Origin, ce n'est pas un navigateur : curl, tests, serveur à serveur.)
  const origines = new Set(originesAutorisees())
  app.use('/api', (req, res, next) => {
    const origine = req.get('Origin')
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS' || !origine || origines.has(origine)) return next()
    return res.status(403).json({ error: 'Origine non autorisée.' })
  })

  // Comptes et sessions (Better Auth) : avant express.json, qui consommerait le corps des requêtes.
  app.all('/api/auth/*', toNodeHandler(auth))

  // 1 Mo : un import du navigateur porte jusqu'à 200 posts et 500 profils.
  app.use(express.json({ limit: '1mb' }))

  // Public : santé du service.
  app.get('/api/health', (_, res) => res.json({ status: 'ok', version: VERSION }))

  // Tout le reste de l'API demande une session.
  app.use('/api', garde || exigerSession(auth))

  // Routes qui consomment de l'IA ou un quota de recherche (lot L0.5) :
  // 20 appels par minute et par compte, et 60 par IP (plusieurs comptes derrière une même adresse).
  const parCompte = limiter({ windowMs: 60_000, max: 20, cle: (req) => `compte:${req.utilisateur.id}` })
  const parIp     = limiter({ windowMs: 60_000, max: 60 })
  for (const chemin of ['/api/posts/generate', '/api/n8n', '/api/profils/rechercher']) {
    app.use(chemin, parIp, parCompte)
  }

  app.use('/api/posts',   postRoutes)
  app.use('/api/n8n',     n8nRoutes)
  app.use('/api/profils', profilRoutes)
  app.use('/api/compte',  compteRoutes)

  return app
}
