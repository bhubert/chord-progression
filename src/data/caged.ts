/**
 * CAGED : les cinq formes qui couvrent le manche.
 *
 * Chaque forme est un accord ouvert (Do, La, Sol, Mi, Ré) qu'on déplace le
 * long du manche. Pour la poser, on cherche une seule chose : la case de sa
 * **première racine**, sur sa corde d'ancrage. Le reste de la forme suit,
 * toujours aux mêmes écarts.
 *
 * Les décalages sont exprimés depuis cette case d'ancrage : la forme de Do a
 * sa racine sur la corde de La et des cordes à vide trois cases plus bas,
 * d'où des décalages négatifs. Poser la forme de Do pour Sib obligerait à
 * descendre sous le sillet ; on la pose alors une octave plus haut.
 *
 * En mineur, seules les formes de Mi, La et Ré sont d'usage ; celles de Do et
 * de Sol existent mais personne ne les joue. Pas de forme pour un accord
 * diminué : on montre ses racines, c'est déjà ce qu'il faut pour le trouver.
 */

import { MIDI_CORDES, PC_CORDES, doigte } from './positions.ts';
import {
  PREF,
  mod12,
  nomNote,
  prefPour,
  semiAbsolu,
  type Accord,
  type Qualite,
  type Tonalite,
} from './theorie.ts';

export type Lettre = 'C' | 'A' | 'G' | 'E' | 'D';

/** Dernière case dessinée. Assez pour poser toute forme une octave plus haut. */
export const FRETTES_MANCHE = 15;

export interface Forme {
  lettre: Lettre;
  /** Corde de la première racine, 0 = Mi grave. */
  ancre: number;
  /** Case de chaque corde, relative à celle de l'ancre. `null` : corde étouffée. */
  decalages: readonly (number | null)[];
}

export const NOMS_FORMES: Record<Lettre, string> = {
  C: 'forme de Do',
  A: 'forme de La',
  G: 'forme de Sol',
  E: 'forme de Mi',
  D: 'forme de Ré',
};

export const NOMS_CORDES = ['Mi grave', 'La', 'Ré', 'Sol', 'Si', 'Mi aigu'] as const;
export const LETTRES_CORDES = ['E', 'A', 'D', 'G', 'B', 'e'] as const;

export const FORMES: Record<Qualite, readonly Forme[]> = {
  maj: [
    { lettre: 'C', ancre: 1, decalages: [null, 0, -1, -3, -2, -3] },
    { lettre: 'A', ancre: 1, decalages: [null, 0, 2, 2, 2, 0] },
    { lettre: 'G', ancre: 0, decalages: [0, -1, -3, -3, -3, 0] },
    { lettre: 'E', ancre: 0, decalages: [0, 2, 2, 1, 0, 0] },
    { lettre: 'D', ancre: 2, decalages: [null, null, 0, 2, 3, 2] },
  ],
  min: [
    { lettre: 'A', ancre: 1, decalages: [null, 0, 2, 2, 1, 0] },
    { lettre: 'E', ancre: 0, decalages: [0, 2, 2, 0, 0, 0] },
    { lettre: 'D', ancre: 2, decalages: [null, null, 0, 2, 3, 1] },
  ],
  dom7: [
    { lettre: 'C', ancre: 1, decalages: [null, 0, -1, 0, -2, -3] },
    { lettre: 'A', ancre: 1, decalages: [null, 0, 2, 0, 2, 0] },
    { lettre: 'G', ancre: 0, decalages: [0, -1, -3, -3, -3, -2] },
    { lettre: 'E', ancre: 0, decalages: [0, 2, 0, 1, 0, 0] },
    { lettre: 'D', ancre: 2, decalages: [null, null, 0, 2, 1, 2] },
  ],
  dim: [],
};

export const forme = (q: Qualite, lettre: Lettre): Forme | null =>
  FORMES[q].find((f) => f.lettre === lettre) ?? null;

export interface Placement {
  forme: Forme;
  /** Case de la première racine. 0 : la corde à vide. */
  ancreFrette: number;
  /** Case de chaque corde, `null` pour une corde étouffée. */
  frettes: (number | null)[];
}

/** Où poser la forme pour cet accord. */
export function placer(t: Tonalite, a: Accord, f: Forme): Placement {
  const racine = semiAbsolu(t, a);
  let ancre = mod12(racine - PC_CORDES[f.ancre]!);
  const plusBas = Math.min(...f.decalages.filter((d): d is number => d !== null));
  if (ancre + plusBas < 0) ancre += 12;
  return {
    forme: f,
    ancreFrette: ancre,
    frettes: f.decalages.map((d) => (d === null ? null : ancre + d)),
  };
}

/**
 * La forme CAGED d'un doigté de référence, s'il en est une telle quelle : Do
 * ouvert est la forme de Do, le barré de Fa la forme de Mi, Sib la forme de
 * La. `null` quand le doigté n'est aucune des formes (Si7 ouvert, par exemple).
 */
export function lettreCaged(t: Tonalite, a: Accord): Lettre | null {
  const d = doigte(t, a);
  for (const f of FORMES[a.q]) {
    const p = placer(t, a, f);
    if (p.frettes.every((frette, i) => (frette === null ? d[i] === -1 : frette === d[i]))) {
      return f.lettre;
    }
  }
  return null;
}

/** La variable CSS de la couleur d'une forme : `var(--caged-e)`. */
export const couleurForme = (lettre: Lettre): string => `var(--caged-${lettre.toLowerCase()})`;

/** Toutes les racines de l'accord sur le manche : `[corde, case]`, cordes graves d'abord. */
export function racines(t: Tonalite, a: Accord): [number, number][] {
  const racine = semiAbsolu(t, a);
  const resultat: [number, number][] = [];
  for (let corde = 0; corde < 6; corde++) {
    for (let f = 0; f <= FRETTES_MANCHE; f++) {
      if (mod12(PC_CORDES[corde]! + f) === racine) resultat.push([corde, f]);
    }
  }
  return resultat;
}

/** « corde de Mi grave, case 3 » ou « corde de La, à vide ». */
export const descriptionAncre = (p: Placement): string =>
  `corde de ${NOMS_CORDES[p.forme.ancre]}, ${p.ancreFrette === 0 ? 'à vide' : `case ${p.ancreFrette}`}`;

/** Notes MIDI de la forme posée, pour l'entendre. */
export const notesPlacement = (p: Placement): number[] =>
  p.frettes.flatMap((f, i) => (f === null ? [] : [MIDI_CORDES[i]! + f]));

// ── Pentatoniques ──────────────────────────────────────────────────────────
//
// Cinq notes, et chaque forme du CAGED en est une « boîte ». La majeure et la
// mineure relative ont les mêmes notes : Sol majeur et Mi mineur, c'est le
// même dessin sur le manche, seule la racine change de place.

export type Penta = 'maj' | 'min';

export const PENTATONIQUES: Record<Penta, readonly number[]> = {
  maj: [0, 2, 4, 7, 9],
  min: [0, 3, 5, 7, 10],
};

export const NOMS_PENTA: Record<Penta, string> = { maj: 'majeure', min: 'mineure' };

/**
 * L'orthographe d'une gamme suit sa tonalité majeure, relative pour la
 * mineure : Sol mineur s'écrit avec les bémols de Sib majeur (G, Bb, C, D, F),
 * pas avec les dièses de l'accord de Sol.
 */
const prefPenta = (t: Tonalite, a: Accord, penta: Penta) =>
  PREF.maj[mod12(semiAbsolu(t, a) + (penta === 'min' ? 3 : 0))]!;

/** Les cinq notes, nommées : « G, A, B, D, E ». */
export const nomsPenta = (t: Tonalite, a: Accord, penta: Penta): string[] =>
  PENTATONIQUES[penta].map((i) => nomNote(semiAbsolu(t, a) + i, prefPenta(t, a, penta)));

/** La relative : Sol majeur et Mi mineur partagent leurs cinq notes. */
export const relativePenta = (
  t: Tonalite,
  a: Accord,
  penta: Penta,
): { nom: string; penta: Penta } => ({
  nom: nomNote(semiAbsolu(t, a) + (penta === 'maj' ? 9 : 3), prefPenta(t, a, penta)),
  penta: penta === 'maj' ? 'min' : 'maj',
});

/** Toutes les notes de la gamme sur le manche : `[corde, case, classe de hauteur]`. */
export function notesPenta(t: Tonalite, a: Accord, penta: Penta): [number, number, number][] {
  const racine = semiAbsolu(t, a);
  const classes = new Set(PENTATONIQUES[penta].map((i) => mod12(racine + i)));
  const resultat: [number, number, number][] = [];
  for (let corde = 0; corde < 6; corde++) {
    for (let f = 0; f <= FRETTES_MANCHE; f++) {
      const classe = mod12(PC_CORDES[corde]! + f);
      if (classes.has(classe)) resultat.push([corde, f, classe]);
    }
  }
  return resultat;
}

/**
 * La boîte de pentatonique que découpe une forme : sur chaque corde, les deux
 * notes de la gamme les plus proches des cases de la forme, cordes étouffées
 * comprises. C'est ce que tout guitariste appelle « la position » : cinq
 * formes, cinq boîtes, et la gamme entière quand on les met bout à bout.
 */
export function boitePenta(
  t: Tonalite,
  a: Accord,
  penta: Penta,
  p: Placement,
): [number, number, number][] {
  const posees = p.frettes.filter((f): f is number => f !== null);
  const bas = Math.min(...posees);
  const haut = Math.max(...posees);
  const centre = (bas + haut) / 2;
  const distance = (f: number) => (f < bas ? bas - f : f > haut ? f - haut : 0);
  const toutes = notesPenta(t, a, penta);
  const resultat: [number, number, number][] = [];
  for (let corde = 0; corde < 6; corde++) {
    const surCorde = toutes
      .filter(([c]) => c === corde)
      .sort(
        (x, y) =>
          distance(x[1]) - distance(y[1]) ||
          Math.abs(x[1] - centre) - Math.abs(y[1] - centre) ||
          x[1] - y[1],
      )
      .slice(0, 2)
      .sort((x, y) => x[1] - y[1]);
    resultat.push(...surCorde);
  }
  return resultat;
}

// ── Le dessin ──────────────────────────────────────────────────────────────

const X0 = 46; // le sillet
const PAS = 52; // une case
const Y0 = 22; // la chanterelle
const ECART = 22; // entre deux cordes
const xCase = (f: number): number => (f === 0 ? X0 - 16 : X0 + (f - 0.5) * PAS);
const y = (corde: number): number => Y0 + (5 - corde) * ECART;
const REPERES = [3, 5, 7, 9, 12, 15];

/**
 * Le manche, à plat, chanterelle en haut et Mi grave en bas, comme quand on
 * regarde sa propre guitare. Sans placement : toutes les racines, nommées.
 * Avec : la forme posée, ses racines en laiton et la première cerclée.
 * Avec une pentatonique : ses notes en fond, nommées, les racines cerclées
 * d'or. Toute la gamme sans forme ; la seule boîte de la forme avec.
 */
export function svgManche(
  t: Tonalite,
  a: Accord,
  p: Placement | null,
  penta: Penta | null = null,
): string {
  const racine = semiAbsolu(t, a);
  const pref = prefPour(t, a);
  const nom = nomNote(racine, pref);
  const largeur = X0 + FRETTES_MANCHE * PAS + 18;
  const hauteur = y(0) + 40;
  const haut = y(5) - 11;
  const bas = y(0) + 11;
  let s = `<svg viewBox="0 0 ${largeur} ${hauteur}" role="img" aria-label="Le manche pour ${nom}">`;
  s += `<rect x="${X0}" y="${haut}" width="${FRETTES_MANCHE * PAS}" height="${bas - haut}" fill="var(--touche)"/>`;
  // Repères de touche, en nacre discrète : un point, deux à la douzième.
  for (const f of REPERES) {
    const x = xCase(f);
    const points = f === 12 ? [Y0 + 1.5 * ECART, Y0 + 3.5 * ECART] : [Y0 + 2.5 * ECART];
    for (const cy of points) {
      s += `<circle cx="${x}" cy="${cy}" r="5" fill="var(--ivoire-3)" opacity="0.35"/>`;
    }
    s += `<text x="${x}" y="${bas + 20}" font-size="11" fill="var(--ivoire-3)" text-anchor="middle">${f}</text>`;
  }
  for (let f = 1; f <= FRETTES_MANCHE; f++) {
    s += `<line x1="${X0 + f * PAS}" y1="${haut}" x2="${X0 + f * PAS}" y2="${bas}" stroke="var(--frette-2)" stroke-width="1.5"/>`;
  }
  s += `<rect x="${X0 - 2.5}" y="${haut}" width="5" height="${bas - haut}" fill="var(--ivoire-2)"/>`;
  for (let corde = 0; corde < 6; corde++) {
    s += `<line x1="${X0 - 4}" y1="${y(corde)}" x2="${X0 + FRETTES_MANCHE * PAS}" y2="${y(corde)}" stroke="var(--ivoire-3)" stroke-width="${(0.8 + (5 - corde) * 0.3).toFixed(1)}"/>`;
    s += `<text x="12" y="${y(corde) + 4}" font-size="11" fill="var(--ivoire-3)" text-anchor="middle">${LETTRES_CORDES[corde]}</text>`;
  }
  if (penta) {
    const prefGamme = prefPenta(t, a, penta);
    const notes = p ? boitePenta(t, a, penta, p) : notesPenta(t, a, penta);
    for (const [corde, f, classe] of notes) {
      const estRacine = classe === racine;
      if (estRacine && !p) continue; // dessinée en grand juste après
      s += `<circle cx="${xCase(f)}" cy="${y(corde)}" r="8" fill="var(--bois-3)" stroke="var(${estRacine ? '--laiton' : '--ivoire-3'})" stroke-width="${estRacine ? 1.8 : 1}"/>`;
      s += `<text x="${xCase(f)}" y="${y(corde) + 3.2}" font-size="9" font-weight="500" fill="var(${estRacine ? '--laiton' : '--ivoire-2'})" text-anchor="middle">${nomNote(classe, prefGamme)}</text>`;
    }
  }
  if (!p) {
    for (const [corde, f] of racines(t, a)) {
      s += `<circle cx="${xCase(f)}" cy="${y(corde)}" r="9" fill="var(--laiton)"/>`;
      s += `<text x="${xCase(f)}" y="${y(corde) + 3.5}" font-size="10" font-weight="600" fill="var(--sur-couleur)" text-anchor="middle">${nom}</text>`;
    }
  } else {
    p.frettes.forEach((f, corde) => {
      if (f === null) {
        s += `<text x="${X0 - 16}" y="${y(corde) + 4}" font-size="12" fill="var(--ivoire-3)" text-anchor="middle">×</text>`;
        return;
      }
      // La forme prend sa couleur CAGED ; l'or reste aux racines, en anneau.
      const estRacine = mod12(PC_CORDES[corde]! + f) === racine;
      if (corde === p.forme.ancre) {
        s += `<circle cx="${xCase(f)}" cy="${y(corde)}" r="13.5" fill="none" stroke="var(--laiton)" stroke-width="2.2"/>`;
      }
      s += `<circle cx="${xCase(f)}" cy="${y(corde)}" r="8" fill="${couleurForme(p.forme.lettre)}"${estRacine ? ' stroke="var(--laiton)" stroke-width="2.4"' : ''}/>`;
    });
  }
  return s + '</svg>';
}
