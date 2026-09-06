/**
 * Théorie : noms de notes, gammes, chiffrage romain, adresse.
 *
 * Tout est relatif à la tonique. Un accord est un intervalle en demi-tons
 * depuis la tonique et une qualité, jamais une note absolue : changer de
 * tonalité transpose donc la grille sans rien recalculer, et l'adresse
 * (`#sol-majeur/I-V-vi-IV`) se lit et s'écrit sans ambiguïté.
 *
 * Ce module n'a aucune dépendance et ne touche pas au DOM : il est exécuté tel
 * quel par `node --test` (voir `tests/`), d'où les imports avec extension.
 */

export type Mode = 'maj' | 'min';
/** `dom7` : septième de dominante, la couleur du blues. */
export type Qualite = 'maj' | 'min' | 'dim' | 'dom7';
export type Alteration = '#' | 'b';

export interface Accord {
  /** Demi-tons depuis la tonique, de 0 à 11. */
  rel: number;
  q: Qualite;
}

export interface Tonalite {
  /** Demi-tons depuis Do, de 0 à 11. */
  tonique: number;
  mode: Mode;
}

export const NOMS: Record<Alteration, readonly string[]> = {
  '#': ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
  b: ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'],
};

const FR: Record<string, string> = {
  C: 'Do',
  D: 'Ré',
  E: 'Mi',
  F: 'Fa',
  G: 'Sol',
  A: 'La',
  B: 'Si',
};
const SLUG_FR: Record<string, number> = { do: 0, re: 2, mi: 4, fa: 5, sol: 7, la: 9, si: 11 };

/**
 * Altération préférée par tonique : Sol majeur s'écrit avec des dièses
 * (Fa#°), Fa majeur avec des bémols (Sib). Index = demi-tons depuis Do.
 */
export const PREF: Record<Mode, readonly Alteration[]> = {
  maj: ['#', 'b', '#', 'b', '#', 'b', '#', '#', 'b', '#', 'b', '#'],
  min: ['b', '#', 'b', 'b', '#', 'b', '#', 'b', '#', '#', 'b', '#'],
};

/** Degrés de la gamme (demi-tons) et qualité de l'accord bâti sur chacun. */
export const GAMMES: Record<Mode, { deg: readonly number[]; q: readonly Qualite[] }> = {
  maj: { deg: [0, 2, 4, 5, 7, 9, 11], q: ['maj', 'min', 'min', 'maj', 'maj', 'min', 'dim'] },
  min: { deg: [0, 2, 3, 5, 7, 8, 10], q: ['min', 'dim', 'maj', 'min', 'min', 'maj', 'maj'] },
};

/**
 * Chiffrage romain de chaque intervalle, par mode. En mineur, le troisième
 * degré est III et non bIII : c'est l'usage des grilles, pas celui des
 * manuels d'harmonie.
 */
export const CHIFFRES: Record<Mode, readonly string[]> = {
  maj: ['I', 'bII', 'II', 'bIII', 'III', 'IV', 'bV', 'V', 'bVI', 'VI', 'bVII', 'VII'],
  min: ['I', 'bII', 'II', 'III', '#III', 'IV', 'bV', 'V', 'VI', '#VI', 'VII', '#VII'],
};

export const SUFFIXE: Record<Qualite, string> = { maj: '', min: 'm', dim: '°', dom7: '7' };
export const NOM_MODE: Record<Mode, string> = { maj: 'majeur', min: 'mineur' };

export const mod12 = (n: number): number => ((n % 12) + 12) % 12;

export const nomNote = (semi: number, pref: Alteration): string => NOMS[pref][mod12(semi)]!;

/** « Sol », « Fa# », « Sib ». */
export function nomFr(semi: number, pref: Alteration): string {
  const n = nomNote(semi, pref);
  return FR[n[0]!]! + n.slice(1);
}

export const prefTonalite = (t: Tonalite): Alteration => PREF[t.mode][t.tonique]!;

/** « Sol majeur ». */
export const nomTonalite = (t: Tonalite): string =>
  `${nomFr(t.tonique, prefTonalite(t))} ${NOM_MODE[t.mode]}`;

export const semiAbsolu = (t: Tonalite, a: Accord): number => mod12(t.tonique + a.rel);

/**
 * Un accord emprunté s'écrit selon son chiffrage (bVII en Do reste Sib, pas
 * La#), un accord diatonique selon la tonalité.
 */
export function prefPour(t: Tonalite, a: Accord): Alteration {
  const c = CHIFFRES[t.mode][a.rel]!;
  if (c.startsWith('b')) return 'b';
  if (c.startsWith('#')) return '#';
  return prefTonalite(t);
}

/** « F# » pour Fa# mineur en Sol majeur. */
export const racine = (t: Tonalite, a: Accord): string => nomNote(semiAbsolu(t, a), prefPour(t, a));

/** « F#m ». */
export const nomAccord = (t: Tonalite, a: Accord): string => racine(t, a) + SUFFIXE[a.q];

/** « vi », « bVII », « vii° », « V7 ». */
export function chiffre(a: Accord, mode: Mode): string {
  let c = CHIFFRES[mode][a.rel]!;
  if (a.q === 'min' || a.q === 'dim') c = c.replace(/[IV]+/, (m) => m.toLowerCase());
  if (a.q === 'dim') c += '°';
  if (a.q === 'dom7') c += '7';
  return c;
}

/** Les sept accords de la gamme, dans l'ordre des degrés. */
export const diatoniques = (mode: Mode): Accord[] =>
  GAMMES[mode].deg.map((rel, i) => ({ rel, q: GAMMES[mode].q[i]! }));

/** Index du degré (0 à 6) si l'accord est diatonique, -1 sinon. */
export function degreDe(a: Accord, mode: Mode): number {
  const i = GAMMES[mode].deg.indexOf(a.rel);
  return i >= 0 && GAMMES[mode].q[i] === a.q ? i : -1;
}

/** Sans doublon, en conservant l'ordre d'apparition. */
export function uniques(liste: readonly Accord[]): Accord[] {
  const vus = new Set<string>();
  return liste.filter((a) => {
    const cle = `${a.q}${a.rel}`;
    if (vus.has(cle)) return false;
    vus.add(cle);
    return true;
  });
}

/**
 * Passage majeur ↔ mineur : un accord diatonique garde son degré et prend la
 * qualité du nouveau mode (I–V–vi–IV devient i–v–VI–iv), un emprunt reste tel
 * quel. C'est la lecture « parallèle » d'une progression, celle qui donne une
 * version sombre d'un tube ou une version lumineuse d'une ballade.
 */
export function transposerMode(grille: readonly Accord[], ancien: Mode, nouveau: Mode): Accord[] {
  const cible = diatoniques(nouveau);
  return grille.map((a) => {
    const d = degreDe(a, ancien);
    return d >= 0 ? cible[d]! : a;
  });
}

// ── Adresse ────────────────────────────────────────────────────────────────
//
// `#sol-majeur/I-V-vi-IV`. Lisible, sans caractère à encoder : le ° s'écrit
// `o`, la septième `7`, les altérations `-diese` et `-bemol`. Un lien décrit la grille en clair.

const sansAccents = (s: string): string => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export function adresse(t: Tonalite, grille: readonly Accord[]): string {
  const tonique = sansAccents(nomFr(t.tonique, prefTonalite(t)))
    .toLowerCase()
    .replace('#', '-diese')
    .replace(/b$/, '-bemol');
  const g = grille.map((a) => chiffre(a, t.mode).replace('°', 'o')).join('-');
  return `#${tonique}-${NOM_MODE[t.mode]}${g ? '/' + g : ''}`;
}

export function lireAdresse(hash: string): { tonalite: Tonalite; grille: Accord[] } | null {
  const m = /^#([a-z]+)(?:-(diese|bemol))?-(majeur|mineur)(?:\/(.*))?$/.exec(hash);
  if (!m || !(m[1]! in SLUG_FR)) return null;
  const mode: Mode = m[3] === 'majeur' ? 'maj' : 'min';
  const tonique = mod12(SLUG_FR[m[1]!]! + (m[2] === 'diese' ? 1 : m[2] === 'bemol' ? -1 : 0));
  const grille = (m[4] ? m[4].split('-') : [])
    .map((c): Accord | null => {
      const p = /^([b#]?)([ivIV]+)(o|7)?$/.exec(c);
      if (!p) return null;
      const rel = CHIFFRES[mode].indexOf(p[1]! + p[2]!.toUpperCase());
      if (rel < 0) return null;
      const q: Qualite =
        p[3] === 'o' ? 'dim' : p[3] === '7' ? 'dom7' : p[2] === p[2]!.toLowerCase() ? 'min' : 'maj';
      return { rel, q };
    })
    .filter((a): a is Accord => a !== null);
  return { tonalite: { tonique, mode }, grille };
}
