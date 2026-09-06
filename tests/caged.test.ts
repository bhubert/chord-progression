import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FORMES,
  FRETTES_MANCHE,
  descriptionAncre,
  forme,
  nomsPenta,
  notesPenta,
  notesPlacement,
  placer,
  racines,
  relativePenta,
  svgManche,
} from '../src/data/caged.ts';
import { PC_CORDES } from '../src/data/positions.ts';
import type { Qualite, Tonalite } from '../src/data/theorie.ts';

const DO: Tonalite = { tonique: 0, mode: 'maj' };
const SOL: Tonalite = { tonique: 7, mode: 'maj' };
const INTERVALLES: Record<Qualite, number[]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
  dom7: [0, 4, 7, 10],
};

test('chaque forme, posée sur chaque racine, joue les notes de l’accord et tient sur le manche', () => {
  for (const q of ['maj', 'min', 'dom7'] as const) {
    for (const f of FORMES[q]) {
      for (let semi = 0; semi < 12; semi++) {
        const t: Tonalite = { tonique: semi, mode: 'maj' };
        const p = placer(t, { rel: 0, q }, f);
        const attendues = new Set(INTERVALLES[q].map((i) => (semi + i) % 12));
        p.frettes.forEach((frette, corde) => {
          if (frette === null) return;
          assert.ok(
            frette >= 0 && frette <= FRETTES_MANCHE,
            `${q} ${f.lettre} sur ${semi} : case ${frette}`,
          );
          const classe = (PC_CORDES[corde]! + frette) % 12;
          assert.ok(
            attendues.has(classe),
            `${q} ${f.lettre} sur ${semi} : note étrangère corde ${corde}`,
          );
        });
        const ancre = p.frettes[f.ancre]!;
        assert.equal(
          (PC_CORDES[f.ancre]! + ancre) % 12,
          semi,
          `${q} ${f.lettre} : l’ancre n’est pas la racine`,
        );
        assert.ok(notesPlacement(p).length >= 3);
      }
    }
  }
});

test('les cinq formes de Do majeur se posent là où le CAGED l’enseigne', () => {
  const ou = (lettre: 'C' | 'A' | 'G' | 'E' | 'D') => {
    const p = placer(DO, { rel: 0, q: 'maj' }, forme('maj', lettre)!);
    return [p.forme.ancre, p.ancreFrette];
  };
  assert.deepEqual(ou('C'), [1, 3], 'Do : corde de La, case 3');
  assert.deepEqual(ou('A'), [1, 3], 'La : corde de La, case 3');
  assert.deepEqual(ou('G'), [0, 8], 'Sol : corde de Mi grave, case 8');
  assert.deepEqual(ou('E'), [0, 8], 'Mi : corde de Mi grave, case 8');
  assert.deepEqual(ou('D'), [2, 10], 'Ré : corde de Ré, case 10');
});

test('la forme de Mi pour Fa est le barré de Fa, et la forme de Do pour Sib monte d’une octave', () => {
  const FA: Tonalite = { tonique: 5, mode: 'maj' };
  assert.deepEqual(
    placer(FA, { rel: 0, q: 'maj' }, forme('maj', 'E')!).frettes,
    [1, 3, 3, 2, 1, 1],
  );
  const SIB: Tonalite = { tonique: 10, mode: 'maj' };
  const p = placer(SIB, { rel: 0, q: 'maj' }, forme('maj', 'C')!);
  assert.equal(p.ancreFrette, 13);
  assert.equal(descriptionAncre(p), 'corde de La, case 13');
});

test('la description dit la corde et la case, ou « à vide »', () => {
  const MI: Tonalite = { tonique: 4, mode: 'maj' };
  assert.equal(
    descriptionAncre(placer(MI, { rel: 0, q: 'maj' }, forme('maj', 'E')!)),
    'corde de Mi grave, à vide',
  );
  assert.equal(
    descriptionAncre(placer(SOL, { rel: 0, q: 'maj' }, forme('maj', 'E')!)),
    'corde de Mi grave, case 3',
  );
});

test('les racines couvrent chaque corde au moins une fois jusqu’à la quinzième case', () => {
  const r = racines(SOL, { rel: 0, q: 'maj' });
  for (let corde = 0; corde < 6; corde++) {
    assert.ok(
      r.some(([c]) => c === corde),
      `aucune racine sur la corde ${corde}`,
    );
  }
  assert.ok(
    r.some(([c, f]) => c === 0 && f === 3),
    'Sol grave, case 3',
  );
  assert.ok(
    r.some(([c, f]) => c === 3 && f === 0),
    'Sol à vide',
  );
});

test('le dessin nomme les racines sans forme, et cercle la première avec une forme', () => {
  const sans = svgManche(SOL, { rel: 0, q: 'maj' }, null);
  assert.match(sans, />G<\/text>/);
  assert.doesNotMatch(sans, /r="13"/);
  const avec = svgManche(
    SOL,
    { rel: 0, q: 'maj' },
    placer(SOL, { rel: 0, q: 'maj' }, forme('maj', 'E')!),
  );
  assert.match(avec, /r="13"/);
});

test('la pentatonique majeure de Sol a les notes de la mineure de Mi, et couvre le manche', () => {
  assert.deepEqual(nomsPenta(SOL, { rel: 0, q: 'maj' }, 'maj'), ['G', 'A', 'B', 'D', 'E']);
  assert.deepEqual(nomsPenta(SOL, { rel: 9, q: 'min' }, 'min'), ['E', 'G', 'A', 'B', 'D']);
  assert.deepEqual(relativePenta(SOL, { rel: 0, q: 'maj' }, 'maj'), { nom: 'E', penta: 'min' });
  assert.deepEqual(relativePenta(SOL, { rel: 9, q: 'min' }, 'min'), { nom: 'G', penta: 'maj' });
  // La mineure de Sol s'écrit avec les bémols de Sib majeur, sa relative.
  assert.deepEqual(nomsPenta(SOL, { rel: 0, q: 'maj' }, 'min'), ['G', 'Bb', 'C', 'D', 'F']);
  assert.deepEqual(relativePenta(SOL, { rel: 0, q: 'maj' }, 'min'), { nom: 'Bb', penta: 'maj' });
  const FA: Tonalite = { tonique: 5, mode: 'maj' };
  assert.deepEqual(nomsPenta(FA, { rel: 0, q: 'maj' }, 'maj'), ['F', 'G', 'A', 'C', 'D']);
  assert.deepEqual(nomsPenta(FA, { rel: 0, q: 'maj' }, 'min'), ['F', 'Ab', 'Bb', 'C', 'Eb']);
  const notes = notesPenta(SOL, { rel: 0, q: 'maj' }, 'maj');
  const classes = new Set(notes.map(([, , c]) => c));
  assert.deepEqual(
    [...classes].sort((a, b) => a - b),
    [2, 4, 7, 9, 11],
  );
  for (let corde = 0; corde < 6; corde++) {
    assert.ok(notes.filter(([c]) => c === corde).length >= 6, `corde ${corde}`);
  }
  // « A » apparaît une fois sans pentatonique (la lettre de la corde de La),
  // et sur chaque corde une ou deux fois de plus avec.
  const compte = (svg: string) => (svg.match(/>A<\/text>/g) ?? []).length;
  assert.equal(compte(svgManche(SOL, { rel: 0, q: 'maj' }, null)), 1);
  assert.ok(compte(svgManche(SOL, { rel: 0, q: 'maj' }, null, 'maj')) >= 7);
});
