/**
 * Rendu HTML partagé entre le build et le navigateur.
 *
 * Les mêmes fonctions produisent la page au build (état par défaut : Sol
 * majeur et les quatre accords de la pop, pour que la page se voie avant tout
 * script) et la remettent à jour dans le navigateur à chaque changement. Une
 * seule source pour le balisage, donc aucune dérive entre les deux.
 *
 * Rien ici ne vient de l'utilisateur : ce sont nos tables, ou une adresse
 * déjà réduite à des entiers et des qualités par `lireAdresse`. Il n'y a donc
 * rien à échapper.
 */

import {
  SUFFIXE,
  chiffre,
  degreDe,
  diatoniques,
  nomAccord,
  nomFr,
  nomNote,
  nomTonalite,
  racine,
  uniques,
  type Accord,
  type Chiffrage,
  type Tonalite,
} from './theorie.ts';
import { meilleurCapo, svgDiagramme } from './positions.ts';
import { AMBIANCES, PROGRESSIONS, SUITES, type Ambiance } from './progressions.ts';
import { GAMMES, PREF } from './theorie.ts';
import { RYTHMIQUES, RYTHMIQUE_DEFAUT, rythmique as rythmiqueParId } from './rythmiques.ts';
import {
  FORMES,
  NOMS_FORMES,
  NOMS_PENTA,
  descriptionAncre,
  forme,
  lettreCaged,
  nomsPenta,
  placer,
  relativePenta,
  svgManche,
  type Lettre,
  type Penta,
  type Placement,
} from './caged.ts';

export type Filtre = Ambiance | 'toutes';

export interface Etat {
  tonalite: Tonalite;
  grille: Accord[];
  boucle: boolean;
  filtre: Filtre;
  /** Id d'une entrée de `RYTHMIQUES`. */
  rythmique: string;
  /** Casse des degrés : « I, vi » ou « I, VI ». */
  chiffrage: Chiffrage;
  /** Le manche : l'accord regardé (sinon le premier de la grille) et la forme posée (sinon les racines). */
  manche: { accord: Accord | null; forme: Lettre | null; penta: Penta | null };
}

export const MAX_MESURES = 16;
export const MESURES_PAR_LIGNE = 4;

/** Sol majeur, I–V–vi–IV : ce qu'on voit en arrivant. */
export const etatInitial = (): Etat => ({
  tonalite: { tonique: 7, mode: 'maj' },
  grille: PROGRESSIONS[0]!.pas.map(([rel, q]) => ({ rel, q })),
  boucle: true,
  filtre: 'toutes',
  rythmique: RYTHMIQUE_DEFAUT,
  chiffrage: 'casse',
  manche: { accord: null, forme: null, penta: null },
});

const majuscule = (s: string) => s[0]!.toUpperCase() + s.slice(1);

/** Symbole d'accord : racine grande, suffixe plus petit, couleur selon la qualité. */
export const htmlAccord = (t: Tonalite, a: Accord): string =>
  `<span class="accord ${a.q}"><span class="racine">${racine(t, a)}</span><span class="suffixe">${SUFFIXE[a.q]}</span></span>`;

const htmlPuce = (t: Tonalite, a: Accord, chiffrage: Chiffrage, petite = false): string =>
  `<button type="button" class="puce${petite ? ' petite' : ''}" data-rel="${a.rel}" data-q="${a.q}" aria-label="Ajouter ${nomAccord(t, a)}">${htmlAccord(t, a)}<span class="degre">${chiffre(a, t.mode, chiffrage)}</span></button>`;

/**
 * Les douze toniques du menu, épelées selon le mode (Réb en majeur, Do# en
 * mineur). Rendues par le gabarit Astro au build, puis par `htmlOptionsTonique`
 * dans le navigateur : le compilateur Astro ne sait pas poser `set:html` sur
 * un `<select>`.
 */
export const optionsTonique = (
  t: Tonalite,
): { valeur: number; libelle: string; choisie: boolean }[] =>
  Array.from({ length: 12 }, (_, s) => {
    const pref = PREF[t.mode][s]!;
    return {
      valeur: s,
      libelle: `${nomFr(s, pref)} (${nomNote(s, pref)})`,
      choisie: s === t.tonique,
    };
  });

export const htmlOptionsTonique = (t: Tonalite): string =>
  optionsTonique(t)
    .map((o) => `<option value="${o.valeur}"${o.choisie ? ' selected' : ''}>${o.libelle}</option>`)
    .join('');

export function htmlGrille({ tonalite: t, grille, chiffrage }: Etat): string {
  const cellules = grille.map(
    (a, i) =>
      `<button type="button" class="mesure" data-i="${i}" aria-label="Retirer ${nomAccord(t, a)}, mesure ${i + 1}">${htmlAccord(t, a)}<span class="degre">${chiffre(a, t.mode, chiffrage)}</span><span class="retirer" aria-hidden="true">×</span></button>`,
  );
  if (grille.length < MAX_MESURES) {
    const vide = grille.length === 0;
    cellules.push(
      `<button type="button" class="mesure mesure-ajout${vide ? ' vide' : ''}" id="ajout"><span class="plus">+</span><span>${
        vide
          ? 'La grille est vide. Choisissez une progression ci-dessous, ou ajoutez des accords un à un.'
          : 'accord'
      }</span></button>`,
    );
    // Mesures blanches pour finir la ligne, comme sur une grille papier.
    if (!vide) {
      for (let r = (grille.length + 1) % MESURES_PAR_LIGNE; r > 0 && r < MESURES_PAR_LIGNE; r++) {
        cellules.push('<div class="mesure blanche" aria-hidden="true"></div>');
      }
    }
  }
  return cellules.join('');
}

export const htmlTitreTonalite = (t: Tonalite): string => `Accords de ${nomTonalite(t)}`;

export const htmlDiatoniques = ({ tonalite: t, chiffrage }: Etat): string =>
  diatoniques(t.mode)
    .map((a) => htmlPuce(t, a, chiffrage))
    .join('');

/**
 * Les trois septièmes du blues, en majeur seulement : I7, IV7, V7, et le
 * bouton qui bascule toute la grille entre accords purs et septièmes.
 */
export function htmlBlues({ tonalite: t, grille, chiffrage }: Etat): string {
  if (t.mode !== 'maj') return '';
  const septiemes: Accord[] = [0, 5, 7].map((rel) => ({ rel, q: 'dom7' }));
  const enSeptiemes = grille.some((a) => a.q === 'dom7' && [0, 5, 7].includes(a.rel));
  const basculable = grille.some(
    (a) => [0, 5, 7].includes(a.rel) && (a.q === 'maj' || a.q === 'dom7'),
  );
  const bouton = basculable
    ? `<button type="button" class="btn btn-discret btn-petit" id="septiemes">${enSeptiemes ? 'Revenir aux accords purs' : 'Passer la grille en septièmes'}</button>`
    : '';
  return (
    '<span>Pour un blues, les trois septièmes :</span>' +
    septiemes.map((a) => htmlPuce(t, a, chiffrage, true)).join('') +
    bouton
  );
}

/** « Souvent après Do : Ré, Sol, Lam ». Vide quand la grille l'est. */
export function htmlApres({ tonalite: t, grille, chiffrage }: Etat): string {
  const dernier = grille[grille.length - 1];
  if (!dernier) return '';
  // Un accord hors gamme (une septième de blues, un emprunt) est rapproché du
  // degré qui porte la même fondamentale ; à défaut, on renvoie vers la tonique.
  const d = degreDe(dernier, t.mode);
  const degre = d >= 0 ? d : GAMMES[t.mode].deg.indexOf(dernier.rel);
  const dia = diatoniques(t.mode);
  const suivants = degre >= 0 ? SUITES[t.mode][degre]! : [0, 3, 4];
  return (
    `<span>Souvent après <b>${nomAccord(t, dernier)}</b> :</span>` +
    suivants.map((i) => htmlPuce(t, dia[i]!, chiffrage, true)).join('')
  );
}

export function htmlPositions({ tonalite: t, grille }: Etat): string {
  const accords = uniques(grille);
  if (!accords.length) {
    return '<p class="sous">Les positions des accords de la grille s’afficheront ici.</p>';
  }
  return accords
    .map((a) => {
      const lettre = lettreCaged(t, a);
      const badge = lettre
        ? `<span class="badge-caged" data-forme="${lettre}" title="${NOMS_FORMES[lettre]}">${lettre}</span>`
        : '';
      return `<figure class="diagramme ${a.q}">${badge}${svgDiagramme(t, a)}<figcaption class="nom ${a.q}">${nomAccord(t, a)}</figcaption></figure>`;
    })
    .join('');
}

export function htmlCapo({ tonalite: t, grille }: Etat): string {
  const capo = meilleurCapo(t, uniques(grille));
  if (!capo) return '';
  if (capo.capo === 0) {
    return capo.ouverts === capo.total
      ? '<b>Sans capo.</b> Tout se joue en position ouverte.'
      : `<b>Le capo n’y change rien.</b> Ces accords se jouent en barré, ou en position ouverte pour ${capo.ouverts} sur ${capo.total}.`;
  }
  const formes = capo.formes
    .map((f) => {
      const [, racine, suffixe] = /^(.+?)(m|°)?$/.exec(f)!;
      return `${racine}<span class="suffixe">${suffixe ?? ''}</span>`;
    })
    .join(' – ');
  return `<b>Capo ${capo.capo}</b>, et vous jouez les formes ouvertes (${capo.ouverts} accord${capo.ouverts > 1 ? 's' : ''} sur ${capo.total}) :<div class="formes">${formes}</div>`;
}

export const htmlFiltres = (filtre: Filtre): string =>
  (['toutes', ...AMBIANCES] as const)
    .map(
      (f) =>
        `<button type="button" class="filtre" data-filtre="${f}"${f === 'toutes' ? '' : ` data-ambiance="${f}"`} aria-pressed="${filtre === f}">${majuscule(f)}</button>`,
    )
    .join('');

export function htmlProgressions({ tonalite: t, filtre, chiffrage }: Etat): string {
  const visibles = PROGRESSIONS.filter((p) => filtre === 'toutes' || p.ambiances.includes(filtre));
  if (!visibles.length) {
    return '<p class="vide-liste">Aucune progression dans cette ambiance pour l’instant.</p>';
  }
  return visibles
    .map((p) => {
      const dansSonMode: Tonalite = { tonique: t.tonique, mode: p.mode };
      const accords: Accord[] = p.pas.map(([rel, q]) => ({ rel, q }));
      const etiquettes = [p.mode === 'maj' ? 'majeur' : 'mineur', ...p.ambiances]
        .map((e) => `<span class="etiquette" data-ambiance="${e}">${e}</span>`)
        .join('');
      return `<button type="button" class="progression" data-progression="${PROGRESSIONS.indexOf(p)}">
  <div><div class="degres">${accords.map((a) => chiffre(a, p.mode, chiffrage)).join(' – ')}</div>
    <div class="noms">${accords.map((a) => nomAccord(dansSonMode, a)).join(' – ')}</div></div>
  <div><div class="titre">${p.nom}</div><div class="titres">${p.titres.join(', ')}</div>
    <div class="etiquettes">${etiquettes}</div></div>
</button>`;
    })
    .join('');
}

export const optionsRythmique = (
  etat: Etat,
): { valeur: string; libelle: string; choisie: boolean }[] =>
  RYTHMIQUES.map((r) => ({ valeur: r.id, libelle: r.nom, choisie: r.id === etat.rythmique }));

export const htmlOptionsRythmique = (etat: Etat): string =>
  optionsRythmique(etat)
    .map((o) => `<option value="${o.valeur}"${o.choisie ? ' selected' : ''}>${o.libelle}</option>`)
    .join('');

const AFFICHAGE_JETON: Record<string, string> = {
  '.': '·',
  B: '↓',
  b: '<span class="doux">↓</span>',
  H: '↑',
  p: 'p',
  i: 'i',
  m: 'm',
  a: 'a',
};

/** Le motif en flèches : ↓ · ↓ ↑ · ↑ ↓ ↑ */
export const htmlMotif = (id: string): string =>
  [...rythmiqueParId(id).motif].map((j) => AFFICHAGE_JETON[j] ?? j).join(' ');

// ── Le manche ──────────────────────────────────────────────────────────────

/** L'accord regardé sur le manche : celui choisi s'il est encore dans la grille, sinon le premier, sinon la tonique. */
export function accordManche(etat: Etat): Accord {
  const candidats = uniques(etat.grille);
  const choisi = etat.manche.accord;
  if (choisi && candidats.some((a) => a.rel === choisi.rel && a.q === choisi.q)) return choisi;
  return candidats[0] ?? { rel: 0, q: etat.tonalite.mode === 'maj' ? 'maj' : 'min' };
}

/** La forme posée, si elle existe pour cet accord. */
export function placementManche(etat: Etat): Placement | null {
  const a = accordManche(etat);
  const f = etat.manche.forme ? forme(a.q, etat.manche.forme) : null;
  return f ? placer(etat.tonalite, a, f) : null;
}

export function htmlManche(etat: Etat): string {
  const t = etat.tonalite;
  const a = accordManche(etat);
  const p = placementManche(etat);
  const choix = uniques(etat.grille)
    .map(
      (c) =>
        `<button type="button" class="choix" data-manche-rel="${c.rel}" data-manche-q="${c.q}" aria-pressed="${c.rel === a.rel && c.q === a.q}">${htmlAccord(t, c)}</button>`,
    )
    .join('');
  const formes = FORMES[a.q]
    .map((f) => {
      const pl = placer(t, a, f);
      return `<button type="button" class="forme" data-forme="${f.lettre}" aria-pressed="${p?.forme.lettre === f.lettre}"><span class="lettre">${f.lettre}</span><span class="ou">${NOMS_FORMES[f.lettre]}<br>${descriptionAncre(pl)}</span></button>`;
    })
    .join('');
  const toutes = `<button type="button" class="forme" data-forme="racines" aria-pressed="${p === null}"><span class="lettre">●</span><span class="ou">Toutes les racines<br>de ${nomAccord(t, a)} sur le manche</span></button>`;
  const penta = etat.manche.penta;
  const reglagePenta = `<div class="reglage penta-reglage">Pentatonique<div class="segments" role="group" aria-label="Pentatonique">${(
    [
      [null, 'Sans'],
      ['maj', 'Majeure'],
      ['min', 'Mineure'],
    ] as const
  )
    .map(
      ([v, libelle]) =>
        `<button type="button" data-penta="${v ?? 'non'}" aria-pressed="${penta === v}">${libelle}</button>`,
    )
    .join('')}</div></div>`;
  let phrase: string;
  if (p) {
    phrase = `<b>${NOMS_FORMES[p.forme.lettre][0]!.toUpperCase()}${NOMS_FORMES[p.forme.lettre].slice(1)} pour ${nomAccord(t, a)}</b> : posez la première racine sur la ${descriptionAncre(p)}, le reste de la forme suit. Sur le manche, l’anneau la marque, et les points dorés sont les autres racines.`;
  } else if (a.q === 'dim') {
    phrase = `Pas de forme CAGED pour un accord diminué : voici les racines de <b>${nomAccord(t, a)}</b>, c’est déjà ce qu’il faut pour le trouver.`;
  } else {
    phrase = `Les racines de <b>${nomAccord(t, a)}</b> sur tout le manche. Choisissez une forme pour voir où la poser${a.q === 'min' ? '. En mineur, trois formes suffisent : Mi, La et Ré' : ''}.`;
  }
  if (penta) {
    const relative = relativePenta(t, a, penta);
    phrase += ` <b>Pentatonique ${NOMS_PENTA[penta]} de ${racine(t, a)}</b> : ${nomsPenta(t, a, penta).join(', ')}. Ce sont les mêmes notes que la pentatonique ${NOMS_PENTA[relative.penta]} de ${relative.nom}.${p ? ' Ici, seulement la boîte de la forme : deux notes par corde.' : ''}`;
  }
  return `<div class="manche-choix"><div class="choix-groupe" role="group" aria-label="Accord regardé">${choix}</div>${reglagePenta}</div>
<div class="manche-defile">${svgManche(t, a, p, penta)}</div>
<div class="formes" role="group" aria-label="Forme">${toutes}${formes}</div>
<p class="manche-phrase">${phrase}</p>`;
}
