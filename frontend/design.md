# Design — LinkedAI (direction artistique Nexora)

| | |
|---|---|
| Source visuelle | https://dribbble.com/shots/27778607-Nexora-Modern-Digital-Banking-Dashboard |
| Relevé le | 2026-10-26 |
| Nature de la source | une image fixe 2048 × 1536 (pas de site, pas de code) |
| Droits | maquette de Hira Riaz pour Upnow Studio. On reprend la **direction artistique** (couleurs, composition, rythme). Aucun texte, logo, photo ni donnée de la maquette n'est copié. |
| Largeurs de référence | 1440 · 1024 · 768 · 375 |
| Stack clone | Vite 5 + React 18 (JavaScript) + Tailwind 3 + framer-motion 11 + lucide-react + composants Lightswind (MIT) portés en JSX |
| Source fonctionnelle | l'application LinkedAI existante : routes, store, appels API inchangés |

La maquette décide de l'apparence. L'application existante décide des
fonctions. Rien de bancaire n'est gardé : chaque bloc de la maquette reçoit une
donnée réelle de LinkedAI, ou n'est pas repris.

## 1. Pages et routes

| ID | Route | Rôle | Gabarit | Statut | Origine |
|---|---|---|---|---|---|
| P-01 | `/dashboard` | vue d'ensemble, données du store | C-01 | refait sur la maquette | Déduit |
| P-02 | `/posts` | générateur de posts LinkedIn, ressources, visuel IA, historique | C-01 | refait, logique gardée | Approximé |
| P-03 | `/scraper` | lancement du scraper, liste des profils triée et filtrée, fiche profil (`?profil=<id>`), export CSV | C-01 | refait, logique gardée | Approximé |
| P-04 | `/lettre` | lettre de motivation (Phase 2) | C-01 | page d'attente C-25 | Approximé |
| P-05 | `/offres` | recherche d'offres (Phase 3) | C-01 | page d'attente C-25 | Approximé |
| P-06 | `/settings` | compte et déconnexion, modèle et ton par défaut, webhook du scraper, à propos | C-01 | refait, logique gardée | Approximé |
| P-07 | `/connexion` | connexion par e-mail et mot de passe (lot L0.4) | C-30 | nouveau, hors cadre C-01 | Déduit |
| P-08 | `/inscription` | création de compte (lot L0.4) | C-30 | nouveau, hors cadre C-01 | Déduit |
| P-09 | `/mot-de-passe-oublie` | demande d'un lien de réinitialisation (lot L0.4) | C-30 | nouveau, hors cadre C-01 | Déduit |
| P-10 | `/reinitialiser` | nouveau mot de passe depuis le lien de l'e-mail (lot L0.4) | C-30 | nouveau, hors cadre C-01 | Déduit |
| P-99 | `*` | page introuvable | C-01 | nouveau (aucune route ne tombe sur un écran blanc) | Approximé |

`/` redirige vers `/dashboard`, comme avant.

## 2. Navigation et parcours

- Sidebar (C-02), dans l'ordre : Dashboard · Générateur de posts · Scraper LinkedIn · Lettre de motivation · Offres d'emploi · Paramètres.
- Item actif : choisi par la route (`NavLink`), fond qui glisse (A-06).
- < 768 px : la sidebar devient une barre basse à 6 icônes (comportement existant gardé).
- Recherche (C-04) : pages et posts de l'historique ; Entrée ouvre le premier résultat.
- Cloche (C-05) : activité récente réelle (derniers posts et profils du store).
- Parcours clés :
  - Dashboard → « Générer un post » → P-02 → Copier / Ressources / Visuel.
  - Dashboard → « Scraper » → P-03 → Lancer → Exporter CSV.
  - Dashboard → « Exporter les profils » (C-20) → fichier CSV direct.
  - Paramètres → webhook scraper → P-03 l'utilise.

## 3. Gabarit

### C-01 — Cadre de l'application
- Structure : sidebar (C-02) · barre du haut (C-03) · contenu qui défile.
- Toutes largeurs : l'app occupe toute la fenêtre, fond `--couleur-app`. Pas de cadre arrondi ni de fond extérieur (écart volontaire avec la maquette, demandé le 2026-10-26).
- ≥ 768 px : la sidebar et la barre du haut restent fixes, seul le contenu défile.
- Fichier : `src/components/layout/Layout.jsx`.

## 4. Pages, section par section

### P-01 — Dashboard

| # | Bloc Nexora | Bloc LinkedAI | Composants | @1440 | @1024 | @375 | Origine |
|---|---|---|---|---|---|---|---|
| 1 | « GOOD MORNING / Darren » + visuel satin et carte | « BONJOUR / Oussama » + carte visuelle LinkedAI | C-13, C-14 | texte à gauche, carte à droite | idem | carte masquée | Déduit |
| 2 | Total Balance | Posts générés + 3 compteurs secondaires (profils, lettres, offres) | C-15, C-22 | posée sur le bas du hero | idem | pleine largeur | Déduit |
| 3 | Send / Pay / Top Up / More | Générer un post · Scraper · Lettre · Offres | C-16 | 4 colonnes | 4 colonnes | 2 × 2 | Déduit |
| 4 | Recent Transactions | Derniers posts générés | C-17 | colonne gauche | idem | 1 colonne | Déduit |
| 5 | Spending Overview | Répartition des posts par type, filtre de période | C-18 | colonne droite | idem | 1 colonne | Déduit |
| 6 | Insights | Posts générés par jour (7 jours) + comparaison avec la semaine précédente | C-19 | colonne de droite | sous la grille | 1 colonne | Déduit |
| 7 | Goals | Derniers profils scrapés | C-17 | colonne de droite | sous la grille | 1 colonne | Déduit |
| 8 | Quick Actions | Exporter les profils · Configurer n8n · Ouvrir LinkedIn | C-20 | colonne de droite | sous la grille | 1 colonne | Déduit |

### P-02 — Générateur de posts
| # | Section | Composants | Mise en page | Origine |
|---|---|---|---|---|
| 1 | Paramètres du post (type, description, technologies, ton, modèle) | C-06, C-08, C-07 | 2 colonnes ≥ 768, sinon empilé | Approximé |
| 2 | Résultat : onglets Post / Ressources / Visuel IA | C-06, C-11, C-21 | colonne droite | Approximé |
| 3 | Historique (charger un ancien post) | C-06, C-17 | pleine largeur | Approximé |

### P-03 — Scraper LinkedIn
| # | Section | Composants | Mise en page | Origine |
|---|---|---|---|---|
| 1 | Lancement (requête, localisation, pages) + état du webhook | C-06, C-08, C-09 | 3 champs en ligne ≥ 768 | Approximé |
| 2 | Profils : tri, filtres (texte, recherche, source, étiquette), export CSV, vider ; fiche C-34 | C-06, C-33, C-34, C-10 | liste de cartes sur une colonne ; fiche en plein écran | Approximé |

### P-04, P-05 — Pages d'attente
- Bloc C-25 : icône, titre, phase prévue, ce que la page fera, retour au dashboard.

### P-06 — Paramètres
- Carte « Connexion n8n » (C-06, C-08) et carte « À propos ».

## 5. Composants

| ID | Nom | Rôle | Fichier | Origine |
|---|---|---|---|---|
| C-02 | Sidebar | logo, navigation, carte profil en bas | `src/components/layout/Sidebar.jsx` | Déduit |
| C-03 | Barre du haut | titre de page, recherche, cloche, avatar | `src/components/layout/Topbar.jsx` | Déduit |
| C-04 | Recherche globale | pilule « Rechercher… » avec résultats | `src/components/layout/RechercheGlobale.jsx` | Déduit |
| C-05 | Notifications | cloche + point `--couleur-alerte`, menu d'activité récente | `src/components/layout/Notifications.jsx` | Déduit |
| C-06 | Carte | surface `--couleur-surface`, rayon `--rayon-carte`, en-tête titre + lien « Voir tout » | `src/components/ui/Card.jsx` | Déduit |
| C-07 | Bouton | variantes `primaire` (noir), `secondaire` (surface + bordure), `fantome` | `src/components/ui/Button.jsx` | Déduit |
| C-08 | Champs | `Field`, `Input`, `Select`, `Textarea`, libellé + aide + erreur | `src/components/ui/Field.jsx` | Approximé |
| C-09 | Pastille | `succes`, `attention`, `neutre`, `danger` | `src/components/ui/Badge.jsx` | Déduit (pastille « ↑ 12% ») |
| C-10 | État vide / erreur | icône, titre, texte, action | `src/components/ui/EmptyState.jsx` | Approximé |
| C-11 | Onglets | pilules, onglet actif plein | `src/components/ui/Tabs.jsx` | Déduit (sélecteur « This Month ») |
| C-12 | Page | conteneur + cascade d'entrée A-02 | `src/components/ui/Page.jsx` | Approximé |
| C-13 | Accueil | surtitre espacé, prénom `--taille-hero`, sous-titre | `src/components/dashboard/Accueil.jsx` | Déduit |
| C-14 | Carte visuelle | carte crème inclinée, puce, logo, 2 cercles | `src/components/dashboard/CarteVisuelle.jsx` | Déduit (carte bancaire) |
| C-15 | Carte chiffre clé | libellé, grand chiffre, pastille, flèche | `src/components/dashboard/CarteChiffre.jsx` | Déduit |
| C-16 | Actions rapides | 4 boutons, le premier en primaire | `src/components/dashboard/ActionsRapides.jsx` | Déduit |
| C-17 | Liste d'activité | icône ronde, titre, date, valeur à droite | `src/components/ui/ListeActivite.jsx` | Déduit (Recent Transactions) |
| C-18 | Donut | anneau à segments, total au centre, légende avec % | `src/components/charts/Donut.jsx` | Déduit |
| C-19 | Histogramme | barres arrondies, dernière barre en accent | `src/components/charts/Histogramme.jsx` | Déduit |
| C-20 | Liste d'actions | icône, libellé, chevron | `src/components/dashboard/ListeActions.jsx` | Déduit (Quick Actions) |
| C-21 | Générateur de visuel | appel n8n, aperçu iframe, export PNG | `src/components/posts/VisualCardGenerator.jsx` | Approximé |
| C-22 | Compteur | Lightswind Count Up | `src/components/lightswind/CountUp.jsx` | Lightswind |
| C-23 | Barre de progression | Lightswind Top Loader | `src/components/lightswind/TopLoader.jsx` | Lightswind |
| C-25 | Page d'attente | fonction prévue, phase, retour | `src/components/ui/PageAttente.jsx` | Approximé |
| C-30 | Cadre des pages de compte | fond de l'app, logo, carte centrée (C-07), liens en pied | `src/components/auth/CadreAuth.jsx` | Déduit |
| C-31 | Garde des routes | chargement de la session, puis des posts et paramètres du compte ; renvoi vers `/connexion` ou `/dashboard` | `src/components/auth/RouteProtegee.jsx` | Déduit |
| C-32 | Import des données du navigateur | bandeau en haut du contenu : « Importer » ou « Plus tard » ; données effacées seulement après un import réussi (lot L0.7) | `src/components/compte/ImportNavigateur.jsx` | Déduit |
| C-33 | Carte d'un profil | photo ou initiale, nom, poste · entreprise, lieu, source, date de collecte, étiquettes ; toute la carte ouvre la fiche (lot L1.5, remplace la table C-33) | `src/components/profils/CarteProfil.jsx` | Déduit |
| C-34 | Fiche profil | panneau à droite sur voile `--voile-sombre`, plein écran sous 640 px ; informations, extrait, étiquettes, note, historique de collecte, suppression confirmée dans le panneau ; Échap ferme (lot L1.5) | `src/components/profils/FicheProfil.jsx` | Déduit |
| C-35 | Confirmation de suppression | encadré `role="alertdialog"` : nombre de profils, « définitive », « Annuler » ou confirmer ; sert à la fiche, à la sélection et à « Vider » (lot L1.7) | `src/components/profils/ConfirmationSuppression.jsx` | Déduit |

## 6. Typographie appliquée

| Niveau | Famille | Taille @1440 | @375 | Graisse | Casse | Origine |
|---|---|---|---|---|---|---|
| Prénom (hero) | `--police-texte` | `--taille-hero` (48 px) | 34 px | 700 | — | Déduit |
| Chiffre clé | `--police-texte` | `--taille-kpi` (36 px) | 30 px | 700 | — | Déduit |
| Titre de carte | `--police-texte` | 15 px | 15 px | 600 | — | Déduit |
| Surtitre | `--police-texte` | 11 px, `--lettres-surtitre` | idem | 500 | capitales | Déduit |
| Texte | `--police-texte` | 14 px | 14 px | 400 | — | Déduit |
| Méta (dates) | `--police-texte` | 12 px | 12 px | 400 | — | Déduit |

## 7. Responsive

| Point de rupture | Ce qui change | Origine |
|---|---|---|
| < 768 px | barre de navigation basse, recherche réduite à une icône, carte visuelle masquée | Approximé |
| ≥ 768 px | sidebar latérale `--largeur-sidebar` | Approximé |
| ≥ 1280 px | dashboard en 2 zones : grille principale + colonne de droite | Déduit |

## 8. États de page

| État | Où | Rendu | Origine |
|---|---|---|---|
| Chargement IA / scraper | P-02, P-03, C-21 | bouton désactivé avec texte d'attente + barre C-23 | Approximé |
| Vide | listes du dashboard, résultat de post, ressources, profils | C-10 avec action vers la bonne page | Approximé |
| Erreur | appels OpenRouter / n8n | toast d'erreur (comportement existant) | Approximé |
| Recherche de profils en cours | P-03 | bandeau `role="status"` sur `--couleur-surface-douce` : pages demandées, secondes écoulées, bouton « Annuler la recherche » ; squelettes à la forme de C-33 quand la liste est vide (lot L1.6) | Déduit |
| Erreur de recherche | P-03 | toast d'erreur, une phrase claire par cas : réseau, délai, session, refus, trop de recherches, quota, clé, source lente ou indisponible, serveur (`src/lib/messagesRecherche.js`) ; une annulation donne un toast neutre (lot L1.6) | Déduit |
| Confirmation de suppression | P-03, C-34 | C-35 : « Vider », sélection (cases à cocher sur C-33, « Tout sélectionner » limité aux profils affichés) et fiche (lots L1.6, L1.7) | Déduit |
| Webhook non configuré | P-03 | pastille `attention` + bouton qui renvoie aux paramètres | Approximé |
| 404 | P-99 | C-10 + retour au dashboard | Approximé |

## 9. Points d'intégration backend

Tous dans `src/services/api.js`, tous via le backend (`API_BASE` = `/api` en local, `VITE_API_URL` en démo). Le front ne contient aucune clé.

| Fonction | Utilisée par | Cible |
|---|---|---|
| `generatePost` | P-02 | backend `POST /api/posts/generate` → OpenRouter, log enregistré |
| `getResources` | P-02 | backend `POST /api/n8n/resource-suggestions` → n8n |
| `generateVisual` | C-21 | backend `POST /api/n8n/generate-visual` → n8n |
| appel direct axios | P-03 | webhook scraper : paramètres, `VITE_N8N_SCRAPER_WEBHOOK`, sinon backend `POST /api/n8n/scraper` |
| — | P-04, P-05 | à créer en Phase 2 et 3 (lettre, offres) : nouvelle fonction ici + webhook autorisé côté backend |

## 10. Correspondance maquette → app

| Élément Nexora | Composant | Donnée LinkedAI |
|---|---|---|
| logo « Nexora. » | C-02 | « LinkedAI. » |
| item de nav actif | C-02, A-06 | route courante |
| « Search for anything… » | C-04 | pages + historique des posts |
| cloche + point rouge | C-05 | activité récente du store |
| « Total Balance » | C-15 | nombre de posts générés |
| « ↑ 12% » | C-09 | posts des 7 derniers jours |
| Recent Transactions | C-17 | `posts` du store |
| Spending Overview | C-18 | `posts` groupés par `type` |
| Insights | C-19 | `posts` groupés par jour |
| Goals | C-17 | `scrapedProfiles` du store |
| Quick Actions | C-20 | export CSV, paramètres, LinkedIn |
| carte « Darren Carter » | C-02 | profil du propriétaire (`src/lib/profil.js`) |

## 11. Limites

- Une image ne montre ni survol, ni animation, ni version mobile : ces points sont Approximé.
- La photo de satin et la photo « Dubai Trip » ne sont pas reprises (droits). Le satin est remplacé par `--degrade-hero`.
- La police exacte n'est pas lisible : Inter est un choix proche (Déduit).
- La comparaison automatique par empreintes de CloneMe ne s'applique pas : il n'y a pas de page source à mesurer. La comparaison se fait sur captures.
