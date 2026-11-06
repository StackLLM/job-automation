# Vision — Job Automation (LinkedAI)

> **« De l'offre à la candidature suivie, avec un CV ATS contrôlé et des contenus qui ne mentent pas. »**

Ce document résume **pourquoi** le produit existe, **pour qui**, et **dans quel ordre** il se construit.
Le détail technique, phase par phase et lot par lot, est dans [PLAN.md](../PLAN.md). L'architecture actuelle est dans [architecture.md](architecture.md).

État au **31/10/2026**.

---

## 1. Le problème

Une recherche d'emploi sérieuse jongle avec cinq outils qui ne se parlent pas :

1. **Trouver** des contacts et des offres : LinkedIn, sites d'emploi, tableurs.
2. **Adapter un CV** à chaque offre, en passant les filtres automatiques des recruteurs (ATS).
3. **Écrire** des lettres de motivation et des posts pour rester visible.
4. **Suivre** les candidatures : qui a répondu, quelle relance, quel entretien.
5. **Mesurer** sa progression, souvent sans chiffres fiables.

Les outils du marché couvrent un ou deux de ces points. Ils sont pensés pour le marché américain, facturés entre environ 24 et 50 $ par mois, et certains « inventent » des réponses ou des expériences, ce que leurs utilisateurs leur reprochent. Le détail est en [PLAN.md, section 5](../PLAN.md#5-étude-concurrentielle).

## 2. La réponse

Un **assistant complet de recherche d'emploi**, où chaque objet est **relié** aux autres et **rattaché à un compte** :

```text
Profils & contacts ──┐
                     ├──▶ Offre ──▶ CV adapté ──┐
Profil professionnel ┘              Lettre ─────┼──▶ Candidature ──▶ Suivi & progression
                                    Posts LinkedIn (visibilité) ─────┘
```

- **Un CV est généré pour une offre**, à partir du profil professionnel de l'utilisateur.
- **Une candidature porte** l'offre, le CV et la lettre envoyés, dans leur version exacte.
- **Un profil trouvé** peut être le recruteur ou un contact utile d'une offre.
- **Les indicateurs** sont calculés à partir de ces liens réels, jamais inventés.

## 3. Pour qui

Les cibles sont des hypothèses, à valider par des entretiens :

| Cible | Besoin principal |
|---|---|
| Ingénieurs et profils tech francophones (Maroc, France) en recherche active | CV ATS fiable, suivi des candidatures, visibilité LinkedIn |
| Jeunes diplômés, personnes en reconversion | être guidé de l'offre à la candidature |
| Écoles, bootcamps, cabinets d'outplacement (plus tard) | suivre une cohorte de candidats |

## 4. Ce qui nous distingue

| Atout | Pourquoi c'est rare | Ce qui l'appuie déjà |
|---|---|---|
| **CV ATS contrôlé automatiquement** : lecture ATS du PDF, une page, cohérence | les concurrents notent le CV ; peu vérifient le PDF produit | Skill `cv-ats` (StackLLM) |
| **Zéro invention**, outillé : `a_confirmer`, contrôle des faits | des inventions sont reprochées à plusieurs concurrents | règle absolue de la Skill CV ; contrôle prévu en `L3.2`, `L3.4`, `L4.4` |
| **Francophone, Maroc et France** : langue, photo selon le marché, sources d'offres locales | la plupart des outils visent les USA | décision `D-09` (français) ; règles par marché de la Skill CV |
| **Marque personnelle LinkedIn intégrée** : posts, visuels | rare dans les outils de suivi | générateur de posts et visuel IA en service |
| **Coûts maîtrisés** : DeepSeek, open source, auto-hébergeable | permet un prix bas | stack actuelle |
| **Jamais d'envoi automatique** sans validation humaine | l'envoi automatique est un risque de réputation chez certains concurrents | principe de la Phase 7 |

## 5. Principes

1. **Ne rien inventer.** Une information manquante devient une question à l'utilisateur, jamais une supposition.
2. **Respecter les sources.** Conditions d'utilisation lues avant chaque intégration ; aucun contournement de protection (connexion simulée, faux comptes, rotation d'adresses).
3. **Les données appartiennent au compte.** Isolation testée sur chaque ressource (`TS-ISOLATION`) ; export et suppression complète prévus (`L6.4`).
4. **Une fonction n'est terminée que si ses données, sa persistance et ses erreurs sont vérifiées**, pas seulement son écran.
5. **Des chiffres réels.** Aucun indicateur sans données ; un état vide explicite.
6. **Coûts visibles.** Chaque appel IA sera compté par utilisateur (`L0.6`, mis de côté pour l'instant), avec des quotas avant toute ouverture payante.

## 6. Où en est-on

| Capacité | État | Lots |
|---|---|---|
| Socle : tests, CI, PostgreSQL, comptes, isolation, posts et paramètres sur le compte, reprise du navigateur | ✅ en service | `L0.1` à `L0.5`, `L0.7` |
| Générateur de posts, ressources, visuel IA | ✅ en service | existant |
| Recherche de profils par le backend, profils normalisés | ✅ en service | `L1.2` |
| Remplacement de Google Custom Search (fin le 01/01/2027) : Serper, puis Brave, n8n en secours | 🛠 code prêt, clés à mettre | `L1.4` |
| Coût IA par utilisateur | ⏸ mis de côté | `L0.6` |
| Profils en base, rattachés au compte, avec leur recherche d'origine | ✅ en service | `L1.1` |
| Profils sans doublon, mis à jour quand on les retrouve | ✅ en service | `L1.3` |
| Fiche profil : note, étiquettes, tri et filtres | ✅ en service | `L1.5` |
| Messages d'erreur clairs, recherche annulable, « Vider » confirmé | ✅ en service | `L1.6` |
| Suppression choisie : un profil, une sélection ou tous, toujours confirmée | ✅ en service | `L1.7` |
| Offres d'emploi | 🆕 | Phase 2 |
| CV adapté à une offre (Skill ATS) | 🆕 | Phase 3 |
| Lettres, posts versionnés | 🆕 | Phase 4 |
| Suivi des candidatures et progression | 🆕 | Phase 5 |
| Personnalisation, durcissement multi-utilisateur | 🆕 | Phase 6 |
| Assistant IA : adéquation, prochaines actions | 🔭 plus tard | Phase 7 |
| Commercialisation : hébergement, paiement, juridique | ⏸ reportée | Phase 8 |

## 7. Décisions prises

| Sujet | Décision |
|---|---|
| Source des profils | service de recherche payant sur sa part gratuite (Serper, puis Brave), n8n en secours |
| Base de données | PostgreSQL |
| Comptes | Better Auth (MIT) |
| Profils de tiers | supprimés seulement par l'utilisateur ; risque juridique suivi (`R-11`) |
| Skill CV | copiée dans le dépôt ; tous les dépôts sont publics depuis le 06/11/2026 (`D-14`) |
| Langue | français |
| Dépôts | `oussamaalmouallim/job-automation-` et `StackLLM/job-automation`, tous deux publics |
| Branches | les versions vont sur `dev` ; `main` seulement après validation, dans les deux dépôts |
| Hébergement, nom commercial, paiement | reportés avec la Phase 8 |

Le détail et les raisons de chaque décision sont dans [PLAN.md, section 7](../PLAN.md#7-décisions).

## 8. Modèle économique (pistes, sans tarif fixé)

- **Freemium** par quotas d'IA : générations par mois, nombre de CV adaptés.
- **Abonnement court** (semaine, mois, trimestre), parce que la recherche d'emploi est temporaire.
- **Packs ponctuels**, par exemple « 1 CV + 3 adaptations ».
- **Offre B2B** pour les écoles et l'outplacement.
- **Mode « apporte ta clé »** pour les profils techniques.

Les tarifs seront fixés à partir du **coût IA réel mesuré** (`L6.5`) et du marché visé. Repère : les concurrents facturent entre environ 24 et 50 $ par mois.
