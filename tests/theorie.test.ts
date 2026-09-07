import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  adresse,
  basculerSeptiemes,
  chiffre,
  deplacer,
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

test('la septième de dominante s’écrit avec un 7, dans l’adresse aussi', () => {
  assert.equal(nomAccord(SOL, { rel: 7, q: 'dom7' }), 'D7');
  assert.equal(chiffre({ rel: 7, q: 'dom7' }, 'maj'), 'V7');
  assert.equal(chiffre({ rel: 7, q: 'dom7' }, 'min'), 'V7');
  const blues = [0, 5, 7].map((rel) => ({ rel, q: 'dom7' as const }));
  assert.equal(adresse(SOL, blues), '#sol-majeur/I7-IV7-V7');
  assert.deepEqual(lireAdresse('#sol-majeur/I7-IV7-V7')?.grille, blues);
  // Une septième n'est pas diatonique : le passage en mineur la laisse telle quelle.
  assert.deepEqual(transposerMode(blues, 'maj', 'min'), blues);
});

test('la grille passe en septièmes sur I, IV et V, et revient aux accords purs', () => {
  const pure = [0, 3, 4].map((i) => diatoniques('maj')[i]!); // I IV V
  const septiemes = basculerSeptiemes(pure);
  assert.deepEqual(
    septiemes.map((a) => chiffre(a, 'maj')),
    ['I7', 'IV7', 'V7'],
  );
  assert.deepEqual(basculerSeptiemes(septiemes), pure);
  // Le vi n'est pas concerné, et un mélange repasse d'abord en accords purs.
  const pop = [0, 4, 5, 3].map((i) => diatoniques('maj')[i]!);
  assert.deepEqual(
    basculerSeptiemes(pop).map((a) => chiffre(a, 'maj')),
    ['I7', 'V7', 'vi', 'IV7'],
  );
});

test('le chiffrage classique met tout en majuscules, l’adresse garde la casse', () => {
  const pop = [0, 4, 5, 3].map((i) => diatoniques('maj')[i]!);
  assert.deepEqual(
    pop.map((a) => chiffre(a, 'maj', 'majuscules')),
    ['I', 'V', 'VI', 'IV'],
  );
  assert.equal(chiffre({ rel: 11, q: 'dim' }, 'maj', 'majuscules'), 'VII°');
  assert.equal(chiffre({ rel: 2, q: 'dim' }, 'min', 'majuscules'), 'II°');
  assert.equal(chiffre({ rel: 10, q: 'maj' }, 'maj', 'majuscules'), 'bVII');
  assert.equal(chiffre({ rel: 7, q: 'dom7' }, 'maj', 'majuscules'), 'V7');
  assert.equal(adresse(SOL, pop), '#sol-majeur/I-V-vi-IV');
});

test('déplacer une mesure : vers une position comptée dans la grille d’origine', () => {
  const g = ['a', 'b', 'c', 'd'];
  assert.deepEqual(deplacer(g, 0, 4), ['b', 'c', 'd', 'a'], 'la première tout à la fin');
  assert.deepEqual(deplacer(g, 3, 0), ['d', 'a', 'b', 'c'], 'la dernière tout au début');
  assert.deepEqual(deplacer(g, 1, 3), ['a', 'c', 'b', 'd'], 'b après c');
  assert.deepEqual(deplacer(g, 2, 1), ['a', 'c', 'b', 'd'], 'c avant b');
  assert.deepEqual(deplacer(g, 1, 1), g, 'à sa place');
  assert.deepEqual(deplacer(g, 1, 2), g, 'juste après elle-même : rien ne bouge');
  assert.deepEqual(deplacer(g, 9, 0), g, 'index inconnu : rien ne bouge');
});
