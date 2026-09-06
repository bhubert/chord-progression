import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  adresse,
  chiffre,
  diatoniques,
  lireAdresse,
  nomAccord,
  nomTonalite,
  transposerMode,
  type Tonalite,
} from '../src/data/theorie.ts';

const SOL: Tonalite = { tonique: 7, mode: 'maj' };
const FA: Tonalite = { tonique: 5, mode: 'maj' };
const DO: Tonalite = { tonique: 0, mode: 'maj' };
const LAm: Tonalite = { tonique: 9, mode: 'min' };

const nomsDiatoniques = (t: Tonalite) => diatoniques(t.mode).map((a) => nomAccord(t, a));

test('Sol majeur s’écrit avec des dièses, Fa majeur avec des bémols', () => {
  assert.deepEqual(nomsDiatoniques(SOL), ['G', 'Am', 'Bm', 'C', 'D', 'Em', 'F#°']);
  assert.deepEqual(nomsDiatoniques(FA), ['F', 'Gm', 'Am', 'Bb', 'C', 'Dm', 'E°']);
  assert.deepEqual(nomsDiatoniques(LAm), ['Am', 'B°', 'C', 'Dm', 'Em', 'F', 'G']);
});

test('un emprunt s’écrit selon son chiffrage : bVII en Do est Sib, pas La#', () => {
  assert.equal(nomAccord(DO, { rel: 10, q: 'maj' }), 'Bb');
  assert.equal(nomAccord(SOL, { rel: 10, q: 'maj' }), 'F');
});

test('le chiffrage suit la qualité', () => {
  assert.equal(chiffre({ rel: 9, q: 'min' }, 'maj'), 'vi');
  assert.equal(chiffre({ rel: 11, q: 'dim' }, 'maj'), 'vii°');
  assert.equal(chiffre({ rel: 10, q: 'maj' }, 'maj'), 'bVII');
  assert.equal(chiffre({ rel: 3, q: 'maj' }, 'min'), 'III');
});

test('la tonalité se nomme en français', () => {
  assert.equal(nomTonalite(SOL), 'Sol majeur');
  assert.equal(nomTonalite({ tonique: 10, mode: 'min' }), 'Sib mineur');
  assert.equal(nomTonalite({ tonique: 6, mode: 'maj' }), 'Fa# majeur');
});

test('passer en mineur garde les degrés et change les qualités', () => {
  const pop = diatoniques('maj').filter((_, i) => [0, 4, 5, 3].includes(i));
  const grille = [0, 4, 5, 3].map((i) => diatoniques('maj')[i]!);
  assert.deepEqual(
    transposerMode(grille, 'maj', 'min').map((a) => chiffre(a, 'min')),
    ['i', 'v', 'VI', 'iv'],
  );
  assert.equal(pop.length, 4);
});

test('l’adresse décrit la grille et se relit à l’identique', () => {
  const grille = [0, 4, 5, 3].map((i) => diatoniques('maj')[i]!);
  assert.equal(adresse(SOL, grille), '#sol-majeur/I-V-vi-IV');
  assert.deepEqual(lireAdresse('#sol-majeur/I-V-vi-IV'), { tonalite: SOL, grille });

  const fadm: Tonalite = { tonique: 6, mode: 'min' };
  const andalouse = [
    { rel: 0, q: 'min' as const },
    { rel: 10, q: 'maj' as const },
    { rel: 8, q: 'maj' as const },
    { rel: 7, q: 'maj' as const },
  ];
  assert.equal(adresse(fadm, andalouse), '#fa-diese-mineur/i-VII-VI-V');
  assert.deepEqual(lireAdresse('#fa-diese-mineur/i-VII-VI-V'), {
    tonalite: fadm,
    grille: andalouse,
  });

  assert.equal(adresse({ tonique: 10, mode: 'maj' }, []), '#si-bemol-majeur');
  assert.deepEqual(lireAdresse('#si-bemol-majeur')?.grille, []);
  assert.equal(adresse(SOL, [{ rel: 11, q: 'dim' }]), '#sol-majeur/viio');
  assert.deepEqual(lireAdresse('#sol-majeur/viio')?.grille, [{ rel: 11, q: 'dim' }]);
});

test('une adresse inconnue ou un accord inconnu sont ignorés sans erreur', () => {
  assert.equal(lireAdresse(''), null);
  assert.equal(lireAdresse('#nimporte-quoi'), null);
  assert.deepEqual(lireAdresse('#do-majeur/I-XYZ-V')?.grille, [
    { rel: 0, q: 'maj' },
    { rel: 7, q: 'maj' },
  ]);
});
