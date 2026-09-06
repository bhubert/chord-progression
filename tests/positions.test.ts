import { test } from 'node:test';
import assert from 'node:assert/strict';
import { doigte, meilleurCapo, notesMidi, svgDiagramme } from '../src/data/positions.ts';
import { diatoniques, type Tonalite } from '../src/data/theorie.ts';

const SOL: Tonalite = { tonique: 7, mode: 'maj' };
const SI: Tonalite = { tonique: 11, mode: 'maj' };
const pop = (t: Tonalite) => [0, 4, 5, 3].map((i) => diatoniques(t.mode)[i]!);

test('le doigté de Do est x32010 et sonne Do Mi Sol Do Mi', () => {
  const DO: Tonalite = { tonique: 0, mode: 'maj' };
  assert.deepEqual(doigte(DO, { rel: 0, q: 'maj' }), [-1, 3, 2, 0, 1, 0]);
  assert.deepEqual(notesMidi(DO, { rel: 0, q: 'maj' }), [48, 52, 55, 60, 64]);
});

test('chaque doigté joue bien les notes de son accord', () => {
  const INTERVALLES = { maj: [0, 4, 7], min: [0, 3, 7], dim: [0, 3, 6] };
  for (const q of ['maj', 'min', 'dim'] as const) {
    for (let semi = 0; semi < 12; semi++) {
      const t: Tonalite = { tonique: semi, mode: 'maj' };
      const classes = new Set(notesMidi(t, { rel: 0, q }).map((n) => n % 12));
      const attendues = new Set(INTERVALLES[q].map((i) => (semi + i) % 12));
      assert.deepEqual(classes, attendues, `${q} sur ${semi}`);
    }
  }
});

test('Sol majeur se joue sans capo, Si majeur avec un capo 4', () => {
  assert.deepEqual(meilleurCapo(SOL, pop(SOL)), {
    capo: 0,
    ouverts: 4,
    total: 4,
    formes: ['G', 'D', 'Em', 'C'],
  });
  assert.deepEqual(meilleurCapo(SI, pop(SI)), {
    capo: 4,
    ouverts: 4,
    total: 4,
    formes: ['G', 'D', 'Em', 'C'],
  });
  assert.equal(meilleurCapo(SOL, []), null);
});

test('le diagramme montre le sillet en bas de manche et un numéro plus haut', () => {
  assert.match(svgDiagramme(SOL, { rel: 0, q: 'maj' }), /<rect x="19" y="22"/);
  const cm = svgDiagramme({ tonique: 0, mode: 'min' }, { rel: 0, q: 'min' });
  assert.match(cm, /<text[^>]*>3<\/text>/);
  assert.match(cm, /rx="5"/);
});
