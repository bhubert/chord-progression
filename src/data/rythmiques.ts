/**
 * Rythmiques : ce que la main droite fait pendant une mesure.
 *
 * Huit croches par mesure, un jeton chacune :
 *
 *   B  battement vers le bas, appuyé     H  battement vers le haut, léger
 *   b  battement vers le bas, léger      .  rien
 *   p  la basse seule                    i m a  les trois cordes aiguës,
 *                                               de la plus grave à la plus aiguë
 *
 * `swing` : les croches sont inégales, deux tiers puis un tiers du temps.
 * C'est le shuffle du blues.
 */

export interface Rythmique {
  id: string;
  nom: string;
  /** Huit jetons, un par croche. */
  motif: string;
  swing?: boolean;
}

export const JETONS = '.BbHpima';

export const RYTHMIQUES: readonly Rythmique[] = [
  { id: 'ronde', nom: 'Une par mesure', motif: 'B.......' },
  { id: 'noires', nom: 'Quatre temps', motif: 'B.b.B.b.' },
  { id: 'folk', nom: 'Folk', motif: 'B.BH.HBH' },
  { id: 'rock', nom: 'Rock, toutes les croches', motif: 'BbBbBbBb' },
  { id: 'country', nom: 'Country, basse et frappe', motif: 'p.H.p.H.' },
  { id: 'reggae', nom: 'Reggae', motif: '..H...H.' },
  { id: 'arpege', nom: 'Arpège', motif: 'pimapima' },
  { id: 'shuffle', nom: 'Shuffle blues', motif: 'BHbHBHbH', swing: true },
];

export const RYTHMIQUE_DEFAUT = 'folk';

/** La rythmique demandée, ou celle par défaut si l'id est inconnu. */
export const rythmique = (id: string): Rythmique =>
  RYTHMIQUES.find((r) => r.id === id) ?? RYTHMIQUES.find((r) => r.id === RYTHMIQUE_DEFAUT)!;

/** Durée de chacune des huit croches, en temps (une mesure en fait quatre). */
export const dureesCroches = (r: Rythmique): number[] =>
  Array.from({ length: 8 }, (_, i) => (r.swing ? (i % 2 === 0 ? 2 / 3 : 1 / 3) : 0.5));
