import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FORMES,
  FRETTES_MANCHE,
  boitePenta,
  boitesParNote,
  descriptionAncre,
  forme,
  lettreCaged,
  nomsPenta,
  notesPenta,
  notesPlacement,
  placementsToutes,
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
  assert.doesNotMatch(sans, /r="13.5"/);
  const avec = svgManche(
    SOL,
    { rel: 0, q: 'maj' },
    placer(SOL, { rel: 0, q: 'maj' }, forme('maj', 'E')!),
  );
  assert.match(avec, /r="13.5"/);
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

test('avec une forme, la pentatonique se limite à sa boîte : deux notes par corde, autour de la forme', () => {
  for (const q of ['maj', 'min', 'dom7'] as const) {
    for (const f of FORMES[q]) {
      for (let semi = 0; semi < 12; semi++) {
        for (const penta of ['maj', 'min'] as const) {
          const t: Tonalite = { tonique: semi, mode: 'maj' };
          const p = placer(t, { rel: 0, q }, f);
          const posees = p.frettes.filter((x): x is number => x !== null);
          const bas = Math.min(...posees);
          const haut = Math.max(...posees);
          const boite = boitePenta(t, { rel: 0, q }, penta, p);
          assert.equal(boite.length, 12, `${q} ${f.lettre} sur ${semi}, penta ${penta}`);
          for (let corde = 0; corde < 6; corde++) {
            const notes = boite.filter(([c]) => c === corde);
            assert.equal(notes.length, 2, `${q} ${f.lettre} sur ${semi} : corde ${corde}`);
            for (const [, frette] of notes) {
              assert.ok(
                frette >= bas - 3 && frette <= haut + 3,
                `${q} ${f.lettre} sur ${semi} : case ${frette} loin de ${bas}-${haut}`,
              );
            }
          }
        }
      }
    }
  }
  // Les deux boîtes d'école, forme de Mi en Sol : majeure cases 2 à 5, mineure cases 3 à 6.
  const E = placer(SOL, { rel: 0, q: 'maj' }, forme('maj', 'E')!);
  const cases = (penta: 'maj' | 'min') =>
    boitePenta(SOL, { rel: 0, q: 'maj' }, penta, E).map(([c, f]) => [c, f]);
  assert.deepEqual(cases('maj'), [
    [0, 3],
    [0, 5],
    [1, 2],
    [1, 5],
    [2, 2],
    [2, 5],
    [3, 2],
    [3, 4],
    [4, 3],
    [4, 5],
    [5, 3],
    [5, 5],
  ]);
  assert.deepEqual(cases('min'), [
    [0, 3],
    [0, 6],
    [1, 3],
    [1, 5],
    [2, 3],
    [2, 5],
    [3, 3],
    [3, 5],
    [4, 3],
    [4, 6],
    [5, 3],
    [5, 6],
  ]);
  // Sans forme, toute la gamme ; avec, douze notes seulement.
  const avecForme = svgManche(SOL, { rel: 0, q: 'maj' }, E, 'maj');
  const sansForme = svgManche(SOL, { rel: 0, q: 'maj' }, null, 'maj');
  const noms = (svg: string) => (svg.match(/font-size="9"[^>]*>[A-G][#b]?<\/text>/g) ?? []).length;
  assert.ok(
    noms(sansForme) > 30 && noms(avecForme) === 12,
    `${noms(sansForme)} / ${noms(avecForme)}`,
  );
});

test('un doigté de référence connaît sa forme CAGED', () => {
  const DO: Tonalite = { tonique: 0, mode: 'maj' };
  const lettre = (tonique: number, q: 'maj' | 'min' | 'dom7' | 'dim') =>
    lettreCaged({ tonique, mode: 'maj' }, { rel: 0, q });
  assert.equal(lettre(0, 'maj'), 'C', 'Do ouvert');
  assert.equal(lettre(9, 'maj'), 'A', 'La ouvert');
  assert.equal(lettre(7, 'maj'), 'G', 'Sol ouvert');
  assert.equal(lettre(4, 'maj'), 'E', 'Mi ouvert');
  assert.equal(lettre(2, 'maj'), 'D', 'Ré ouvert');
  assert.equal(lettre(5, 'maj'), 'E', 'le barré de Fa est la forme de Mi');
  assert.equal(lettre(10, 'maj'), 'A', 'Sib est la forme de La');
  assert.equal(lettre(9, 'min'), 'A', 'Lam');
  assert.equal(lettre(0, 'min'), 'A', 'Dom barré');
  assert.equal(lettre(11, 'dom7'), null, 'Si7 ouvert n’est aucune forme telle quelle');
  assert.equal(lettre(11, 'dim'), null);
  assert.equal(lettreCaged(DO, { rel: 0, q: 'maj' }), 'C');
});

test('les points d’une forme disent ce qu’ils jouent : R, 3, 5, et b3 ou b7 selon la qualité', () => {
  // Les fondamentales sont des R en couleur sur point évidé, les autres des chiffres en blanc cerné.
  const etiquettes = (svg: string) =>
    [...svg.matchAll(/font-weight="700"[^>]*text-anchor="middle">(R|b?\d)</g)].map((m) => m[1]);
  const E = placer(SOL, { rel: 0, q: 'maj' }, forme('maj', 'E')!);
  assert.deepEqual(etiquettes(svgManche(SOL, { rel: 0, q: 'maj' }, E)), [
    'R',
    '5',
    'R',
    '3',
    '5',
    'R',
  ]);
  const Em = placer(SOL, { rel: 9, q: 'min' }, forme('min', 'E')!);
  assert.deepEqual(etiquettes(svgManche(SOL, { rel: 9, q: 'min' }, Em)), [
    'R',
    '5',
    'R',
    'b3',
    '5',
    'R',
  ]);
  const D7 = placer(SOL, { rel: 7, q: 'dom7' }, forme('dom7', 'D')!);
  assert.deepEqual(etiquettes(svgManche(SOL, { rel: 7, q: 'dom7' }, D7)), ['R', '5', 'b7', '3']);
  assert.deepEqual(etiquettes(svgManche(SOL, { rel: 0, q: 'maj' }, null)), []);
});

test('sur tout le manche, chaque note sait à quelles boîtes elle appartient, deux aux angles', () => {
  const DO: Tonalite = { tonique: 0, mode: 'maj' };
  const boites = boitesParNote(DO, { rel: 0, q: 'maj' }, 'maj');
  assert.deepEqual(boites.get('1:0'), ['C'], 'La à vide : la boîte de Do seule');
  assert.deepEqual(boites.get('1:3'), ['C', 'A'], 'Do case 3, corde de La : Do et La');
  assert.deepEqual(boites.get('0:8'), ['G', 'E'], 'Do case 8, Mi grave : Sol et Mi');
  assert.deepEqual(boites.get('2:10'), ['E', 'D'], 'Do case 10, corde de Ré : Mi et Ré');
  assert.deepEqual(boites.get('1:15'), ['C', 'A'], 'Do case 15 : les boîtes une octave plus haut');
  // Aucune note de la gamme n'est orpheline en majeur : les cinq boîtes couvrent le manche.
  for (const [corde, f] of notesPenta(DO, { rel: 0, q: 'maj' }, 'maj')) {
    assert.ok(boites.has(`${corde}:${f}`), `note orpheline corde ${corde} case ${f}`);
  }
  // Le dessin sans forme porte des demi-disques ; avec une forme, non.
  const sans = svgManche(DO, { rel: 0, q: 'maj' }, null, 'maj');
  assert.match(sans, /A8 8 0 0 0/);
  const avec = svgManche(
    DO,
    { rel: 0, q: 'maj' },
    placer(DO, { rel: 0, q: 'maj' }, forme('maj', 'E')!),
    'maj',
  );
  assert.doesNotMatch(avec, /A8 8 0 0 0/);
});

test('la carte des formes : cinq en Do, plus celle de Do une octave plus haut, tracées et zonées', () => {
  const DO: Tonalite = { tonique: 0, mode: 'maj' };
  const carte = placementsToutes(DO, { rel: 0, q: 'maj' });
  assert.deepEqual(
    carte.map((p) => `${p.forme.lettre}${p.ancreFrette}`),
    ['C3', 'A3', 'G8', 'E8', 'D10', 'C15'],
  );
  const svg = svgManche(DO, { rel: 0, q: 'maj' }, null, 'maj', carte);
  // Un segment par paire de cordes jouées : 4 + 4 + 5 + 5 + 3 + 4.
  assert.equal((svg.match(/<line [^>]*stroke="var\(--caged-/g) ?? []).length, 25, 'les traits');
  assert.equal((svg.match(/opacity="0.13"/g) ?? []).length, 6, 'une zone par forme');
  // Avec la pentatonique, ses notes nommées sont dessinées sous les formes ; sans, non.
  const noms = (x: string) => (x.match(/font-size="9"[^>]*>[A-G][#b]?<\/text>/g) ?? []).length;
  assert.ok(noms(svg) > 30, 'la gamme sous la carte');
  assert.equal(noms(svgManche(DO, { rel: 0, q: 'maj' }, null, null, carte)), 0);
  // Une forme seule est tracée aussi, et sa fondamentale est un point évidé marqué R.
  const seule = svgManche(
    DO,
    { rel: 0, q: 'maj' },
    placer(DO, { rel: 0, q: 'maj' }, forme('maj', 'C')!),
  );
  assert.equal((seule.match(/<line [^>]*stroke="var\(--caged-c\)"/g) ?? []).length, 4);
  assert.match(seule, /fill="var\(--bois-2\)" stroke="var\(--caged-c\)"/);
  // Trois formes en mineur.
  assert.equal(placementsToutes(DO, { rel: 9, q: 'min' }).length >= 3, true);
});

test('en Sol, la forme de Ré reste visible sous celle de Do : demi-disques et pointillés', () => {
  const carte = placementsToutes(SOL, { rel: 0, q: 'maj' });
  const svg = svgManche(SOL, { rel: 0, q: 'maj' }, null, null, carte);
  // Do en case 10 et Ré en case 5 partagent trois notes : Sol case 7, Si case 8, Mi aigu case 7.
  assert.ok((svg.match(/A8 8 0 0 0/g) ?? []).length >= 3, 'demi-disques');
  assert.ok((svg.match(/stroke-dasharray/g) ?? []).length >= 2, 'segments partagés en pointillés');
  // La forme de Ré a bien ses quatre notes, et le point partagé porte les deux couleurs.
  assert.match(svg, /fill="var\(--caged-d\)"\/><path d="[^"]+" fill="var\(--caged-c\)"/);
});
