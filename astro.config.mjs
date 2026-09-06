// @ts-check
import { defineConfig } from 'astro/config';

/**
 * Site statique, sans intégration ni adaptateur : une page calculée au build
 * et déposée sur Cloudflare Pages. Tout le reste (grille, écoute, adresse) se
 * passe dans le navigateur, sur des données déjà présentes dans le bundle.
 */
export default defineConfig({
  site: 'https://grille-accords.pages.dev',
  trailingSlash: 'always',

  build: {
    format: 'directory',
    // La politique de sécurité du site est `style-src 'self'` (voir
    // `public/_headers`). Le réglage par défaut, `'auto'`, glisse les petites
    // feuilles de style directement dans le HTML, où la CSP les refuserait en
    // silence : le site s'afficherait sans aucune mise en forme.
    inlineStylesheets: 'never',
  },
  devToolbar: {
    enabled: false,
  },

  vite: {
    build: {
      // Même raison que `inlineStylesheets`, pour le script cette fois : en
      // deçà de cette limite (4 ko par défaut), Astro glisse le module dans le
      // HTML, où `script-src 'self'` le refuse en silence. À zéro, tout reste
      // en fichier servi.
      assetsInlineLimit: 0,
    },
  },
});
