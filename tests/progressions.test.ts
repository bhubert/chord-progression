import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AMBIANCES, PROGRESSIONS, SUITES } from '../src/data/progressions.ts';

test('chaque progression a des pas valides, une ambiance connue et un titre', () => {
  const noms = new Set<string>();
  for (const p of PROGRESSIONS) {
    assert.ok(p.pas.length >= 2 && p.pas.length <= 16, p.nom);
    for (const [rel, q] of p.pas) {
      assert.ok(Number.isInteger(rel) && rel >= 0 && rel < 12, `${p.nom} : intervalle ${rel}`);
      assert.ok(['maj', 'min', 'dim'].includes(q), `${p.nom} : qualité ${q}`);
    }
    assert.ok(p.ambiances.length >= 1, p.nom);
    for (const a of p.ambiances) assert.ok(AMBIANCES.includes(a), `${p.nom} : ambiance ${a}`);
    assert.ok(p.titres.length >= 1, p.nom);
    assert.ok(!noms.has(p.nom), `doublon : ${p.nom}`);
    noms.add(p.nom);
  }
});

test('chaque ambiance a au moins une progression', () => {
  for (const a of AMBIANCES) {
    assert.ok(
      PROGRESSIONS.some((p) => p.ambiances.includes(a)),
      `aucune progression pour « ${a} »`,
    );
  }
});

test('les enchaînements couvrent les sept degrés et ne renvoient jamais sur eux-mêmes', () => {
  for (const mode of ['maj', 'min'] as const) {
    assert.equal(SUITES[mode].length, 7);
    SUITES[mode].forEach((suivants, degre) => {
      assert.ok(suivants.length >= 2, `${mode} ${degre}`);
      for (const s of suivants) {
        assert.ok(s >= 0 && s < 7 && s !== degre, `${mode} ${degre} → ${s}`);
      }
    });
  }
});
