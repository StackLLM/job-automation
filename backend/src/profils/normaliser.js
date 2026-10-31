/**
 * Normalisation des profils trouvés par un fournisseur de recherche (lot L1.2).
 * Entrée : un « profil brut » { titre, lien, extrait, image } tel que le donne un résultat de recherche
 * (titre Google du type « Nom - Poste at Entreprise | LinkedIn »).
 * Sortie : un profil au schéma unique, ou un rejet compté (pas d'URL de profil LinkedIn valide).
 * Règles relevées sur un échantillon réel de résultats (octobre 2026) : voir backend/test/normaliser.test.js.
 */
import { z } from 'zod'

// Schéma unique d'un profil, quel que soit le fournisseur.
export const SchemaProfil = z.object({
  urlNormalisee: z.string().url(),
  nom:           z.string().min(1).nullable(),
  poste:         z.string().min(1).nullable(),
  entreprise:    z.string().min(1).nullable(),
  lieu:          z.string().min(1).nullable(),
  extrait:       z.string().min(1).nullable(),
  image:         z.string().url().nullable(),
  source:        z.string().min(1),
})

// Marques de sens d'écriture (pages en arabe) et autres caractères invisibles.
const INVISIBLES = /[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g
const ENTITES = { '&amp;': '&', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&lt;': '<', '&gt;': '>', '&nbsp;': ' ' }

// Texte propre : sans caractères invisibles ni entités HTML, espaces réduits. Vide → null.
export function nettoyer(texte) {
  if (texte == null) return null
  const propre = String(texte)
    .replace(INVISIBLES, '')
    .replace(/&(amp|quot|#39|apos|lt|gt|nbsp);/g, (e) => ENTITES[e])
    .replace(/\s+/g, ' ')
    .trim()
  return propre || null
}

// https://ma.linkedin.com/in/Jean-Dupont/fr?trk=x → https://www.linkedin.com/in/jean-dupont
// Seules les pages de profil (/in/<identifiant>) sont acceptées. Sinon : null.
export function normaliserUrl(lien) {
  let url
  try { url = new URL(String(lien ?? '').trim()) } catch { return null }
  if (!/^https?:$/.test(url.protocol)) return null
  if (!/(^|\.)linkedin\.com$/i.test(url.hostname)) return null

  const [, segment, identifiant] = url.pathname.split('/')
  if (segment?.toLowerCase() !== 'in' || !identifiant) return null

  let id
  try { id = decodeURIComponent(identifiant) } catch { return null }
  id = id.trim().toLowerCase()
  if (!id || /[\s/]/.test(id)) return null
  return `https://www.linkedin.com/in/${encodeURIComponent(id)}`
}

// Retire « - LinkedIn », « | LinkedIn », la troncature « ... » et ce qu'elle laisse pendre
// (« Poste at ... » → « Poste »).
const sansSuffixe = (texte) => texte
  .replace(/\s*[|\-–—]\s*LinkedIn\s*$/i, '')
  .replace(/\s*(\.\.\.|…)\s*$/, '')
  .replace(/\s+(?:at|chez)$/i, '')
  .replace(/\s*[|\-–—@·,]\s*$/, '')
  .trim()

const SEPARATEUR = /\s+[-–—]\s+/

// « Nom - Poste at Entreprise | LinkedIn » → { nom, poste, entreprise }.
// L'entreprise n'est retenue que si elle est annoncée sans ambiguïté :
// « at », « chez » ou « @ » ; ou le format classique « Nom - Poste - Entreprise ».
export function analyserTitre(titre) {
  const propre = nettoyer(titre)
  if (!propre) return { nom: null, poste: null, entreprise: null }

  const [nomBrut, ...reste] = sansSuffixe(propre).split(SEPARATEUR)
  const nom = nettoyer(sansSuffixe(nomBrut))
  let titreSeul = sansSuffixe(reste.join(' - '))
  if (!titreSeul) return { nom, poste: null, entreprise: null }

  const annonce = titreSeul.match(/^(.*\S)\s+(?:(?:at|chez)\s+|@\s*)([^|•@]+)$/i)
  if (annonce) {
    return { nom, poste: nettoyer(sansSuffixe(annonce[1])), entreprise: nettoyer(sansSuffixe(annonce[2])) }
  }

  const morceaux = titreSeul.split(SEPARATEUR)
  if (morceaux.length === 2 && !morceaux.some((m) => m.includes('|'))) {
    return { nom, poste: nettoyer(morceaux[0]), entreprise: nettoyer(morceaux[1]) }
  }
  titreSeul = nettoyer(titreSeul)
  return { nom, poste: titreSeul, entreprise: null }
}

// Lieu seulement s'il est écrit explicitement dans l'extrait (« Lieu : … », « Location: … »).
export function extraireLieu(extrait) {
  const m = nettoyer(extrait)?.match(/(?:Lieu|Localisation|Location)\s*:\s*([^·|]+?)(?:\s*[·|]|\s+\d+\s*(?:\+\s*)?(?:relations|connections)|$)/i)
  return m ? nettoyer(m[1]) : null
}

const urlImage = (image) => {
  try {
    const url = new URL(String(image))
    return /^https?:$/.test(url.protocol) ? url.href : null
  } catch { return null }
}

// Un profil brut → { ok: true, profil } ou { ok: false, raison }.
export function normaliserProfil(brut, source) {
  const urlNormalisee = normaliserUrl(brut?.lien)
  if (!urlNormalisee) return { ok: false, raison: 'url-invalide' }

  const { nom, poste, entreprise } = analyserTitre(brut.titre)
  const extrait = nettoyer(brut.extrait)
  const resultat = SchemaProfil.safeParse({
    urlNormalisee, nom, poste, entreprise,
    lieu: extraireLieu(extrait),
    extrait,
    image: brut.image ? urlImage(brut.image) : null,
    source,
  })
  return resultat.success ? { ok: true, profil: resultat.data } : { ok: false, raison: 'schema' }
}

// Un lot de profils bruts → { profils, rejetes }. L'ordre du fournisseur est gardé.
export function normaliserLot(bruts, source) {
  const profils = []
  let rejetes = 0
  for (const brut of bruts) {
    const r = normaliserProfil(brut, source)
    if (r.ok) profils.push(r.profil)
    else rejetes += 1
  }
  return { profils, rejetes }
}

// Profil déjà découpé, tel que le gardait le navigateur ou que le renvoie un webhook n8n réglé à la main
// ({ name, title, link, snippet, image } ; plus poste, entreprise, lieu, source s'il venait du backend).
// Lot L1.1 : sert à l'import du navigateur et à l'enregistrement d'un lot. Rien n'est déduit du titre :
// sans poste séparé, le titre entier devient le poste, comme il s'affichait.
export function depuisFormeLocale(p, sourceParDefaut) {
  const urlNormalisee = normaliserUrl(p?.link ?? p?.url ?? p?.urlNormalisee)
  if (!urlNormalisee) return { ok: false, raison: 'url-invalide' }
  const extrait = nettoyer(p.snippet ?? p.extrait)
  const resultat = SchemaProfil.safeParse({
    urlNormalisee,
    nom: nettoyer(p.name ?? p.nom),
    poste: nettoyer(p.poste !== undefined ? p.poste : p.title),
    entreprise: nettoyer(p.entreprise),
    lieu: nettoyer(p.lieu) ?? extraireLieu(extrait),
    extrait,
    image: p.image ? urlImage(p.image) : null,
    source: nettoyer(p.source) ?? sourceParDefaut,
  })
  return resultat.success ? { ok: true, profil: resultat.data } : { ok: false, raison: 'schema' }
}
