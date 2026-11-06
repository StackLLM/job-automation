# Recette — fin de Phase 1 (fiabilisation du scraping)

Faite le **06/11/2026** sur `dev`. Détail des lots : [PLAN.md, Phase 1](../../PLAN.md#phase-1--fiabilisation-du-scraping).

**Verdict** : la Phase 1 est recettée. `L1.1`, `L1.2`, `L1.3`, `L1.5`, `L1.6` et `L1.7` sont livrés. **`L1.4` reste ouvert** : son code est prêt, mais Serper et Brave n'ont pas encore de vraie clé. Les clés sont à mettre avant le **01/01/2027**, date d'arrêt de Google Custom Search.

## 1. Campagne automatique

| Suite | Résultat |
|---|---|
| Backend (Vitest, dont vraie base PostgreSQL) | 209 / 209 |
| Front (Vitest, Testing Library) | 74 / 74 |
| De bout en bout (Playwright : `TNR-GLOBAL`, comptes, profils, fiche, erreurs, suppression) | 62 / 62, stables sur 3 passages |
| `TS-ISOLATION` (journaux, posts, paramètres, profils, recherches, suppression) | 19 tests sur deux vrais comptes, tous verts |
| Lint backend et front, build, `verifier-synchro` du design | verts |

## 2. Test de bascule (réel)

Les appels vont aux vrais services : Serper, Brave et le workflow n8n, qui interroge Google Custom Search.

- Serper et Brave reçoivent des clés volontairement fausses. Aucune vraie clé n'existe encore, et rien de secret n'est envoyé.
- La base utilisée est un schéma à part, supprimé à la fin.

| Scénario | Attendu | Obtenu |
|---|---|---|
| Serper et Brave refusent leur clé | n8n prend le relais | 200, source n8n, secours signalé, 10 profils |
| Serper refuse sa clé, Brave sans clé | n8n prend le relais | 200, source n8n, secours signalé |
| Clés refusées et n8n injoignable | message clair | 502 « aucun fournisseur n'a répondu », cause `indisponible` |
| n8n seul, injoignable | message clair | 502, cause `indisponible` |

**Écart trouvé et corrigé.** Brave ne refuse pas une clé invalide par un code 401 ou 403. Il répond **422** avec le code `SUBSCRIPTION_TOKEN_INVALID`.

- Avant la correction, ce refus était classé « autre erreur ». Si Brave avait été la seule source en panne, l'écran aurait dit « aucune source n'a répondu » au lieu de « clé refusée ».
- Le refus est maintenant reconnu comme une clé refusée (`backend/src/profils/fournisseurs/pagination.js`). Un test reprend la réponse réelle de Brave.
- Revérifié en vrai : Serper et Brave sont tous deux classés « clé refusée ».

## 3. Test de persistance (réel)

Le parcours passe par le vrai backend, la vraie base et une vraie recherche n8n de 2 pages.

| Étape | Résultat |
|---|---|
| Inscription par le formulaire, recherche de 2 pages depuis le Scraper | « Recherche terminée : 20 nouveaux — source : n8n (Google) » |
| Note ajoutée sur un profil depuis sa fiche | « Note enregistrée » |
| Actualisation | 20 profils, marque de note présente |
| Déconnexion, puis navigateur vidé (`localStorage` effacé) | l'API répond 401 |
| Reconnexion par le formulaire | retour sur le Scraper, 20 profils, note retrouvée ; le navigateur ne garde aucun profil |
| Autre client (curl, sa propre session, directement sur le backend) | 20 profils, la même note, la recherche d'origine (2 pages, n8n, 20 trouvés) |

Le compte de test a été supprimé ensuite. La base de développement n'a plus aucun compte ni profil.

## 4. Vérifications réelles faites pendant les lots

| Lot | Vérification |
|---|---|
| `L1.1` | Recherche réelle : 10 profils enregistrés, 0 nouveau au second passage ; import d'un navigateur ancien |
| `L1.3` | Profil abîmé en base, remis à jour par la recherche suivante sans changer sa date d'ajout |
| `L1.5` | Fiche, étiquette et note retrouvées après actualisation, en bureau et à 375 px |
| `L1.6` | Recherche de 5 pages annulée après 2 s : rien d'enregistré. Le premier essai avait montré que le proxy Vite ne transmet pas la coupure au backend ; d'où l'annulation explicite |
| `L1.7` | 3 profils sur 10 cochés puis supprimés : 7 après actualisation |

## 5. Ce qui n'est pas tenu, ou reste à faire

- **`L1.4`** : mettre les clés `SERPER_API_KEY` et `BRAVE_API_KEY` dans `backend/.env`, puis comparer la qualité des résultats sur 5 requêtes (`docs/sources.md`). La bascule et les messages d'erreur sont prêts.
- **Pas de progression page par page** : n8n reçoit toutes les pages en un seul appel. À revoir quand Serper ou Brave seront actifs.
- **Historique de collecte réduit** à la date d'ajout, la date de dernière collecte et la recherche d'origine.
- **Pas de lien entre profils et offres** : il arrive en Phase 2 (`L2.5`).
- **Pas de capture d'écran dans ce dossier** : les captures montrent de vraies personnes, et le dépôt `origin` est public.
