/**
 * Le site côté navigateur : état, rendu, écoute, adresse.
 *
 * ── Ce qu'il faut savoir avant d'y toucher ────────────────────────────────
 *
 * **L'adresse est la source de vérité de la grille.** Chaque changement
 * réécrit `#sol-majeur/I-V-vi-IV` (`history.replaceState`, pas d'entrée
 * d'historique par accord), et un chargement lit l'adresse avant tout rendu.
 * Copier le lien, c'est copier la grille.
 *
 * **Le balisage vient de `src/data/rendu.ts`**, le même qu'au build. Ce
 * fichier ne fabrique pas de HTML : il choisit quoi rafraîchir et quand.
 *
 * **Le son est synthétisé, pas échantillonné.** Web Audio, un oscillateur
 * triangle et un peu de dent de scie par corde, filtre passe-bas qui se ferme,
 * six cordes décalées de 24 ms pour le battement. Zéro téléchargement, et
 * l'`AudioContext` n'est créé qu'au premier clic sur « Écouter » : les
 * navigateurs refusent de le démarrer avant un geste.
 */

import { adresse, lireAdresse, nomTonalite, transposerMode, type Mode } from '../data/theorie.ts';
import { notesMidi } from '../data/positions.ts';
import { PROGRESSIONS } from '../data/progressions.ts';
import {
  MAX_MESURES,
  etatInitial,
  htmlApres,
  htmlCapo,
  htmlDiatoniques,
  htmlFiltres,
  htmlGrille,
  htmlOptionsTonique,
  htmlPositions,
  htmlProgressions,
  htmlTitreTonalite,
  type Etat,
  type Filtre,
} from '../data/rendu.ts';

const etat: Etat = etatInitial();
let tempo = 92;

function $<T extends HTMLElement>(selecteur: string): T {
  const el = document.querySelector<T>(selecteur);
  if (!el) throw new Error(`Élément introuvable : ${selecteur}`);
  return el;
}

// ── Rendu ──────────────────────────────────────────────────────────────────

function rendreEntete(): void {
  $('#tonique').innerHTML = htmlOptionsTonique(etat.tonalite);
  document
    .querySelectorAll<HTMLButtonElement>('[data-mode]')
    .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === etat.tonalite.mode)));
  $('#titre-tonalite').textContent = htmlTitreTonalite(etat.tonalite);
}

function rendreGrille(): void {
  $('#grille').innerHTML = htmlGrille(etat);
  $('#cadre').classList.toggle('boucle', etat.boucle);
  $('#boucle').setAttribute('aria-pressed', String(etat.boucle));
}

function rendreTonalite(): void {
  $('#diatoniques').innerHTML = htmlDiatoniques(etat.tonalite);
  $('#apres').innerHTML = htmlApres(etat);
}

function rendrePositions(): void {
  $('#diagrammes').innerHTML = htmlPositions(etat);
  const capo = $('#capo');
  capo.innerHTML = htmlCapo(etat);
  capo.hidden = capo.innerHTML === '';
}

function rendreProgressions(): void {
  $('#filtres').innerHTML = htmlFiltres(etat.filtre);
  $('#progressions').innerHTML = htmlProgressions(etat);
}

function ecrireAdresse(): void {
  const h = adresse(etat.tonalite, etat.grille);
  if (location.hash !== h) history.replaceState(null, '', h);
}

/** Après un changement de grille seule : la tonalité n'a pas bougé. */
function rendreGrilleEtSuite(): void {
  rendreGrille();
  rendreTonalite();
  rendrePositions();
  ecrireAdresse();
  lecteur.reprendreSiLecture();
}

/** Après un changement de tonalité ou de mode : tout dépend d'elle. */
function toutRendre(): void {
  rendreEntete();
  rendreGrille();
  rendreTonalite();
  rendrePositions();
  rendreProgressions();
  ecrireAdresse();
  lecteur.reprendreSiLecture();
}

// ── Son ────────────────────────────────────────────────────────────────────

const ICONE_LECTURE =
  '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 1.5v9l8-4.5z" fill="currentColor"/></svg><span>Écouter</span>';
const ICONE_ARRET =
  '<svg viewBox="0 0 12 12" aria-hidden="true"><rect x="1.5" y="1.5" width="9" height="9" fill="currentColor"/></svg><span>Arrêter</span>';

const frequence = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

class Lecteur {
  private ctx: AudioContext | null = null;
  private sortie: GainNode | null = null;
  private minuteurs: number[] = [];
  enLecture = false;

  private pincer(f: number, t: number, velocite: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const o2 = ctx.createOscillator();
    o2.type = 'sawtooth';
    o2.frequency.value = f;
    o2.detune.value = 4;
    const g2 = ctx.createGain();
    g2.gain.value = 0.16;
    const filtre = ctx.createBiquadFilter();
    filtre.type = 'lowpass';
    filtre.Q.value = 0.8;
    filtre.frequency.setValueAtTime(900 + 2400 * velocite, t);
    filtre.frequency.exponentialRampToValueAtTime(420, t + 1.3);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.17 * velocite, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.7);
    o.connect(filtre);
    o2.connect(g2);
    g2.connect(filtre);
    filtre.connect(g);
    g.connect(this.sortie!);
    o.start(t);
    o2.start(t);
    o.stop(t + 1.8);
    o2.stop(t + 1.8);
  }

  /** Un battement : vers le bas sur les six cordes, vers le haut sur les quatre aiguës. */
  private battre(notes: number[], t: number, velocite: number, vers: 'bas' | 'haut'): void {
    const cordes = vers === 'haut' ? notes.slice(-4).reverse() : notes;
    cordes.forEach((n, i) => this.pincer(frequence(n), t + i * 0.024, velocite));
  }

  /** Programme un tour complet de la grille, puis se rappelle si la boucle est active. */
  private passe(): void {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + 0.06;
    const temps = 60 / tempo;
    const dans = (t: number) => Math.max(0, (t - ctx.currentTime) * 1000);
    etat.grille.forEach((a, i) => {
      const notes = notesMidi(etat.tonalite, a);
      const tb = t0 + i * 4 * temps;
      this.battre(notes, tb, 1, 'bas');
      this.battre(notes, tb + temps, 0.55, 'haut');
      this.battre(notes, tb + 2 * temps, 0.85, 'bas');
      this.battre(notes, tb + 2.5 * temps, 0.45, 'haut');
      this.battre(notes, tb + 3 * temps, 0.6, 'haut');
      this.minuteurs.push(
        window.setTimeout(() => {
          document.querySelectorAll('.mesure.joue').forEach((m) => m.classList.remove('joue'));
          document.querySelector(`.mesure[data-i="${i}"]`)?.classList.add('joue');
        }, dans(tb)),
      );
    });
    const fin = t0 + etat.grille.length * 4 * temps;
    this.minuteurs.push(
      window.setTimeout(() => {
        if (etat.boucle && this.enLecture) this.passe();
        else this.arreter();
      }, dans(fin)),
    );
  }

  jouer(): void {
    if (!etat.grille.length) {
      toast('Ajoutez d’abord un accord à la grille.');
      return;
    }
    if (!this.ctx) {
      this.ctx = new AudioContext();
      const compresseur = this.ctx.createDynamicsCompressor();
      compresseur.threshold.value = -18;
      compresseur.ratio.value = 4;
      this.sortie = this.ctx.createGain();
      this.sortie.gain.value = 0.7;
      this.sortie.connect(compresseur);
      compresseur.connect(this.ctx.destination);
    }
    void this.ctx.resume();
    this.enLecture = true;
    $('#jouer').innerHTML = ICONE_ARRET;
    this.passe();
  }

  arreter(): void {
    this.enLecture = false;
    this.minuteurs.forEach(clearTimeout);
    this.minuteurs = [];
    document.querySelectorAll('.mesure.joue').forEach((m) => m.classList.remove('joue'));
    $('#jouer').innerHTML = ICONE_LECTURE;
  }

  /** La grille a changé pendant la lecture : on repart du début, sur la nouvelle. */
  reprendreSiLecture(): void {
    if (!this.enLecture) return;
    this.arreter();
    if (etat.grille.length) this.jouer();
  }
}

const lecteur = new Lecteur();

// ── Interactions ───────────────────────────────────────────────────────────

let minuteurToast = 0;
function toast(message: string): void {
  const t = $('#toast');
  t.textContent = message;
  t.classList.add('visible');
  clearTimeout(minuteurToast);
  minuteurToast = window.setTimeout(() => t.classList.remove('visible'), 2200);
}

function ajouter(rel: number, q: Etat['grille'][number]['q']): void {
  if (etat.grille.length >= MAX_MESURES) {
    toast('Seize mesures, c’est déjà une belle grille.');
    return;
  }
  etat.grille.push({ rel, q });
  rendreGrilleEtSuite();
}

function changerMode(mode: Mode): void {
  if (mode === etat.tonalite.mode) return;
  etat.grille = transposerMode(etat.grille, etat.tonalite.mode, mode);
  etat.tonalite = { ...etat.tonalite, mode };
  toutRendre();
}

function chargerProgression(index: number): void {
  const p = PROGRESSIONS[index];
  if (!p) return;
  etat.tonalite = { ...etat.tonalite, mode: p.mode };
  etat.grille = p.pas.map(([rel, q]) => ({ rel, q }));
  toutRendre();
  toast(`${p.nom} chargée en ${nomTonalite(etat.tonalite)}.`);
  const doux = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  $('#titre-grille').scrollIntoView({ behavior: doux ? 'smooth' : 'auto', block: 'start' });
}

$<HTMLSelectElement>('#tonique').addEventListener('change', (e) => {
  etat.tonalite = { ...etat.tonalite, tonique: Number((e.target as HTMLSelectElement).value) };
  toutRendre();
});

document
  .querySelectorAll<HTMLButtonElement>('[data-mode]')
  .forEach((b) => b.addEventListener('click', () => changerMode(b.dataset.mode as Mode)));

$('#grille').addEventListener('click', (e) => {
  const mesure = (e.target as HTMLElement).closest<HTMLElement>('.mesure');
  if (!mesure || mesure.classList.contains('blanche')) return;
  if (mesure.id === 'ajout') {
    document.querySelector<HTMLButtonElement>('#diatoniques .puce')?.focus();
    return;
  }
  etat.grille.splice(Number(mesure.dataset.i), 1);
  rendreGrilleEtSuite();
});

document.addEventListener('click', (e) => {
  const cible = e.target as HTMLElement;
  const puce = cible.closest<HTMLElement>('.puce');
  if (puce) ajouter(Number(puce.dataset.rel), puce.dataset.q as Etat['grille'][number]['q']);
  const filtre = cible.closest<HTMLElement>('.filtre');
  if (filtre) {
    etat.filtre = filtre.dataset.filtre as Filtre;
    rendreProgressions();
  }
  const progression = cible.closest<HTMLElement>('.progression');
  if (progression) chargerProgression(Number(progression.dataset.progression));
});

$('#jouer').addEventListener('click', () =>
  lecteur.enLecture ? lecteur.arreter() : lecteur.jouer(),
);

$('#boucle').addEventListener('click', () => {
  etat.boucle = !etat.boucle;
  rendreGrille();
});

const curseurTempo = $<HTMLInputElement>('#tempo');
curseurTempo.addEventListener('input', () => {
  tempo = Number(curseurTempo.value);
  $<HTMLOutputElement>('#tempo-valeur').value = String(tempo);
});
curseurTempo.addEventListener('change', () => lecteur.reprendreSiLecture());

$('#vider').addEventListener('click', () => {
  lecteur.arreter();
  etat.grille = [];
  rendreGrilleEtSuite();
});

$('#partager').addEventListener('click', async () => {
  ecrireAdresse();
  try {
    await navigator.clipboard.writeText(location.href);
    toast('Lien copié. Il décrit la grille telle quelle.');
  } catch {
    toast('Le lien est dans la barre d’adresse.');
  }
});

// ── Départ ─────────────────────────────────────────────────────────────────

const depuisAdresse = lireAdresse(location.hash);
if (depuisAdresse) {
  etat.tonalite = depuisAdresse.tonalite;
  etat.grille = depuisAdresse.grille.slice(0, MAX_MESURES);
}
// La page est déjà rendue au build dans l'état par défaut ; on ne la
// reconstruit que si l'adresse en demande un autre. Sinon, seuls les états
// dynamiques (boucle, adresse) sont posés.
if (depuisAdresse) toutRendre();
else {
  $('#cadre').classList.add('boucle');
  ecrireAdresse();
}
