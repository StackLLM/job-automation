/** @type {import('tailwindcss').Config} */
// Les valeurs vivent dans src/styles/tokens.css (miroir de palette.md) : ici on ne fait que les exposer.
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        app:              'var(--couleur-app)',
        surface:          'var(--couleur-surface)',
        'surface-douce':  'var(--couleur-surface-douce)',
        'surface-creuse': 'var(--couleur-surface-creuse)',
        ligne:            'var(--couleur-ligne)',
        texte:            'var(--couleur-texte)',
        'texte-doux':     'var(--couleur-texte-doux)',
        'texte-pale':     'var(--couleur-texte-pale)',
        primaire:         'var(--couleur-primaire)',
        'primaire-survol':'var(--couleur-primaire-survol)',
        'sur-primaire':   'var(--couleur-sur-primaire)',
        accent:           'var(--couleur-accent)',
        'accent-pale':    'var(--couleur-accent-pale)',
        succes:           'var(--couleur-succes)',
        olive:            'var(--couleur-olive)',
        peche:            'var(--couleur-peche)',
        sable:            'var(--couleur-sable)',
        brume:            'var(--couleur-brume)',
        lavande:          'var(--couleur-lavande)',
        alerte:           'var(--couleur-alerte)',
        danger:           'var(--couleur-danger)',
        'danger-pale':    'var(--couleur-danger-pale)',
        attention:        'var(--couleur-attention)',
        'attention-pale': 'var(--couleur-attention-pale)',
        voile:            'var(--voile-sombre)',
      },
      fontFamily: {
        sans: 'var(--police-texte)',
        mono: 'var(--police-mono)',
      },
      borderRadius: {
        carte:    'var(--rayon-carte)',
        controle: 'var(--rayon-controle)',
        pilule:   'var(--rayon-pilule)',
      },
      boxShadow: {
        carte:     'var(--ombre-carte)',
        survol:    'var(--ombre-survol)',
        flottante: 'var(--ombre-flottante)',
        menu:      'var(--ombre-menu)',
        focus:     'var(--anneau-focus)',
      },
      fontSize: {
        hero: 'var(--taille-hero)',
        kpi:  'var(--taille-kpi)',
      },
      letterSpacing: {
        surtitre: 'var(--lettres-surtitre)',
      },
      spacing: {
        sidebar:      'var(--largeur-sidebar)',
        topbar:       'var(--hauteur-topbar)',
        'nav-mobile': 'var(--hauteur-nav-mobile)',
      },
      transitionDuration: {
        rapide:   'var(--duree-rapide)',
        standard: 'var(--duree-standard)',
        lente:    'var(--duree-lente)',
      },
      transitionTimingFunction: {
        standard: 'var(--courbe-standard)',
      },
      backgroundImage: {
        hero:  'var(--degrade-hero)',
        carte: 'var(--degrade-carte)',
        puce:  'var(--degrade-puce)',
      },
    },
  },
  plugins: [],
}
