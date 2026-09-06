/**
 * Rendu HTML partagé entre le build et le navigateur.
 *
 * Les mêmes fonctions produisent la page au build (état par défaut : Sol
 * majeur et les quatre accords de la pop, pour que la page se voie avant tout
 * script) et la remettent à jour dans le navigateur à chaque changement. Une
 * seule source pour le balisage, donc aucune dérive entre les deux.
 *
 * Rien ici ne vient de l'utilisateur : ce sont nos tables, ou une adresse
 * déjà réduite à des entiers et des qualités par `lireAdresse`. Il n'y a donc
 * rien à échapper.
 */

import {
  SUFFIXE,
  chiffre,
  degreDe,
  diatoniques,
  nomAccord,
  nomFr,
  nomNote,
  nomTonalite,
  racine,
  uniques,
  type Accord,
  type Tonalite,
} from './theorie.ts';
import { meilleurCapo, svgDiagramme } from './positions.ts';
import { AMBIANCES, PROGRESSIONS, SUITES, type Ambiance } from './progressions.ts';
import { PREF } from './theorie.ts';

export type Filtre = Ambiance | 'toutes';

export interface Etat {
  tonalite: Tonalite;
  grille: Accord[];
  boucle: boolean;
  filtre: Filtre;
}

export const MAX_MESURES = 16;
export const MESURES_PAR_LIGNE = 4;

/** Sol majeur, I–V–vi–IV : ce qu'on voit en arrivant. */
export const etatInitial = (): Etat => ({
  tonalite: { tonique: 7, mode: 'maj' },
  grille: PROGRESSIONS[0]!.pas.map(([rel, q]) => ({ rel, q })),
  boucle: true,
  filtre: 'toutes',
});

const majuscule = (s: string) => s[0]!.toUpperCase() + s.slice(1);

/** Symbole d'accord : racine grande, suffixe plus petit, couleur selon la qualité. */
export const htmlAccord = (t: Tonalite, a: Accord): string =>
  `<span class="accord ${a.q}"><span class="racine">${racine(t, a)}</span><span class="suffixe">${SUFFIXE[a.q]}</span></span>`;

const htmlPuce = (t: Tonalite, a: Accord, petite = false): string =>
  `<button type="button" class="puce${petite ? ' petite' : ''}" data-rel="${a.rel}" data-q="${a.q}" aria-label="Ajouter ${nomAccord(t, a)}">${htmlAccord(t, a)}<span class="degre">${chiffre(a, t.mode)}</span></button>`;

/**
 * Les douze toniques du menu, épelées selon le mode (Réb en majeur, Do# en
 * mineur). Rendues par le gabarit Astro au build, puis par `htmlOptionsTonique`
 * dans le navigateur : le compilateur Astro ne sait pas poser `set:html` sur
 * un `<select>`.
 */
export const optionsTonique = (
  t: Tonalite,
): { valeur: number; libelle: string; choisie: boolean }[] =>
  Array.from({ length: 12 }, (_, s) => {
    const pref = PREF[t.mode][s]!;
    return {
      valeur: s,
      libelle: `${nomFr(s, pref)} (${nomNote(s, pref)})`,
      choisie: s === t.tonique,
    };
  });

export const htmlOptionsTonique = (t: Tonalite): string =>
  optionsTonique(t)
    .map((o) => `<option value="${o.valeur}"${o.choisie ? ' selected' : ''}>${o.libelle}</option>`)
    .join('');

export function htmlGrille({ tonalite: t, grille }: Etat): string {
  const cellules = grille.map(
    (a, i) =>
      `<button type="button" class="mesure" data-i="${i}" aria-label="Retirer ${nomAccord(t, a)}, mesure ${i + 1}">${htmlAccord(t, a)}<span class="degre">${chiffre(a, t.mode)}</span><span class="retirer" aria-hidden="true">×</span></button>`,
  );
  if (grille.length < MAX_MESURES) {
    const vide = grille.length === 0;
    cellules.push(
      `<button type="button" class="mesure mesure-ajout${vide ? ' vide' : ''}" id="ajout"><span class="plus">+</span><span>${
        vide
          ? 'La grille est vide. Choisissez une progression ci-dessous, ou ajoutez des accords un à un.'
          : 'accord'
      }</span></button>`,
    );
    // Mesures blanches pour finir la ligne, comme sur une grille papier.
    if (!vide) {
      for (let r = (grille.length + 1) % MESURES_PAR_LIGNE; r > 0 && r < MESURES_PAR_LIGNE; r++) {
        cellules.push('<div class="mesure blanche" aria-hidden="true"></div>');
      }
    }
  }
  return cellules.join('');
}

export const htmlTitreTonalite = (t: Tonalite): string => `Accords de ${nomTonalite(t)}`;

export const htmlDiatoniques = (t: Tonalite): string =>
  diatoniques(t.mode)
    .map((a) => htmlPuce(t, a))
    .join('');

/** « Souvent après Do : Ré, Sol, Lam ». Vide quand la grille l'est. */
export function htmlApres({ tonalite: t, grille }: Etat): string {
  const dernier = grille[grille.length - 1];
  if (!dernier) return '';
  const d = degreDe(dernier, t.mode);
  const dia = diatoniques(t.mode);
  const suivants = d >= 0 ? SUITES[t.mode][d]! : [0, 3, 4];
  return (
    `<span>Souvent après <b>${nomAccord(t, dernier)}</b> :</span>` +
    suivants.map((i) => htmlPuce(t, dia[i]!, true)).join('')
  );
}

export function htmlPositions({ tonalite: t, grille }: Etat): string {
  const accords = uniques(grille);
  if (!accords.length) {
    return '<p class="sous">Les positions des accords de la grille s’afficheront ici.</p>';
  }
  return accords
    .map(
      (a) =>
        `<figure class="diagramme">${svgDiagramme(t, a)}<figcaption class="nom ${a.q}">${nomAccord(t, a)}</figcaption></figure>`,
    )
    .join('');
}

export function htmlCapo({ tonalite: t, grille }: Etat): string {
  const capo = meilleurCapo(t, uniques(grille));
  if (!capo) return '';
  if (capo.capo === 0) {
    return capo.ouverts === capo.total
      ? '<b>Sans capo.</b> Tout se joue en position ouverte.'
      : `<b>Le capo n’y change rien.</b> Ces accords se jouent en barré, ou en position ouverte pour ${capo.ouverts} sur ${capo.total}.`;
  }
  const formes = capo.formes
    .map((f) => {
      const [, racine, suffixe] = /^(.+?)(m|°)?$/.exec(f)!;
      return `${racine}<span class="suffixe">${suffixe ?? ''}</span>`;
    })
    .join(' – ');
  return `<b>Capo ${capo.capo}</b>, et vous jouez les formes ouvertes (${capo.ouverts} accord${capo.ouverts > 1 ? 's' : ''} sur ${capo.total}) :<div class="formes">${formes}</div>`;
}

export const htmlFiltres = (filtre: Filtre): string =>
  (['toutes', ...AMBIANCES] as const)
    .map(
      (f) =>
        `<button type="button" class="filtre" data-filtre="${f}" aria-pressed="${filtre === f}">${majuscule(f)}</button>`,
    )
    .join('');

export function htmlProgressions({ tonalite: t, filtre }: Etat): string {
  const visibles = PROGRESSIONS.filter((p) => filtre === 'toutes' || p.ambiances.includes(filtre));
  if (!visibles.length) {
    return '<p class="vide-liste">Aucune progression dans cette ambiance pour l’instant.</p>';
  }
  return visibles
    .map((p) => {
      const dansSonMode: Tonalite = { tonique: t.tonique, mode: p.mode };
      const accords: Accord[] = p.pas.map(([rel, q]) => ({ rel, q }));
      const etiquettes = [p.mode === 'maj' ? 'majeur' : 'mineur', ...p.ambiances]
        .map((e) => `<span class="etiquette">${e}</span>`)
        .join('');
      return `<button type="button" class="progression" data-progression="${PROGRESSIONS.indexOf(p)}">
  <div><div class="degres">${accords.map((a) => chiffre(a, p.mode)).join(' – ')}</div>
    <div class="noms">${accords.map((a) => nomAccord(dansSonMode, a)).join(' – ')}</div></div>
  <div><div class="titre">${p.nom}</div><div class="titres">${p.titres.join(', ')}</div>
    <div class="etiquettes">${etiquettes}</div></div>
</button>`;
    })
    .join('');
}
