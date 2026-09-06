# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Le projet en deux phrases

Site d'une seule page pour trouver des progressions d'accords à la guitare :
tonalité, grille cliquable, écoute Web Audio avec rythmiques, diagrammes de
positions, capo, formes CAGED sur le manche, progressions classiques, lien qui
décrit la grille. Astro statique, hébergé
sur Cloudflare Pages (`grille-accords`), déployé par GitHub Actions depuis
`bhubert/chord-progression`, site <https://grille-accords.pages.dev>.

**Le projet est écrit en français** : identifiants, commentaires, messages de
commit, libellés. Suivre cette convention sans exception. Les noms d'accords
restent en notation internationale (C, Am, F#°), les tonalités en français
(« Sol majeur »).

**Pas de CMS, jamais.** Les progressions et les doigtés sont des fichiers
TypeScript dans `src/data/`, relus par `typecheck` et `test`.

## Commandes

```sh
npm run dev        # serveur de développement
npm run build      # site statique dans dist/
npm run lint       # prettier --check .
npm run typecheck  # astro check, doit rester à zéro erreur
npm test           # node --test tests/*.test.ts
npm run format     # prettier --write .
```

Les quatre du milieu sont exactement ce que fait la CI, dans cet ordre.

`astro dev` ne lit pas `public/_headers` : pour vérifier la CSP, passer par
`npm run build && npx wrangler pages dev dist`. Penser à arrêter le serveur
ensuite.

## Ce qu'il faut comprendre avant de toucher au code

### Tout est relatif à la tonique

Un accord est `{ rel, q }` : demi-tons depuis la tonique et qualité. Jamais une
note absolue. C'est ce qui rend la transposition gratuite (`theorie.ts`), le
passage majeur ↔ mineur par degré (`transposerMode`) et l'adresse lisible
(`#sol-majeur/I-V-vi-IV`, `adresse` / `lireAdresse`). Les tests de
`tests/theorie.test.ts` fixent ces comportements.

### Le HTML a une seule source

`src/data/rendu.ts` produit le balisage, au build (`index.astro`, état par
défaut) comme dans le navigateur (`site.ts`, à chaque changement). Ne pas
fabriquer de HTML ailleurs. Les contenus sont nos tables ou une adresse déjà
réduite à des entiers : rien à échapper.

### Le séquenceur ne programme que 120 ms d'avance

`Lecteur` dans `site.ts` : un `setTimeout` toutes les 40 ms pose les croches
qui tombent dans la fenêtre, jamais plus. Le tempo, la rythmique, la tonalité
et la grille sont relus à chaque croche ; « Arrêter » ferme le nœud `voix` en
30 ms. Ne pas revenir à un tour programmé d'un coup : c'est ce qui faisait
que le bouton d'arrêt n'arrêtait rien et que les tempos se superposaient.

### Une forme CAGED se pose par sa première racine

`caged.ts` décrit chaque forme par sa corde d'ancrage et des décalages depuis
la case de cette racine (négatifs pour les formes de Do et de Sol). `placer`
trouve la case, une octave plus haut si la forme passerait sous le sillet.
Rien de tout ça ne dépend de la tonalité autrement que par la racine.

### Les modules de `src/data/` tournent sous Node sans compilation

`node --test` exécute les `.ts` directement (Node 24 retire les types). D'où
deux contraintes : imports avec extension `.ts` (`allowImportingTsExtensions`
dans `tsconfig.json`), et aucun accès au DOM dans `theorie.ts`, `positions.ts`,
`progressions.ts`, `rythmiques.ts`, `caged.ts`, `rendu.ts`.

## Pièges qui échouent en silence

1. **`set:html` sur un `<select>` ne fonctionne pas** : le compilateur Astro
   jette le contenu et le `</select>`, et tout le reste de la page se retrouve
   avalé dans le menu. Les options sont rendues par une boucle dans le gabarit
   (`optionsTonique`). Ne pas revenir en arrière.

2. **`prettier-plugin-astro` referme en `/>` toute balise vide.** Un
   `<div set:html={…}></div>` redevient `<div set:html={…} />` au prochain
   `npm run format`. C'est accepté pour les `div` ; c'est précisément ce qui
   casse le `select` du point précédent.

3. **Astro glisse les petits fichiers CSS et JS dans le HTML par défaut**, où
   la CSP `style-src 'self'` / `script-src 'self'` les refuse sans erreur
   visible. D'où `build.inlineStylesheets: 'never'` et
   `vite.build.assetsInlineLimit: 0` dans `astro.config.mjs`. Ne pas les
   retirer.

4. **Aucune ressource depuis un CDN.** Les polices sont dans `public/polices/`
   (sous-ensemble latin, téléchargées une fois depuis Google Fonts). Une police
   bloquée par la CSP retombe sur Georgia ou Arial sans message.

5. **`npm install` n'exécute plus les scripts postinstall** (`allow-scripts`
   de npm 11) : esbuild, workerd et wrangler s'en passent grâce à leurs
   binaires optionnels. Ne pas chercher à « réparer » ces avertissements.

## Décisions à ne pas défaire sans raison

- **Deux thèmes, le clair par défaut.** « Érable » (papier, encre brune) en
  arrivant, quel que soit le système ; « palissandre » (bois sombre, ivoire)
  par le bouton de l'en-tête, mémorisé en `localStorage`. L'utilisateur
  trouvait le sombre triste et voulait du blanc pour que les couleurs
  ressortent. Chaque thème est un bloc de variables dans `global.css`, `:root`
  puis `:root[data-theme='dark']` ; aucune règle ne porte de couleur en dur.
  La teinte locale passe par `--teinte` (qualité, ambiance) et `--caged`
  (forme) : une règle `color-mix` par usage, jamais une couleur par élément.
  L'encre sur fond coloré est `--sur-couleur`, sombre dans les deux thèmes.
  Le script pose `sans-transition` sur `<html>` le temps du changement, sinon
  les fonds `color-mix` glissent visiblement d'un thème à l'autre.
- **Une couleur par forme CAGED**, cinq variables `--caged-*`. C rouge, A
  jaune, G vert, E bleu, D violet : un choix, pas une norme (FaChords alterne
  rouge et bleu, Triads & CAGED met C en bleu). Tout passe par ces variables,
  y compris le SVG du manche.
- **Aucune dépendance côté navigateur.** Web Audio et SVG maison. Le script
  pèse 16 ko avant compression ; une bibliothèque de son ou de diagrammes
  coûterait plus qu'elle n'apporte.
- **Un seul workflow, un seul job, en séquence.** Contrôles puis déploiement,
  `wrangler` n'est atteint que si tout passe. Le secret `CLOUDFLARE_API_TOKEN`
  est optionnel : absent, le job avertit et s'arrête proprement.
- **Le projet Pages n'est pas relié à Git.** C'est GitHub Actions qui
  téléverse. Voir le README, « Mise en service ».

## Travailler sur ce dépôt

Tout poussé sur `main` déploie. Pour travailler sans publier : une branche, ou
une pull request vers `main` (contrôles sans déploiement).

Le `README.md` est la documentation de référence. Le tenir à jour quand le
comportement change.
