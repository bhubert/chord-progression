/**
 * Positions sur le manche : doigtés de référence, diagrammes, capo.
 *
 * Un seul doigté par accord, le plus courant : ouvert quand il existe, barré
 * en forme de Mi ou de La sinon. La page répond à « comment je le joue ? »
 * d'un seul dessin ; les variantes attendront.
 */

import {
  SUFFIXE,
  mod12,
  nomNote,
  semiAbsolu,
  type Accord,
  type Qualite,
  type Tonalite,
} from './theorie.ts';

/**
 * Cordes de Mi grave à Mi aigu, `x` étouffée, chiffre = case.
 * Index = demi-tons depuis Do (0 = Do, 7 = Sol).
 */
export const POSITIONS: Record<Qualite, readonly string[]> = {
  maj: [
    'x32010',
    'x46664',
    'xx0232',
    'x68886',
    '022100',
    '133211',
    '244322',
    '320003',
    '466544',
    'x02220',
    'x13331',
    'x24442',
  ],
  min: [
    'x35543',
    'x46654',
    'xx0231',
    'x68876',
    '022000',
    '133111',
    '244222',
    '355333',
    '466444',
    'x02210',
    'x13321',
    'x24432',
  ],
  dim: [
    'x3454x',
    'x4565x',
    'x5676x',
    'x6787x',
    'x7898x',
    '1xx10x',
    '2xx21x',
    '3xx32x',
    '4xx43x',
    'x0121x',
    'x1232x',
    'x2343x',
  ],
  dom7: [
    'x32310',
    'x46464',
    'xx0212',
    'x68686',
    '020100',
    '131211',
    '242322',
    '320001',
    '464544',
    'x02020',
    'x13131',
    'x21202',
  ],
};

/** Classes de hauteur des cordes à vide (Mi La Ré Sol Si Mi). */
export const PC_CORDES = [4, 9, 2, 7, 11, 4] as const;
/** Les mêmes, en numéros MIDI (Mi2 = 40). */
export const MIDI_CORDES = [40, 45, 50, 55, 59, 64] as const;

/**
 * Formes ouvertes : Do Ré Mi Sol La, Rém Mim Lam, et les septièmes Do7 Ré7
 * Mi7 Sol7 La7 Si7. Clé = qualité + classe de hauteur.
 */
const OUVERTS = new Set([
  ...['maj0', 'maj2', 'maj4', 'maj7', 'maj9'],
  ...['min2', 'min4', 'min9'],
  ...['dom70', 'dom72', 'dom74', 'dom77', 'dom79', 'dom711'],
]);

/** Doigté d'un accord dans une tonalité : six valeurs, -1 pour une corde étouffée. */
export const doigte = (t: Tonalite, a: Accord): number[] =>
  [...POSITIONS[a.q][semiAbsolu(t, a)]!].map((c) => (c === 'x' ? -1 : Number(c)));

/** Notes MIDI jouées, de la corde grave à l'aiguë. */
export const notesMidi = (t: Tonalite, a: Accord): number[] =>
  doigte(t, a).flatMap((f, i) => (f >= 0 ? [MIDI_CORDES[i]! + f] : []));

/**
 * Diagramme SVG : six cordes, cinq cases, sillet ou numéro de position, barré
 * détecté quand plusieurs cordes partagent la case la plus basse et qu'aucune
 * n'est à vide. Le point de la fondamentale est en laiton.
 */
export function svgDiagramme(t: Tonalite, a: Accord): string {
  const v = doigte(t, a);
  const frettes = v.filter((f) => f > 0);
  const min = Math.min(...frettes);
  const max = Math.max(...frettes);
  const pos = max > 4 ? min : 1;
  const ouverts = v.some((f) => f === 0);
  const auMin = v.map((f, i) => (f === min ? i : -1)).filter((i) => i >= 0);
  const barre =
    !ouverts && auMin.length >= 2 ? { f: min, de: auMin[0]!, a: auMin[auMin.length - 1]! } : null;
  const X = (i: number) => 20 + i * 12;
  const Y = (f: number) => 24 + (f - pos + 0.5) * 16;
  const fond = semiAbsolu(t, a);

  let s = '<svg viewBox="0 0 96 110" aria-hidden="true">';
  for (let i = 0; i < 6; i++) {
    s += `<line x1="${X(i)}" y1="24" x2="${X(i)}" y2="104" stroke="var(--frette-2)" stroke-width="1"/>`;
  }
  for (let f = 0; f <= 5; f++) {
    s += `<line x1="20" y1="${24 + f * 16}" x2="80" y2="${24 + f * 16}" stroke="var(--frette-2)" stroke-width="1"/>`;
  }
  if (pos === 1) s += '<rect x="19" y="22" width="62" height="3" fill="var(--ivoire-2)"/>';
  else
    s += `<text x="9" y="${Y(pos) + 4}" font-size="11" fill="var(--ivoire-2)" text-anchor="middle">${pos}</text>`;
  if (barre) {
    s += `<rect x="${X(barre.de) - 5}" y="${Y(barre.f) - 5}" width="${X(barre.a) - X(barre.de) + 10}" height="10" rx="5" fill="var(--ivoire)"/>`;
  }
  v.forEach((f, i) => {
    const estFond = mod12(PC_CORDES[i]! + Math.max(f, 0)) === fond;
    if (f === -1) {
      s += `<path d="M${X(i) - 3} 9l6 6M${X(i) + 3} 9l-6 6" stroke="var(--ivoire-3)" stroke-width="1.4"/>`;
    } else if (f === 0) {
      s += `<circle cx="${X(i)}" cy="12" r="3.4" fill="none" stroke="var(${estFond ? '--laiton' : '--ivoire-2'})" stroke-width="1.4"/>`;
    } else if (!(barre && f === barre.f)) {
      s += `<circle cx="${X(i)}" cy="${Y(f)}" r="5" fill="var(${estFond ? '--laiton' : '--ivoire'})"/>`;
    } else if (estFond) {
      s += `<circle cx="${X(i)}" cy="${Y(f)}" r="3" fill="var(--laiton)"/>`;
    }
  });
  return s + '</svg>';
}

export interface Capo {
  /** Case du capo, 0 si aucun n'aide. */
  capo: number;
  /** Nombre d'accords joués en forme ouverte avec ce capo. */
  ouverts: number;
  total: number;
  /** Formes à jouer, dans l'ordre des accords : « G », « Em ». */
  formes: string[];
}

/**
 * Le capo qui rend le plus d'accords jouables en forme ouverte, entre la
 * première et la septième case. À égalité, le plus bas. Sans capo si rien ne
 * fait mieux que la position naturelle.
 */
export function meilleurCapo(t: Tonalite, accords: readonly Accord[]): Capo | null {
  if (!accords.length) return null;
  const score = (c: number) =>
    accords.filter((a) => OUVERTS.has(a.q + mod12(semiAbsolu(t, a) - c))).length;
  let meilleur = { capo: 0, ouverts: score(0) };
  for (let c = 1; c <= 7; c++) {
    const s = score(c);
    if (s > meilleur.ouverts) meilleur = { capo: c, ouverts: s };
  }
  return {
    ...meilleur,
    total: accords.length,
    formes: accords.map((a) => nomNote(semiAbsolu(t, a) - meilleur.capo, '#') + SUFFIXE[a.q]),
  };
}
