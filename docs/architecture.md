# Architecture

## Vue d'ensemble

| Partie | Techno | Rôle | Port |
|---|---|---|---|
| Front | React 18, Vite 5, Tailwind 3, zustand, framer-motion | interface ; profils encore gardés dans le navigateur | 3000 |
| Backend | Node.js, Express 4, Prisma 6 | seul point d'entrée : IA, relais n8n, recherche de profils, historique | 4000 |
| Base | PostgreSQL 16 (Docker, `docker-compose.yml`) | historique des posts générés | 5433 |
| n8n | Docker `n8nio/n8n` | ressources, visuel IA, scraper | 5678 |
| IA | DeepSeek (`deepseek/deepseek-chat`) via OpenRouter | posts et visuels | — |
| Recherche | Google Custom Search | profils LinkedIn publics pour le scraper | — |

## Comptes et connexion

Better Auth (MIT), servi par le backend sous `/api/auth/*` (`backend/src/auth/`) :

| Élément | Choix |
|---|---|
| Inscription, connexion | e-mail et mot de passe, 10 caractères au moins ; mot de passe haché par Better Auth (table `account`) |
| Session | en base (table `session`), 7 jours ; cookie httpOnly, `SameSite=Lax`, `Secure` en production |
| Mot de passe oublié | lien à usage unique, valable 1 heure (table `verification`) ; les sessions ouvertes sont fermées. **En développement, l'e-mail est simulé : le lien s'affiche dans le terminal du backend.** |
| Limite de tentatives | 5 connexions et 5 inscriptions par minute et par IP, 3 demandes de lien |
| Garde | toute route `/api` sauf `/api/health` et `/api/auth/*` répond 401 sans session (`exigerSession`) |
| Origine | une requête qui modifie des données, venue d'un navigateur sur un site absent de `CORS_ORIGINS`, est refusée (403) |

Côté front : `services/auth.js` (appels), `store/useSessionStore.js` (session en mémoire), `components/auth/RouteProtegee.jsx` (garde des pages). Une réponse 401 pendant l'utilisation renvoie vers `/connexion`.

**Données du compte (lot L0.7)** : les posts et les paramètres sont sur le serveur. `RouteProtegee` les charge à la connexion (`useAppStore.chargerCompte`) avant d'ouvrir les pages ; la déconnexion ou une réponse 401 les vide de la mémoire.

**Reprise du navigateur** : un navigateur utilisé avant les comptes gardait posts et paramètres dans `linkedai-storage` (version 0). Au premier chargement, le store passe en version 1 et les met de côté sous `linkedai-a-importer`. Le bandeau C-32 (`components/compte/ImportNavigateur.jsx`) propose de les importer (`POST /api/compte/import-local`) ; ils ne sont effacés qu'après un import réussi. Relancer l'import ne crée aucun doublon.

**Pas encore fait (lot L1.1)** : les profils scrapés restent dans le navigateur, sans lien avec le compte. Deux comptes ouverts tour à tour dans le même navigateur voient donc les mêmes profils.

## Les trois parcours

### Générer un post

```text
PostGenerator.jsx → services/api.js generatePost()
  → POST /api/posts/generate            (backend/src/routes/posts.js)
      → OpenRouter, modèle deepseek      prompt construit côté serveur
      → GeneratedPostLog en base          journal technique (réponse brute)
      → Post en base                      historique du compte
  ← { post, enregistre }
  → ajouterPost() dans le store          copie des 50 derniers, relue à chaque connexion
```

### Ressources et visuel d'un post

```text
PostGenerator.jsx / VisualCardGenerator.jsx
  → POST /api/n8n/resource-suggestions | /api/n8n/generate-visual
      → backend/src/routes/n8n.js        relaie vers n8n /webhook/<nom>
          → workflow n8n                  docs + conseils | HTML du visuel (deepseek)
  ← réponse de n8n, renvoyée telle quelle
```

Le visuel est affiché dans un iframe isolé (`sandbox="allow-scripts"`, sans accès à la page). L'export PNG se fait dans l'iframe, qui renvoie l'image par `postMessage`.

### Scraper des profils

```text
Scraper.jsx → services/api.js rechercherProfils()
  → POST /api/profils/rechercher { requete, lieu, pages }      (backend/src/profils/routes.js)
      → fournisseurs, essayés dans l'ordre                       (profils/fournisseurs/index.js)
          1. Serper (Google), si SERPER_API_KEY                  (serper.js)
          2. Brave, si BRAVE_API_KEY                              (brave.js)
          3. n8n : workflow linkedin-scraper-webhook → Google Custom Search, en dernier secours
          10 profils par page, 10 pages au plus ; arrêt à la première page vide
      → normalisation                                            (profils/normaliser.js)
  ← { profils: [{ urlNormalisee, nom, poste, entreprise, lieu, extrait, image, source }], rejetes, source, secours }
  → versProfilLocal() puis addProfiles() dans le store           (forme gardée : name, title, link, snippet…)
```

La normalisation :

- ramène l'adresse à `https://www.linkedin.com/in/<identifiant>` (sous-domaine pays, langue, paramètres retirés) ;
- retire « - LinkedIn », les troncatures « ... », les caractères invisibles et les entités HTML ;
- sépare le poste de l'entreprise quand le titre l'annonce (« at », « chez », « @ », ou « Nom - Poste - Entreprise ») ;
- ne garde le lieu que s'il est écrit explicitement ;
- rejette, en les comptant, les résultats qui ne sont pas une page de profil.

Si un webhook est réglé dans Paramètres (ou `VITE_N8N_SCRAPER_WEBHOOK`), le front l'appelle directement, sans normalisation, comme avant.

## API du backend

Toutes les routes ci-dessous, sauf `/api/health` et `/api/auth/*`, demandent une session (401 sinon).

| Méthode | Route | Corps | Réponse |
|---|---|---|---|
| GET | `/api/health` | — | `{ status: 'ok', version }` · public |
| POST, GET | `/api/auth/*` | voir Better Auth : `sign-up/email`, `sign-in/email`, `sign-out`, `get-session`, `request-password-reset`, `reset-password` | public |
| POST | `/api/posts/generate` | `{ type, description, tech, tone }` | `{ success, post, log }` · 400 si description vide ou > 2000 caractères · 502 si OpenRouter échoue |
| GET | `/api/posts` | — (un `?userId=` est ignoré) | `{ posts, total }` : les 50 derniers posts **du compte connecté** |
| GET | `/api/compte/parametres` | — | `{ parametres: { defaultTone, scraperWebhook } }`, valeurs par défaut si rien n'est enregistré |
| PUT | `/api/compte/parametres` | `{ defaultTone?, scraperWebhook? }` | `{ parametres }` · 400 si le webhook n'est pas une URL http(s) |
| POST | `/api/compte/import-local` | `{ posts?, settings? }` du navigateur (200 posts au plus) | `{ posts: { importes, dejaLa, ecartes }, parametres: 'importes' \| 'conserves' }` |
| GET | `/api/posts/logs` | — (un `?userId=` est ignoré) | `{ success, logs }` : les 50 derniers journaux **du compte connecté** |
| POST | `/api/profils/rechercher` | `{ requete, lieu?, pages? }` (1 à 10 pages) | `{ profils, rejetes, source, secours }` · 400 si paramètres invalides · 502 si aucun fournisseur ne répond |
| POST | `/api/n8n/:nom` | relayé tel quel | réponse de n8n · 404 si `nom` n'est pas autorisé |

Webhooks autorisés : `resource-suggestions`, `generate-visual`, `scraper`.

## Protections

- **Clés** : `OPENROUTER_API_KEY`, `SERPER_API_KEY` et `BRAVE_API_KEY` dans `backend/.env` ; clés n8n dans `~/n8n.env`. Le build du front n'en contient aucune.
- **CORS** : seules les origines de `CORS_ORIGINS` peuvent appeler le backend depuis un navigateur.
- **Limite** : sur `/api/posts/generate`, `/api/n8n` et `/api/profils/rechercher`, 20 appels par minute et par compte, et 60 par IP (`backend/src/lib/rateLimit.js`, en mémoire). `trust proxy` est activé pour lire l'IP réelle derrière un tunnel.
- **Relais n8n** : liste blanche de 3 webhooks ; le reste de n8n n'est jamais exposé.

## Données

| Où | Quoi | Durée de vie |
|---|---|---|
| Navigateur, `localStorage` « linkedai-storage » (version 1) | profils (200), lettres (20), offres | jusqu'à effacement du navigateur |
| Navigateur, `localStorage` « linkedai-a-importer » | posts et paramètres d'avant les comptes, en attente d'import | effacé après un import réussi |
| PostgreSQL, tables `Post` et `Parametres` | posts du compte, ton par défaut, webhook du scraper | permanente ; supprimés avec le compte |
| PostgreSQL (conteneur `linkedai-postgres`, volume `linkedai-pgdata`), table `GeneratedPostLog` | chaque post généré, relié au compte qui l'a demandé (`userId` tiré de la session, jamais du corps ni de l'URL) ; les journaux d'avant les comptes n'ont pas de propriétaire et ne s'affichent pour personne | permanente ; supprimés avec le compte |
| `~/n8n-data` | workflows et comptes n8n | permanente |

## Front : organisation

- `src/pages/` : une page par route (`P-xx` dans `frontend/design.md`).
- `src/components/ui/` : briques réutilisables (Card, Button, Field, Badge, Tabs, EmptyState, Page, ListeActivite, PageAttente).
- `src/components/layout/` : cadre, sidebar, barre du haut, recherche globale, notifications.
- `src/components/lightswind/` : CountUp et TopLoader, portés depuis Lightswind UI (MIT).
- `src/lib/` : navigation, profil, options des posts, statistiques, export CSV, réglages d'animation.
- `src/styles/tokens.css` : toutes les couleurs, ombres, rayons et durées (miroir de `frontend/palette.md`).
