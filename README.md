# LinkedAI — Assistant IA pour la recherche d'emploi

> **De l'offre à la candidature suivie, avec un CV ATS contrôlé et des contenus qui ne mentent pas.**

Job Automation (nom d'interface : LinkedAI) veut devenir un **SaaS multi-utilisateur** qui accompagne la recherche d'emploi de bout en bout :

1. trouver des profils et des offres ;
2. générer un CV adapté à chaque offre ;
3. écrire lettres et posts ;
4. suivre les candidatures et sa progression.

La vision complète est dans **[docs/vision.md](docs/vision.md)**, et le plan détaillé dans **[PLAN.md](PLAN.md)**.

**Aujourd'hui**, l'app permet :

- **Générateur de posts** : un post LinkedIn rédigé par l'IA à partir d'une description, d'un type et d'un ton.
- **Ressources** : liens de documentation et conseils de publication adaptés au post.
- **Visuel IA** : un visuel animé en HTML, exportable en PNG.
- **Scraper LinkedIn** : des profils publics trouvés par mots-clés et localisation, filtrables et exportables en CSV.
- **Dashboard** : activité, répartition des posts, derniers profils, actions rapides.
- **Comptes** : inscription, connexion, mot de passe oublié ; toutes les pages demandent d'être connecté.

Offres d'emploi, CV adapté, lettres et suivi des candidatures arrivent dans les prochaines phases (voir [Feuille de route](#feuille-de-route)).

**Stack** : React 18, Vite 5, Tailwind 3, framer-motion · Node.js, Express, Prisma, PostgreSQL · n8n (Docker) · DeepSeek via OpenRouter · Google Custom Search.

---

## Architecture

```text
Navigateur (front React)
  └─▶ Backend Express :4000            seul service exposé
        ├─▶ OpenRouter (deepseek)       génération des posts — clé OPENROUTER_API_KEY côté serveur
        ├─▶ n8n :5678                    3 webhooks autorisés
        │     ├─ resource-suggestions    docs + conseils (aucun appel externe)
        │     ├─ generate-visual         visuel HTML (deepseek)
        │     └─ scraper                 profils LinkedIn (Google Custom Search), appelé par /api/profils/rechercher
        └─▶ PostgreSQL (Prisma)          historique des posts générés
```

- Le front ne contient **aucune clé**. Il n'appelle que le backend (`/api`).
- n8n reste privé : seul le backend lui parle.
- Les posts, les paramètres et les profils scrapés sont rattachés au compte, en base : on les retrouve après actualisation, déconnexion ou sur un autre navigateur. Une même URL de profil n'est gardée qu'une fois.
- **Reprise** : un navigateur utilisé avant les comptes propose, à la connexion, d'importer ses posts, ses paramètres et ses profils dans le compte. Rien n'est effacé avant la fin de l'import, et le relancer ne crée aucun doublon.

Détails : [docs/architecture.md](docs/architecture.md).

## Démarrage rapide

Prérequis : Node.js 22+, Docker Desktop.

```bash
# 1. Une seule fois : dépendances, base, clés
npm install --prefix backend
npm install --prefix frontend
cp backend/.env.example backend/.env           # puis renseigner OPENROUTER_API_KEY
docker compose up -d db                        # PostgreSQL (port 5433)
npm run db:init --prefix backend               # créer les tables
cp n8n-workflows/n8n.env.example ~/n8n.env     # puis renseigner GOOGLE_API_KEY, GOOGLE_CX, OPENROUTER_API_KEY

# 2. Une seule fois : n8n dans Docker, puis importer les 3 workflows (voir docs/n8n.md)
npm run n8n:reload

# 3. À chaque fois : tout lancer
npm run dev
```

`npm run dev` démarre PostgreSQL et n8n, applique les migrations, puis lance le backend (http://localhost:4000) et le front (http://localhost:3000/job-automation-/). Ctrl+C arrête le backend et le front ; PostgreSQL et n8n restent actifs dans Docker.

## Structure du projet

```text
.
├── backend/               API Express : génération des posts, relais n8n, base PostgreSQL
│   ├── src/app.js         application : CORS, limite d'appels, routes
│   ├── src/index.js       point d'entrée : charge .env, ouvre le port
│   ├── src/routes/        posts.js (OpenRouter + historique), n8n.js (relais)
│   ├── src/profils/       recherche de profils : fournisseurs (Serper, Brave, n8n), normalisation
│   ├── src/lib/           prisma.js, rateLimit.js
│   ├── prisma/            schéma et migrations PostgreSQL
│   ├── scripts/           list-post-logs.js, reprendre-sqlite.js
│   └── test/              tests Vitest + Supertest
├── e2e/                   tests de bout en bout (Playwright)
├── frontend/              application React
│   ├── src/pages/         Dashboard, Posts, Scraper, Lettre, Offres, Paramètres, 404
│   ├── src/components/    ui, layout, dashboard, charts, posts, scraper, lightswind
│   ├── src/services/      api.js : tous les appels au backend
│   ├── src/store/         données persistées (zustand) et appels en cours
│   ├── src/styles/        tokens.css (design system), animations.css
│   └── design.md, palette.md, animation.md   références du design (voir plus bas)
├── n8n-workflows/         les 3 workflows à importer + modèle de fichier de clés
├── scripts/               dev.sh (tout lancer), n8n-reload.sh (recréer n8n)
├── docs/                  vision, architecture, n8n, sources de profils, démo
└── .claude/skills/cloneme méthode de reprise de design utilisée pour l'interface
```

## Configuration

### Backend — `backend/.env`

| Variable | Rôle |
|---|---|
| `OPENROUTER_API_KEY` | clé OpenRouter, jamais envoyée au navigateur |
| `BETTER_AUTH_SECRET` | secret de signature des sessions, obligatoire en production (`openssl rand -hex 32`) |
| `BETTER_AUTH_URL` | adresse publique du backend, utilisée dans les liens de réinitialisation |
| `SERPER_API_KEY`, `BRAVE_API_KEY` | fournisseurs de profils, essayés dans cet ordre avant n8n ; vides = ignorés (voir [docs/sources.md](docs/sources.md)) |
| `CORS_ORIGINS` | adresses de front autorisées, séparées par des virgules |
| `N8N_BASE_URL` | adresse de n8n (défaut `http://localhost:5678`) |
| `APP_URL` | adresse publique du front, envoyée à OpenRouter |
| `DATABASE_URL` | base PostgreSQL (défaut : celle de `docker-compose.yml`, `postgresql://linkedai:linkedai@localhost:5433/linkedai`) |

### n8n — `~/n8n.env` (hors du dépôt)

| Variable | Rôle |
|---|---|
| `OPENROUTER_API_KEY` | visuel IA |
| `GOOGLE_API_KEY`, `GOOGLE_CX` | scraper (Google Custom Search) |
| `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` | permet aux workflows de lire ces variables |

Après un changement de clé : `npm run n8n:reload` (`docker restart` ne relit pas ce fichier).

### Front — `frontend/.env` (optionnel)

| Variable | Rôle |
|---|---|
| `VITE_API_URL` | adresse publique du backend en démo. Vide en local (proxy Vite). |
| `VITE_BASE` | `/` pour Vercel ; par défaut `/job-automation-/` (GitHub Pages) |

## Base de données

Prisma + PostgreSQL 16, dans Docker (`docker-compose.yml`, conteneur `linkedai-postgres`, port 5433). Une table : `GeneratedPostLog` (chaque post généré, avec sa description, ses technologies, son ton, le modèle et la réponse brute).

```bash
docker compose up -d db              # démarrer PostgreSQL
npm run db:init --prefix backend     # appliquer les migrations (prisma migrate deploy)
npm run db:logs --prefix backend     # voir les derniers posts dans le terminal
npm run db:reprise --prefix backend  # copier l'ancienne base SQLite (prisma/dev.db), sans doublon
cd backend && npx prisma studio      # parcourir la base dans le navigateur
```

Les données vivent dans le volume Docker `linkedai-pgdata` : elles survivent à l'arrêt du conteneur. Les identifiants de `docker-compose.yml` servent seulement au développement.

Les tests d'intégration utilisent le schéma `test` de cette même base, jamais `public` : `docker compose up -d db` doit tourner avant `npm test`.

## Démo en ligne

Le backend est le seul service à exposer. La marche à suivre complète (tunnel, Vercel, répétition) est dans [docs/demo.md](docs/demo.md).

## Design de l'interface

L'interface reprend la direction artistique de la maquette Nexora (Dribbble), adaptée à LinkedAI avec la méthode CloneMe (`.claude/skills/cloneme/`). Trois fichiers pilotent l'apparence, à la racine de `frontend/` :

| Fichier | Rôle | Code piloté |
|---|---|---|
| `design.md` | pages, composants (`P-xx`, `C-xx`), responsive | `src/pages/`, `src/components/` |
| `palette.md` | couleurs, ombres, rayons, typographie | `src/styles/tokens.css` (valeur pour valeur) |
| `animation.md` | animations (`A-xx`), mode réduit | `src/lib/animations.js` |

Règle : aucune couleur ni durée en dur dans un composant ; tout passe par `tokens.css`, exposé dans `tailwind.config.js`. Rapport de la refonte : `frontend/RAPPORT-CLONAGE.md`.

## Qualité

```bash
npm run lint --prefix frontend                                     # ESLint du front
npm run lint --prefix backend                                      # ESLint du backend
npm run build --prefix frontend                                    # build de production
node .claude/skills/cloneme/scripts/verifier-synchro.mjs frontend  # design.md/palette.md ↔ code
```

## Tests

Aucun test n'appelle OpenRouter, n8n ou Google : ces services sont simulés.

| Commande (depuis la racine) | Ce qu'elle lance | Où sont les tests |
|---|---|---|
| `npm test` | tests unitaires et d'intégration, backend puis front (Vitest) | `backend/test/`, `frontend/src/**/*.test.{js,jsx}` |
| `npm run test:e2e` | tests de bout en bout dans Chromium (Playwright) ; démarre le front tout seul | `e2e/*.spec.js` |

La suite de non-régression (`e2e/tnr/`) rejoue les parcours existants avec un backend simulé (`e2e/fixtures/aides.js`) :

| Fichier | Parcours |
|---|---|
| `posts.spec.js` | génération d'un post (succès, description vide, erreur du backend), ressources, visuel IA et export PNG |
| `scraper.spec.js` | recherche, filtre, export CSV, persistance après actualisation, erreur de n8n |
| `navigation.spec.js` | dashboard (vide et rempli), recherche globale, paramètres, page 404, mobile 375 px, toutes les routes |

Un appel `/api` non prévu par la simulation fait échouer le test. La police Google et html-to-image sont servis en local : la suite tourne sans Internet.

- Pendant le développement : `npm run test:watch --prefix frontend` (ou `--prefix backend`) relance les tests à chaque sauvegarde.
- Avant le premier `test:e2e` sur une machine : `npx playwright install chromium`.
- Si le port 3000 sert déjà (front lancé à la main) : `E2E_PORT=3100 npm run test:e2e`.
- Le backend se teste sans ouvrir de port : `backend/src/app.js` construit l'application, `index.js` ne fait que la démarrer.

La CI (`.github/workflows/ci.yml`) lance lint, tests, build, synchro du design et tests de bout en bout à chaque push et à chaque pull request. Le rapport Playwright est joint au run.

## Sécurité

- Clés uniquement dans `backend/.env` et `~/n8n.env`, tous deux hors du dépôt.
- Comptes : mots de passe hachés, sessions par cookie httpOnly, limite de tentatives, lien de réinitialisation à usage unique (détails : [docs/architecture.md](docs/architecture.md#comptes-et-connexion)).
- Le backend limite les routes IA à 20 appels par minute et par compte (60 par IP), et ne relaie que 3 webhooks n8n.
- Chaque journal de post appartient au compte qui l'a généré : un compte ne voit jamais ceux d'un autre (tests d'isolation dans `backend/test/isolation.test.js`).
- La limite de dépense de la clé OpenRouter (sur openrouter.ai) reste la vraie protection en démo publique.
- Une ancienne clé Google figure dans l'historique git du dépôt public : la restreindre à « Custom Search API » dans Google Cloud, ou la remplacer.

## Feuille de route

Le détail, avec les critères d'acceptation et les tests de chaque lot, est dans [PLAN.md](PLAN.md).

| Phase | Contenu | État |
|---|---|---|
| 0 — Socle | tests et CI, PostgreSQL, comptes, isolation des données, reprise des données du navigateur | ✅ close · `L0.6` (coût IA) mis de côté |
| 1 — Scraping fiable | profils normalisés ✅, profils en base ✅, remplacement de Google (Serper, puis Brave) 🛠 clés à mettre, doublons, fiche détaillée | en cours |
| 2 — Offres d'emploi | saisie, sources autorisées (France Travail, Adzuna, Remotive), filtres | à venir |
| 3 — CV et Skill ATS | profil professionnel, CV ATS contrôlé, adapté à une offre, versions | à venir |
| 4 — Lettres et posts | lettres adaptées, posts et visuels enregistrés et versionnés | à venir |
| 5 — Candidatures | suivi par statut, relances, indicateurs réels | à venir |
| 6 — Multi-utilisateur | préférences, rôles, export et suppression de compte, quotas | à venir |
| 7 — Assistant IA | adéquation profil/offre, prochaines actions | plus tard |
| 8 — Commercialisation | hébergement, supervision, juridique, paiement | reportée |

**Date à tenir** : Google Custom Search s'arrête le **1er janvier 2027**. Le remplacement (`L1.4`) doit être en service avant.

Le plan d'origine (mai 2026) est gardé dans [docs/plan-initial.md](docs/plan-initial.md).

## Dépôts et branches

| Dépôt | Visibilité |
|---|---|
| [oussamaalmouallim/job-automation-](https://github.com/oussamaalmouallim/job-automation-) | public |
| [StackLLM/job-automation](https://github.com/StackLLM/job-automation) | privé |

- **`dev`** reçoit chaque version, dans les deux dépôts. La CI (lint, tests, build, tests de bout en bout) tourne à chaque push.
- **`main`** ne reçoit le travail qu'une fois tout validé, dans les deux dépôts en même temps. Un push sur `main` publie aussi le front sur GitHub Pages.

```bash
git push origin dev
```

```bash
git push stackllm dev
```

---

Développé par **Oussama AL MOUALLIM EL KANOUNI**.
