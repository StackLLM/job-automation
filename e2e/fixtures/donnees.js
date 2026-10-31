/** Données factices des tests de bout en bout : réponses simulées du backend et contenu du navigateur. */

export const POST_GENERE = [
  'J’ai automatisé ma veille LinkedIn avec n8n.',
  '',
  'Trois workflows, un backend Express, zéro clé dans le navigateur.',
  '',
  'Et vous, qu’avez-vous automatisé cette semaine ?',
  '#n8n #automatisation',
].join('\n')

export const RESSOURCES = {
  documents: [
    { title: 'Documentation n8n', url: 'https://docs.n8n.io', type: 'Doc' },
    { title: 'Guide Express', url: 'https://expressjs.com', type: 'Guide' },
  ],
  tips: ['Publie le mardi matin.', 'Termine par une question.'],
}

export const VISUEL = {
  visualType: 'Architecture',
  htmlCode: '<div style="width:560px;height:300px;background:#20304a;color:#fff;font:600 28px sans-serif;display:flex;align-items:center;justify-content:center">Visuel de test</div>',
}

export const PROFILS = [
  { name: 'Amina Test', title: 'Ingénieure Cloud - Exemple SA', link: 'https://www.linkedin.com/in/amina-test', snippet: 'Cloud, Kubernetes, Casablanca', image: null },
  { name: 'Youssef Essai', title: 'Architecte AWS', link: 'https://www.linkedin.com/in/youssef-essai', snippet: 'AWS, Terraform, Rabat', image: null },
]

// Réponse de POST /api/profils/rechercher : les mêmes personnes, au schéma normalisé du backend.
export const PROFILS_NORMALISES = [
  { urlNormalisee: 'https://www.linkedin.com/in/amina-test', nom: 'Amina Test', poste: 'Ingénieure Cloud', entreprise: 'Exemple SA', lieu: null, extrait: 'Cloud, Kubernetes, Casablanca', image: null, source: 'n8n' },
  { urlNormalisee: 'https://www.linkedin.com/in/youssef-essai', nom: 'Youssef Essai', poste: 'Architecte AWS', entreprise: null, lieu: null, extrait: 'AWS, Terraform, Rabat', image: null, source: 'n8n' },
]

// Posts tels que le serveur les renvoie (GET /api/posts), du plus récent au plus ancien.
export const postsDuCompte = ({ maintenant = new Date() } = {}) => [
  { id: 'p-1', type: 'Projet technique', model: 'deepseek', content: 'Mon pipeline Terraform en production\nDétails…', createdAt: maintenant.toISOString() },
  { id: 'p-2', type: 'Storytelling', model: 'deepseek', content: 'Ma première mission cloud\nRécit…', createdAt: new Date(maintenant.getTime() - 86_400_000).toISOString() },
]

// Contenu de « linkedai-storage » (zustand persist, version 1) : depuis le lot L0.7, le navigateur ne garde
// plus que les profils, les lettres et les offres.
export const etatNavigateur = () => ({
  state: { letters: [], savedJobs: [], scrapedProfiles: PROFILS },
  version: 1,
})

// Navigateur utilisé avant les comptes (version 0) : posts et paramètres y sont encore, à importer.
export const etatAncienNavigateur = ({ maintenant = new Date() } = {}) => ({
  state: {
    posts: postsDuCompte({ maintenant }).map((p, i) => ({ ...p, id: maintenant.getTime() - i })),
    letters: [],
    savedJobs: [],
    settings: { defaultTone: 'Startup', scraperWebhook: '' },
    scrapedProfiles: PROFILS,
  },
  version: 0,
})
