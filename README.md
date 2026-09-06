# Grille

Progressions d'accords pour guitare, en une page : une tonalité, ses sept
accords, une grille qu'on remplit en cliquant, l'écoute, les positions sur le
manche et le capo qui va bien. Gratuit, sans compte, sans publicité.

Site : <https://grille-accords.pages.dev>

## Ce que fait le site

- **La grille.** Quatre mesures par ligne, comme sur une grille papier, avec
  barres de reprise quand la boucle est active. Un clic sur un accord de la
  tonalité l'ajoute, un clic sur une mesure la retire. Seize mesures au plus.
- **La tonalité.** Douze toniques, majeur ou mineur. Changer de tonique
  transpose la grille ; passer de majeur à mineur garde les degrés et change
  les qualités (I–V–vi–IV devient i–v–VI–iv).
- **L'écoute.** Web Audio, son synthétisé, huit rythmiques (folk, rock,
  country, reggae, arpège, shuffle swingué…), tempo réglable. Le séquenceur
  ne programme que 120 ms d'avance : tempo, rythmique et grille changent en
  cours de lecture, et « Arrêter » coupe net. Aucun échantillon à télécharger.
- **Les positions.** Un diagramme SVG par accord de la grille, la fondamentale
  en laiton, et la suggestion de capo qui rend le plus d'accords jouables en
  forme ouverte.
- **Les progressions à essayer.** Quinze classiques, dont trois blues en douze
  mesures, filtrables par ambiance, transposées dans la tonalité choisie, avec
  deux ou trois titres connus pour situer le son. Un blues charge le shuffle.
- **Le manche.** Pour un accord de la grille, toutes ses racines sur quinze
  cases, et les cinq formes du CAGED (Do, La, Sol, Mi, Ré) avec, pour chacune,
  la corde et la case où poser la première racine. Cliquer une forme la dessine
  sur le manche, cercle cette première racine et la fait sonner. En mineur,
  trois formes ; pour un diminué, les racines seulement.
- **Les septièmes.** Sous les accords de la tonalité, les trois septièmes de
  dominante du blues (I7, IV7, V7), avec leurs doigtés ouverts.
- **Le lien.** L'adresse décrit la grille en clair, `#sol-majeur/I-V-vi-IV` :
  la copier, c'est copier la grille.

## Commandes

```sh
npm run dev        # serveur de développement
npm run build      # site statique dans dist/
npm run lint       # prettier --check .
npm run typecheck  # astro check, doit rester à zéro erreur
npm test           # node --test, la théorie et les positions
npm run format     # prettier --write .
npm run deploy     # wrangler pages deploy dist (à la main, hors CI)
```

`lint`, `typecheck`, `test` et `build` sont exactement ce que fait la CI, dans
cet ordre.

`astro dev` ne lit pas `public/_headers` : pour vérifier la politique de
sécurité, passer par `npm run build && npx wrangler pages dev dist`.

## Structure

```
src/data/theorie.ts       notes, gammes, chiffrage, adresse (pur, testé)
src/data/positions.ts     doigtés, diagrammes SVG, capo (pur, testé)
src/data/progressions.ts  les progressions et les enchaînements fréquents
src/data/rythmiques.ts    les motifs de battement, huit croches par mesure
src/data/caged.ts         les cinq formes, leur placement, le dessin du manche (pur, testé)
src/data/rendu.ts         le HTML, partagé entre le build et le navigateur
src/scripts/site.ts       l'état, les clics, le son, l'adresse
src/pages/index.astro     la page, rendue au build dans l'état par défaut
src/styles/global.css     le thème « palissandre »
src/styles/polices.css    @font-face vers public/polices/
public/_headers           CSP et cache, servis par Cloudflare Pages
tests/                    node --test, sans compilation
```

Il n'y a pas de CMS et il n'y en aura pas : les progressions et les doigtés
sont des fichiers TypeScript, relus par `typecheck` et `test`.

### Ajouter une progression

Un objet de plus dans `src/data/progressions.ts`. Chaque pas est
`[demi-tons depuis la tonique, qualité]`, jamais un nom d'accord : la même
progression se lit dans les douze tonalités. Le test vérifie les intervalles,
les ambiances et l'absence de doublon.

### Ajouter une rythmique

Un objet de plus dans `src/data/rythmiques.ts` : huit jetons, un par croche
(`B` bas appuyé, `b` bas léger, `H` haut, `.` rien, `p` la basse, `i m a` les
trois cordes aiguës), et `swing: true` pour des croches inégales. Le test
vérifie la longueur, les jetons et qu'une mesure dure bien quatre temps.

### Changer un doigté

`src/data/positions.ts`, tableau `POSITIONS` : six caractères, cordes de Mi
grave à Mi aigu, `x` étouffée, chiffre = case. Le test vérifie que chaque
doigté joue bien les notes de son accord.

## Mise en service

Deux choses à poser une fois.

### 1. Le projet Cloudflare Pages

Le projet n'est **pas** relié au dépôt (`Git Provider: No`) : c'est GitHub
Actions qui construit et téléverse. Il a été créé ainsi :

```sh
npx wrangler pages project create grille-accords --production-branch=main
npm run build
npx wrangler pages deploy dist --project-name=grille-accords --branch=main
```

### 2. Le secret de déploiement

`.github/workflows/publication.yml` a besoin d'un jeton d'API Cloudflare avec
la permission **Cloudflare Pages: Edit** sur le compte. À créer sur
<https://dash.cloudflare.com/profile/api-tokens>, puis :

```sh
gh secret set CLOUDFLARE_API_TOKEN --repo bhubert/chord-progression
```

Sans ce secret, le workflow ne casse pas : il pose un avertissement et
s'arrête avant de déployer. L'identifiant de compte, lui, est en clair dans le
workflow : il ne donne accès à rien seul.

## Publier

Tout ce qui est poussé sur `main` passe les contrôles puis se déploie. Pour
travailler sans publier : une branche (rien ne tourne dessus), ou une pull
request vers `main` (contrôles sans déploiement).

## Choix de conception

- **Un seul thème, sombre, forcé.** Palissandre, ivoire, laiton. Les accords
  mineurs sont bleutés, les diminués mauves : la couleur dit la qualité. Un
  thème clair « érable » reste possible en redéfinissant les variables de
  `global.css`.
- **Polices auto-hébergées.** Gloock pour les titres, Barlow pour l'interface,
  Barlow Semi Condensed pour les symboles d'accords. Sous-ensemble latin,
  112 ko en tout, licence OFL. Rien ne vient d'un CDN : la CSP l'interdit.
- **Tout est relatif à la tonique.** Un accord est un intervalle et une
  qualité. C'est ce qui rend la transposition gratuite et l'adresse lisible.
- **Le HTML est rendu au build** avec les mêmes fonctions que le navigateur :
  la page se voit avant tout script, et le script ne reconstruit que ce que
  l'adresse lui demande.
- **Aucune dépendance côté navigateur.** Web Audio et SVG maison ; le script
  pèse 16 ko avant compression.
