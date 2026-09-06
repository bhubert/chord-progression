/**
 * Progressions de référence et enchaînements fréquents.
 *
 * Chaque pas est un intervalle depuis la tonique et une qualité, jamais un
 * nom d'accord : la même progression se lit dans les douze tonalités. Les
 * titres cités sont des exemples vérifiés, pas une liste exhaustive : deux ou
 * trois suffisent à situer le son.
 *
 * Pour ajouter une progression : un objet de plus ici, rien d'autre. Le test
 * `tests/progressions.test.ts` vérifie que les pas restent dans la gamme des
 * intervalles et que les ambiances sont connues.
 */

import type { Mode, Qualite } from './theorie.ts';

export const AMBIANCES = [
  'pop',
  'lumineux',
  'mélancolique',
  'rock',
  'folk',
  'jazz',
  'rétro',
  'sombre',
  'blues',
] as const;
export type Ambiance = (typeof AMBIANCES)[number];

export interface Progression {
  nom: string;
  mode: Mode;
  /** [demi-tons depuis la tonique, qualité] */
  pas: readonly (readonly [number, Qualite])[];
  ambiances: readonly Ambiance[];
  titres: readonly string[];
  /** Rythmique à sélectionner au chargement (id de `RYTHMIQUES`). */
  rythmique?: string;
}

export const PROGRESSIONS: readonly Progression[] = [
  {
    nom: 'Les quatre accords de la pop',
    mode: 'maj',
    pas: [
      [0, 'maj'],
      [7, 'maj'],
      [9, 'min'],
      [5, 'maj'],
    ],
    ambiances: ['pop', 'lumineux'],
    titres: ['Let It Be', 'With or Without You', 'No Woman No Cry'],
  },
  {
    nom: 'Le tube doux-amer',
    mode: 'maj',
    pas: [
      [9, 'min'],
      [5, 'maj'],
      [0, 'maj'],
      [7, 'maj'],
    ],
    ambiances: ['pop', 'mélancolique'],
    titres: ['Numb', 'Zombie', 'Save Tonight'],
  },
  {
    nom: 'Doo-wop des années 50',
    mode: 'maj',
    pas: [
      [0, 'maj'],
      [9, 'min'],
      [5, 'maj'],
      [7, 'maj'],
    ],
    ambiances: ['rétro', 'lumineux'],
    titres: ['Stand by Me', 'Every Breath You Take', 'Unchained Melody'],
  },
  {
    nom: 'Trois accords et la vérité',
    mode: 'maj',
    pas: [
      [0, 'maj'],
      [5, 'maj'],
      [7, 'maj'],
    ],
    ambiances: ['rock', 'folk', 'blues'],
    titres: ['Twist and Shout', 'La Bamba', 'Wild Thing'],
  },
  {
    nom: 'La cadence jazz',
    mode: 'maj',
    pas: [
      [2, 'min'],
      [7, 'maj'],
      [0, 'maj'],
    ],
    ambiances: ['jazz'],
    titres: ['Autumn Leaves', 'Satin Doll', 'Tune Up'],
  },
  {
    nom: 'Le tour de Blue Moon',
    mode: 'maj',
    pas: [
      [0, 'maj'],
      [9, 'min'],
      [2, 'min'],
      [7, 'maj'],
    ],
    ambiances: ['jazz', 'rétro'],
    titres: ['Blue Moon', 'Heart and Soul', 'I Got Rhythm'],
  },
  {
    nom: 'Rock sudiste',
    mode: 'maj',
    pas: [
      [7, 'maj'],
      [5, 'maj'],
      [0, 'maj'],
    ],
    ambiances: ['rock'],
    titres: ['Sweet Home Alabama', 'Sweet Child O’ Mine'],
  },
  {
    nom: 'La septième empruntée',
    mode: 'maj',
    pas: [
      [0, 'maj'],
      [10, 'maj'],
      [5, 'maj'],
    ],
    ambiances: ['rock', 'folk'],
    titres: ['Sympathy for the Devil', 'Hey Jude, la coda'],
  },
  {
    nom: 'La route royale',
    mode: 'maj',
    pas: [
      [5, 'maj'],
      [7, 'maj'],
      [4, 'min'],
      [9, 'min'],
    ],
    ambiances: ['pop', 'lumineux'],
    titres: ['Omniprésente dans la J-pop'],
  },
  {
    nom: 'Cadence andalouse',
    mode: 'min',
    pas: [
      [0, 'min'],
      [10, 'maj'],
      [8, 'maj'],
      [7, 'maj'],
    ],
    ambiances: ['sombre'],
    titres: ['Hit the Road Jack', 'Sultans of Swing', 'Stray Cat Strut'],
  },
  {
    nom: 'Mineur épique',
    mode: 'min',
    pas: [
      [0, 'min'],
      [8, 'maj'],
      [3, 'maj'],
      [10, 'maj'],
    ],
    ambiances: ['mélancolique', 'pop'],
    titres: ['Hello', 'Numb, relu en mineur'],
  },
  {
    nom: 'La tour de guet',
    mode: 'min',
    pas: [
      [0, 'min'],
      [10, 'maj'],
      [8, 'maj'],
      [10, 'maj'],
    ],
    ambiances: ['rock', 'sombre'],
    titres: ['All Along the Watchtower', 'Stairway to Heaven, le solo'],
  },
  {
    nom: 'Le blues en douze mesures',
    mode: 'maj',
    pas: [
      [0, 'dom7'],
      [0, 'dom7'],
      [0, 'dom7'],
      [0, 'dom7'],
      [5, 'dom7'],
      [5, 'dom7'],
      [0, 'dom7'],
      [0, 'dom7'],
      [7, 'dom7'],
      [5, 'dom7'],
      [0, 'dom7'],
      [7, 'dom7'],
    ],
    ambiances: ['blues', 'rock'],
    titres: ['Johnny B. Goode', 'Hound Dog', 'Rock Around the Clock'],
    rythmique: 'shuffle',
  },
  {
    nom: 'Le blues, quick change',
    mode: 'maj',
    pas: [
      [0, 'dom7'],
      [5, 'dom7'],
      [0, 'dom7'],
      [0, 'dom7'],
      [5, 'dom7'],
      [5, 'dom7'],
      [0, 'dom7'],
      [0, 'dom7'],
      [7, 'dom7'],
      [5, 'dom7'],
      [0, 'dom7'],
      [7, 'dom7'],
    ],
    ambiances: ['blues'],
    titres: ['Sweet Home Chicago', 'Pride and Joy', 'Crossroads'],
    rythmique: 'shuffle',
  },
  {
    nom: 'Le blues mineur',
    mode: 'min',
    pas: [
      [0, 'min'],
      [0, 'min'],
      [0, 'min'],
      [0, 'min'],
      [5, 'min'],
      [5, 'min'],
      [0, 'min'],
      [0, 'min'],
      [8, 'maj'],
      [7, 'dom7'],
      [0, 'min'],
      [7, 'dom7'],
    ],
    ambiances: ['blues', 'sombre'],
    titres: ['The Thrill Is Gone', 'Mr. P.C.', 'Equinox'],
    rythmique: 'shuffle',
  },
];

/**
 * Enchaînements fréquents : pour chaque degré (0 à 6), les degrés qui le
 * suivent le plus souvent, du plus courant au moins courant. Sert à la
 * suggestion « Souvent après … ».
 */
export const SUITES: Record<Mode, readonly (readonly number[])[]> = {
  maj: [
    [3, 4, 5, 1],
    [4, 3, 0],
    [5, 3, 1],
    [4, 0, 1],
    [0, 5, 3],
    [3, 1, 4],
    [0, 2],
  ],
  min: [
    [5, 3, 6, 4],
    [4, 0],
    [6, 5, 3],
    [4, 0, 6],
    [0, 5],
    [2, 6, 3],
    [2, 0, 5],
  ],
};
