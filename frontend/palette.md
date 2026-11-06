# Palette — LinkedAI (direction artistique Nexora)

Ce fichier est la référence. `src/styles/tokens.css` en est le miroir exact.
Changer une valeur ici, puis demander « applique palette.md » : le code suit.

Source : maquette Dribbble « Nexora — Modern Digital Banking Dashboard »
(Hira Riaz pour Upnow Studio), une **image** de 2048 × 1536 px. Il n'y a pas de
CSS à lire : les couleurs « Mesuré » sont des pixels relevés sur l'image, les
autres valeurs sont « Déduit » (lues à l'œil) ou « Approximé » (invisibles sur
la maquette, choix cohérent assumé).

## Couleurs — fonds

| Variable | Valeur | Origine | Usage |
|---|---|---|---|
| `--couleur-app` | `#F8F7F3` | Mesuré (pixel, sidebar et fond du cadre) | fond de toute l'application, sidebar, barre du haut |
| `--couleur-surface` | `#FDFBF9` | Mesuré (pixel, cartes) | cartes, champs, menus |
| `--couleur-surface-douce` | `#F1F0EC` | Mesuré (pixel, item de nav actif) | item actif, survols, pastilles neutres |
| `--couleur-surface-creuse` | `#F3F1ED` | Mesuré (pixel, barres claires de l'histogramme) | barres inactives, fond des jauges |
| `--couleur-ligne` | `#ECE9E3` | Déduit (séparateurs relevés à `#F3F4F1`, assombris pour rester visibles) | bordures, séparateurs |

## Couleurs — texte

| Variable | Valeur | Origine | Usage |
|---|---|---|---|
| `--couleur-texte` | `#141414` | Déduit (titres quasi noirs, pixels JPEG bruités) | titres, texte principal |
| `--couleur-texte-doux` | `#6E6C67` | Déduit | sous-titres, libellés |
| `--couleur-texte-pale` | `#A3A09A` | Déduit | dates, aides, placeholders |

## Couleurs — actions et accents

| Variable | Valeur | Origine | Usage |
|---|---|---|---|
| `--couleur-primaire` | `#141A13` | Mesuré (pixel, bouton « Send ») | bouton principal, action rapide principale |
| `--couleur-primaire-survol` | `#2A3128` | Approximé | survol du bouton principal |
| `--couleur-sur-primaire` | `#FFFFFF` | Déduit | texte sur fond primaire |
| `--couleur-accent` | `#1E4737` | Mesuré (pixel, barre active « Jun ») | barre active, jauge, liens d'accent |
| `--couleur-accent-pale` | `#E5F7E8` | Mesuré (pixel, pastille « ↑ 12% ») | pastilles positives |
| `--couleur-succes` | `#0E542C` | Mesuré (pixel, texte « + AED 25,000 ») | texte positif, pastilles positives |

## Couleurs — graphiques

| Variable | Valeur | Origine | Usage |
|---|---|---|---|
| `--couleur-olive` | `#6E7652` | Mesuré (pixel, segment « Shopping » du donut) | série 1 |
| `--couleur-peche` | `#FAAD8A` | Mesuré (pixel, segment « Food & Dining ») | série 2 |
| `--couleur-sable` | `#E5DCCF` | Mesuré (pixel, segment beige) | série 3 |
| `--couleur-brume` | `#DBDCD5` | Mesuré (pixel, segment gris clair) | série 4, reste du donut |
| `--couleur-lavande` | `#C7B3D3` | Approximé (pastille « Transport », trop petite pour un relevé fiable) | série 5 |

## Couleurs — états

| Variable | Valeur | Origine | Usage |
|---|---|---|---|
| `--couleur-alerte` | `#FD1214` | Mesuré (pixel, point de la cloche) | point de notification |
| `--couleur-danger` | `#B42318` | Approximé | messages d'erreur |
| `--couleur-danger-pale` | `#FDECEA` | Approximé | fond des erreurs |
| `--couleur-attention` | `#9A6A12` | Approximé | avertissements |
| `--couleur-attention-pale` | `#FBF3E2` | Approximé | fond des avertissements |

## Voiles et dégradés

| Variable | Valeur | Origine | Usage |
|---|---|---|---|
| `--voile-blanc` | `rgba(255, 255, 255, 0.72)` | Déduit (barre de recherche posée sur le visuel) | recherche, éléments posés sur le hero |
| `--voile-sombre` | `rgba(20, 26, 19, 0.35)` | Approximé | fond derrière un menu mobile ; voile de la fiche profil (C-34), classe `bg-voile` |
| `--degrade-hero` | `radial-gradient(120% 95% at 72% 18%, #FFFFFF 0%, #F1ECE5 42%, #E4DACE 100%)` | Approximé (remplace la photo de satin, non réutilisable) | fond du bloc d'accueil |
| `--degrade-carte` | `linear-gradient(135deg, #FBFAF7 0%, #EEE8E0 55%, #DCD2C5 100%)` | Approximé (d'après la carte bancaire crème) | carte visuelle LinkedAI |
| `--degrade-puce` | `linear-gradient(135deg, #E9DFC9 0%, #CDBF9F 100%)` | Approximé | puce de la carte visuelle |

## Bordures et ombres

| Variable | Valeur | Origine | Usage |
|---|---|---|---|
| `--ombre-carte` | `0 1px 2px rgba(20, 26, 19, 0.04)` | Déduit (cartes presque plates) | cartes au repos |
| `--ombre-survol` | `0 10px 24px -12px rgba(20, 26, 19, 0.18)` | Approximé | cartes cliquables au survol |
| `--ombre-flottante` | `0 28px 50px -18px rgba(60, 45, 30, 0.35)` | Déduit (ombre douce sous la carte bancaire) | carte visuelle du hero |
| `--ombre-menu` | `0 18px 40px -16px rgba(20, 26, 19, 0.22)` | Approximé | menus déroulants |
| `--anneau-focus` | `0 0 0 3px rgba(30, 71, 55, 0.18)` | Approximé | focus clavier des champs |

## Typographie

| Variable | Valeur | Origine | Usage |
|---|---|---|---|
| `--police-texte` | `"Inter", system-ui, -apple-system, sans-serif` | Déduit (grotesque géométrique, police exacte non lisible) | tout le texte |
| `--police-mono` | `"JetBrains Mono", ui-monospace, monospace` | Relevé (police déjà chargée par le projet) | code, identifiants |
| `--taille-hero` | `3rem` | Déduit (« Darren » ≈ 48 px pour un cadre de 1440 px) | prénom du bloc d'accueil |
| `--taille-kpi` | `2.25rem` | Déduit (« AED 28,450.00 ») | chiffre principal |
| `--lettres-surtitre` | `0.18em` | Déduit (« GOOD MORNING » très espacé) | surtitres en capitales |

## Rayons

| Variable | Valeur | Origine | Usage |
|---|---|---|---|
| `--rayon-carte` | `18px` | Déduit | cartes |
| `--rayon-controle` | `12px` | Déduit (boutons d'action, champ de recherche) | boutons, champs, items de nav |
| `--rayon-pilule` | `999px` | Déduit | pastilles, recherche |

## Dimensions

| Variable | Valeur | Origine | Usage |
|---|---|---|---|
| `--largeur-sidebar` | `232px` | Déduit (≈ 16 % du cadre) | sidebar ≥ 768 px |
| `--hauteur-topbar` | `72px` | Déduit | barre du haut |
| `--hauteur-nav-mobile` | `64px` | Approximé (pas de version mobile sur la maquette) | barre de navigation basse < 768 px |

## Points de rupture

Les `@media` ne lisent pas les variables CSS : ces valeurs restent celles de
Tailwind par défaut (`tailwind.config.js`).

| Nom Tailwind | Valeur | Origine |
|---|---|---|
| `md` | `min-width: 768px` | Approximé : sidebar latérale au lieu de la barre basse |
| `lg` | `min-width: 1024px` | Approximé : grilles à 2 colonnes (posts, dashboard) |
| `xl` | `min-width: 1280px` | Approximé : colonne de droite du dashboard |

## Implémentation

- `src/styles/tokens.css` déclare chaque variable ci-dessus dans `:root`.
- `tailwind.config.js` expose les tokens : `colors.primaire = 'var(--couleur-primaire)'`.
- Les composants utilisent les classes Tailwind ou `var(--…)`. Jamais une valeur en dur.
- Retiré le 2026-10-26 : `--couleur-fond-ext` (`#E5DBD3`), `--ombre-cadre` et `--rayon-cadre`. La maquette pose l'app dans un cadre arrondi sur un fond taupe ; ici l'app occupe toute la fenêtre, sur `--couleur-app`.
- Limite connue : les couleurs passent par `var()`, donc les modificateurs
  d'opacité Tailwind (`bg-primaire/50`) ne marchent pas. Créer un token à la place.
