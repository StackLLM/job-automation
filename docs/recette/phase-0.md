# Recette — fin de Phase 0 (socle technique)

Close le **31/10/2026**. Détail des lots : [PLAN.md, Phase 0](../../PLAN.md#phase-0--socle-technique).

## Campagne automatique

| Suite | Résultat |
|---|---|
| Backend (Vitest, dont vraie base PostgreSQL) | 147 / 147 |
| Front (Vitest, Testing Library) | 29 / 29 |
| De bout en bout (Playwright, `TNR-GLOBAL` et comptes) | 37 / 37, stables sur 3 passages |
| `TS-ISOLATION` | journaux (L0.5), posts et paramètres (L0.7), sur deux vrais comptes |
| CI GitHub (`dev`, deux dépôts) | verte au dernier push ; à revoir au push de L0.7 |

## Recette manuelle

Faite dans le navigateur, sur le vrai backend et la vraie base. Les comptes de test ont été supprimés ensuite.

| Vérification | Lot | Résultat |
|---|---|---|
| Inscription, cookie illisible depuis JavaScript, déconnexion → 401 | L0.4 | ✅ |
| Mot de passe oublié : lien, ancien mot de passe refusé, lien à usage unique | L0.4 | ✅ |
| Deux comptes : chacun ne voit que ses journaux | L0.5 | ✅ |
| Navigateur préparé (2 posts, ton « Startup ») → bandeau d'import → 2 posts au dashboard, ton repris par le générateur, navigateur vidé | L0.7 | ✅ |
| Scraper par le backend : 10 profils, 0 rejet, source n8n | L1.2 | ✅ |

## Ce qui n'est pas tenu

- **Coût IA par utilisateur** (`L0.6`) : mis de côté sur décision. Aucun appel IA n'est compté.
- **Profils** : encore dans le navigateur, sans lien avec le compte, jusqu'à `L1.1`.
- **Démo en ligne** : front et backend doivent être sur le même site pour que le cookie de session passe (`docs/demo.md`).
