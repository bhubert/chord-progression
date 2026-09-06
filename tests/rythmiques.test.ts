import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  JETONS,
  RYTHMIQUES,
  RYTHMIQUE_DEFAUT,
  dureesCroches,
  rythmique,
} from '../src/data/rythmiques.ts';

test('chaque rythmique fait huit croches de jetons connus, avec un id unique', () => {
  const ids = new Set<string>();
  for (const r of RYTHMIQUES) {
    assert.equal(r.motif.length, 8, r.nom);
    for (const j of r.motif) assert.ok(JETONS.includes(j), `${r.nom} : jeton ${j}`);
    assert.notEqual(r.motif, '........', `${r.nom} : silencieuse`);
    assert.ok(!ids.has(r.id), `doublon : ${r.id}`);
    ids.add(r.id);
  }
  assert.ok(ids.has(RYTHMIQUE_DEFAUT));
});

test('une mesure dure quatre temps, swinguée ou non', () => {
  for (const r of RYTHMIQUES) {
    const total = dureesCroches(r).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(total - 4) < 1e-9, r.nom);
  }
  assert.deepEqual(dureesCroches(rythmique('folk')).slice(0, 2), [0.5, 0.5]);
  const [longue, courte] = dureesCroches(rythmique('shuffle'));
  assert.ok(longue! > courte!, 'le shuffle allonge la première croche');
});

test('un id inconnu retombe sur la rythmique par défaut', () => {
  assert.equal(rythmique('nimporte').id, RYTHMIQUE_DEFAUT);
});
