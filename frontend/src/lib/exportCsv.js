// Export CSV des profils scrapés (page Scraper et dashboard).
// Lot L1.5 : note et étiquettes ajoutées à la fin ; les colonnes d'avant ne bougent pas.
const champ = (texte) => `"${String(texte ?? '').replace(/"/g, '""')}"`

export function lignesProfilsCsv(profiles) {
  const header = 'Nom,Titre,Lien,Snippet,Note,Etiquettes\n'
  const rows = profiles
    .map(
      (p) =>
        `"${p.name || ''}","${p.title || ''}","${p.link || ''}","${(p.snippet || '').replace(/"/g, "'")}",${champ(p.note)},${champ((p.etiquettes || []).join(' ; '))}`
    )
    .join('\n')
  return header + rows
}

export function exporterProfilsCsv(profiles) {
  const blob = new Blob([lignesProfilsCsv(profiles)], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'profils-linkedin.csv'
  a.click()
  URL.revokeObjectURL(url)
}
