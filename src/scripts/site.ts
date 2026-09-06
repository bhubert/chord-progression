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
 * cordes décalées de 24 ms pour le battement. Zéro téléchargement, et
 * l'`AudioContext` n'est créé qu'au premier clic sur « Écouter » : les
 * navigateurs refusent de le démarrer avant un geste.
 *
 * **Le séquenceur ne programme que 120 ms d'avance.** Un `setTimeout` toutes
 * les 40 ms regarde l'horloge audio et pose les prochaines croches, jamais
 * plus. C'est ce qui rend tout immédiat : le tempo, la rythmique, la tonalité
 * et la grille sont relus à chaque croche, et « Arrêter » ferme la sortie en
 * 30 ms au lieu d'attendre la fin d'un tour programmé d'avance. Le tour entier
 * programmé d'un coup, c'est ce qui faisait se mélanger les sons quand on
 * touchait au tempo en cours de lecture.
 */

import {
  adresse,
  basculerSeptiemes,
  lireAdresse,
  nomTonalite,
  transposerMode,
  type Chiffrage,
  type Mode,
  type Qualite,
} from '../data/theorie.ts';
import { notesMidi } from '../data/positions.ts';
import { PROGRESSIONS } from '../data/progressions.ts';
import { dureesCroches, rythmique as rythmiqueParId } from '../data/rythmiques.ts';
import { notesPlacement, type Lettre, type Penta } from '../data/caged.ts';
import {
  MAX_MESURES,
  etatInitial,
  htmlApres,
  htmlBlues,
  htmlCapo,
  htmlDiatoniques,
  htmlFiltres,
  htmlGrille,
  htmlManche,
  htmlMotif,
  htmlOptionsRythmique,
  htmlOptionsTonique,
  htmlPositions,
  htmlProgressions,
  htmlTitreTonalite,
  placementManche,
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
  lecteur.surligner();
}

function rendreTonalite(): void {
  $('#diatoniques').innerHTML = htmlDiatoniques(etat);
  $('#blues').innerHTML = htmlBlues(etat);
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

function rendreManche(): void {
  $('#manche').innerHTML = htmlManche(etat);
}

function rendreRythmique(): void {
  $('#rythmique').innerHTML = htmlOptionsRythmique(etat);
  $('#motif').innerHTML = htmlMotif(etat.rythmique);
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
  rendreManche();
  ecrireAdresse();
}

/** Après un changement de tonalité ou de mode : tout dépend d'elle. */
function toutRendre(): void {
  rendreEntete();
  rendreGrille();
  rendreTonalite();
  rendrePositions();
  rendreManche();
  rendreProgressions();
  rendreRythmique();
  ecrireAdresse();
}

// ── Son ────────────────────────────────────────────────────────────────────

const ICONE_LECTURE =
  '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 1.5v9l8-4.5z" fill="currentColor"/></svg><span>Écouter</span>';
const ICONE_ARRET =
  '<svg viewBox="0 0 12 12" aria-hidden="true"><rect x="1.5" y="1.5" width="9" height="9" fill="currentColor"/></svg><span>Arrêter</span>';

const frequence = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

/** Corde visée par un jeton d'arpège, comptée depuis la plus aiguë. */
const DEPUIS_AIGU: Record<string, number> = { a: 0, m: 1, i: 2 };

class Lecteur {
  /** Secondes de musique programmées d'avance. Assez pour ne jamais manquer une croche, assez peu pour que tout changement s'entende de suite. */
  private static readonly AVANCE = 0.12;
  /** Millisecondes entre deux passages du séquenceur. */
  private static readonly INTERVALLE = 40;

  private ctx: AudioContext | null = null;
  /** Sortie générale, derrière le compresseur. */
  private sortie: GainNode | null = null;
  /** La lecture en cours. Tout ce qui est programmé passe par là, et c'est là qu'on coupe. */
  private voix: GainNode | null = null;
  private minuteur = 0;
  private surlignages: number[] = [];
  /** Croche courante, de 0 à 8 × mesures. */
  private position = 0;
  /** Instant audio de la croche courante. */
  private prochainTemps = 0;
  mesureCourante = -1;
  enLecture = false;

  private pincer(f: number, t: number, velocite: number, destination: AudioNode): void {
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
    g.connect(destination);
    o.start(t);
    o2.start(t);
    o.stop(t + 1.8);
    o2.stop(t + 1.8);
  }

  /** Un battement : vers le bas sur toutes les cordes, vers le haut sur les quatre aiguës. */
  private battre(
    notes: number[],
    t: number,
    velocite: number,
    vers: 'bas' | 'haut',
    destination: AudioNode = this.voix!,
  ): void {
    const cordes = vers === 'haut' ? notes.slice(-4).reverse() : notes;
    cordes.forEach((n, i) => this.pincer(frequence(n), t + i * 0.024, velocite, destination));
  }

  /** Crée le contexte audio au premier geste, jamais avant : les navigateurs l'exigent. */
  private preparer(): AudioContext {
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
    return this.ctx;
  }

  /** Un seul battement, pour entendre une forme posée sur le manche. Ne dérange pas une lecture en cours. */
  essayer(notes: number[]): void {
    const ctx = this.preparer();
    const voix = ctx.createGain();
    voix.connect(this.sortie!);
    this.battre(notes, ctx.currentTime + 0.02, 0.9, 'bas', voix);
    window.setTimeout(() => voix.disconnect(), 2500);
  }

  private dans(t: number): number {
    return Math.max(0, (t - this.ctx!.currentTime) * 1000);
  }

  /** Pose la croche courante à l'instant `t`, selon la rythmique du moment. */
  private programmer(t: number): void {
    const mesure = Math.floor(this.position / 8);
    const croche = this.position % 8;
    const accord = etat.grille[mesure];
    if (!accord) return;
    const notes = notesMidi(etat.tonalite, accord);
    const jeton = rythmiqueParId(etat.rythmique).motif[croche]!;
    if (jeton === 'B') this.battre(notes, t, 1, 'bas');
    else if (jeton === 'b') this.battre(notes, t, 0.6, 'bas');
    else if (jeton === 'H') this.battre(notes, t, 0.5, 'haut');
    else if (jeton === 'p') this.pincer(frequence(notes[0]!), t, 0.9, this.voix!);
    else if (jeton in DEPUIS_AIGU) {
      const n = notes[Math.max(0, notes.length - 1 - DEPUIS_AIGU[jeton]!)]!;
      this.pincer(frequence(n), t, 0.7, this.voix!);
    }
    if (croche === 0) {
      this.surlignages.push(
        window.setTimeout(() => {
          this.mesureCourante = mesure;
          this.surligner();
        }, this.dans(t)),
      );
    }
  }

  /** Le séquenceur : programme ce qui tombe dans la fenêtre d'avance, puis se rappelle. */
  private tourner(): void {
    const ctx = this.ctx!;
    if (!etat.grille.length) {
      this.arreter();
      return;
    }
    while (this.prochainTemps < ctx.currentTime + Lecteur.AVANCE) {
      if (this.position >= etat.grille.length * 8) {
        if (!etat.boucle) {
          // Fin de grille : on laisse sonner le dernier accord, sans le couper.
          this.surlignages.push(
            window.setTimeout(() => this.arreter(false), this.dans(this.prochainTemps)),
          );
          return;
        }
        this.position = 0;
      }
      this.programmer(this.prochainTemps);
      const durees = dureesCroches(rythmiqueParId(etat.rythmique));
      this.prochainTemps += (60 / tempo) * durees[this.position % 8]!;
      this.position++;
    }
    this.minuteur = window.setTimeout(() => this.tourner(), Lecteur.INTERVALLE);
  }

  /** Remet la classe `joue` sur la bonne mesure, y compris après un nouveau rendu de la grille. */
  surligner(): void {
    document.querySelectorAll('.mesure.joue').forEach((m) => m.classList.remove('joue'));
    if (this.enLecture && this.mesureCourante >= 0) {
      document.querySelector(`.mesure[data-i="${this.mesureCourante}"]`)?.classList.add('joue');
    }
  }

  jouer(): void {
    if (!etat.grille.length) {
      toast('Ajoutez d’abord un accord à la grille.');
      return;
    }
    const ctx = this.preparer();
    this.voix = ctx.createGain();
    this.voix.connect(this.sortie!);
    this.enLecture = true;
    this.position = 0;
    this.prochainTemps = ctx.currentTime + 0.05;
    this.mesureCourante = -1;
    $('#jouer').innerHTML = ICONE_ARRET;
    this.tourner();
  }

  /**
   * `couper` : fermer la sortie en 30 ms. C'est le bouton « Arrêter ». À la fin
   * naturelle d'une grille sans boucle, on ne coupe pas : le dernier accord
   * finit de sonner.
   */
  arreter(couper = true): void {
    if (!this.enLecture) return;
    this.enLecture = false;
    clearTimeout(this.minuteur);
    this.surlignages.forEach(clearTimeout);
    this.surlignages = [];
    const ctx = this.ctx!;
    const voix = this.voix!;
    if (couper) {
      const maintenant = ctx.currentTime;
      voix.gain.cancelScheduledValues(maintenant);
      voix.gain.setValueAtTime(voix.gain.value, maintenant);
      voix.gain.linearRampToValueAtTime(0, maintenant + 0.03);
    }
    // Les oscillateurs déjà lancés s'arrêtent d'eux-mêmes sous deux secondes ;
    // on débranche leur sortie ensuite, pour ne rien laisser traîner.
    window.setTimeout(() => voix.disconnect(), 2000);
    this.voix = null;
    this.mesureCourante = -1;
    this.surligner();
    $('#jouer').innerHTML = ICONE_LECTURE;
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

function ajouter(rel: number, q: Qualite): void {
  if (etat.grille.length >= MAX_MESURES) {
    toast('Seize mesures, c’est déjà une belle grille.');
    return;
  }
  etat.grille.push({ rel, q });
  rendreGrilleEtSuite();
  // On entend ce qu'on vient de poser, une fois. Pas pendant une lecture :
  // l'accord y passera de toute façon, et deux sons superposés brouillent tout.
  if (!lecteur.enLecture) lecteur.essayer(notesMidi(etat.tonalite, { rel, q }));
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
  if (p.rythmique) etat.rythmique = p.rythmique;
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
  if (puce) ajouter(Number(puce.dataset.rel), puce.dataset.q as Qualite);
  if (cible.closest('#septiemes')) {
    etat.grille = basculerSeptiemes(etat.grille);
    rendreGrilleEtSuite();
  }
  const filtre = cible.closest<HTMLElement>('.filtre');
  if (filtre) {
    etat.filtre = filtre.dataset.filtre as Filtre;
    rendreProgressions();
  }
  const progression = cible.closest<HTMLElement>('.progression');
  if (progression) chargerProgression(Number(progression.dataset.progression));
  const choix = cible.closest<HTMLElement>('.choix');
  if (choix) {
    etat.manche.accord = {
      rel: Number(choix.dataset.mancheRel),
      q: choix.dataset.mancheQ as Qualite,
    };
    rendreManche();
  }
  const penta = cible.closest<HTMLElement>('[data-penta]');
  if (penta) {
    etat.manche.penta = penta.dataset.penta === 'non' ? null : (penta.dataset.penta as Penta);
    rendreManche();
  }
  const formeChoisie = cible.closest<HTMLElement>('.forme');
  if (formeChoisie) {
    const lettre = formeChoisie.dataset.forme;
    etat.manche.forme = lettre === 'racines' ? null : (lettre as Lettre);
    rendreManche();
    // On l'entend en la posant : un battement, sans toucher à la lecture en cours.
    const p = placementManche(etat);
    if (p) lecteur.essayer(notesPlacement(p));
  }
});

$('#jouer').addEventListener('click', () =>
  lecteur.enLecture ? lecteur.arreter() : lecteur.jouer(),
);

$('#boucle').addEventListener('click', () => {
  etat.boucle = !etat.boucle;
  rendreGrille();
});

// Le tempo et la rythmique sont relus par le séquenceur à chaque croche : rien
// à relancer, le changement s'entend à la croche suivante.
const curseurTempo = $<HTMLInputElement>('#tempo');
curseurTempo.addEventListener('input', () => {
  tempo = Number(curseurTempo.value);
  $<HTMLOutputElement>('#tempo-valeur').value = String(tempo);
});

$<HTMLSelectElement>('#rythmique').addEventListener('change', (e) => {
  etat.rythmique = (e.target as HTMLSelectElement).value;
  $('#motif').innerHTML = htmlMotif(etat.rythmique);
});

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

// ── Thème ──────────────────────────────────────────────────────────────────
//
// Clair par défaut, quel que soit le réglage du système ; le sombre se choisit
// et reste mémorisé. Le script est externe (CSP), donc un lecteur en sombre
// voit le clair un instant au chargement : c'est le prix d'un site sans script
// en ligne, et il est faible.

const CLE_THEME = 'theme';

function appliquerTheme(sombre: boolean): void {
  // Sans les transitions le temps du changement : sinon chaque fond teinté
  // glisse d'une couleur à l'autre pendant une bonne seconde, et la page a
  // l'air délavée entre les deux thèmes.
  const racine = document.documentElement;
  racine.classList.add('sans-transition');
  if (sombre) racine.dataset.theme = 'dark';
  else delete racine.dataset.theme;
  window.setTimeout(() => racine.classList.remove('sans-transition'), 250);
  const bouton = $('#theme');
  bouton.textContent = sombre ? 'Mode clair' : 'Mode sombre';
  bouton.setAttribute('aria-pressed', String(sombre));
}

try {
  appliquerTheme(localStorage.getItem(CLE_THEME) === 'dark');
} catch {
  appliquerTheme(false);
}

$('#theme').addEventListener('click', () => {
  const sombre = document.documentElement.dataset.theme !== 'dark';
  appliquerTheme(sombre);
  try {
    localStorage.setItem(CLE_THEME, sombre ? 'dark' : 'light');
  } catch {
    // Navigation privée ou stockage refusé : le choix vaut pour la page, pas plus.
  }
});

// ── Écriture des degrés ────────────────────────────────────────────────────

const CLE_CHIFFRAGE = 'chiffrage';

function appliquerChiffrage(chiffrage: Chiffrage): void {
  etat.chiffrage = chiffrage;
  document
    .querySelectorAll<HTMLButtonElement>('[data-chiffrage]')
    .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.chiffrage === chiffrage)));
}

document.querySelectorAll<HTMLButtonElement>('[data-chiffrage]').forEach((b) =>
  b.addEventListener('click', () => {
    appliquerChiffrage(b.dataset.chiffrage as Chiffrage);
    rendreGrille();
    rendreTonalite();
    rendreProgressions();
    try {
      localStorage.setItem(CLE_CHIFFRAGE, etat.chiffrage);
    } catch {
      // Stockage refusé : le choix vaut pour la page.
    }
  }),
);

// ── Départ ─────────────────────────────────────────────────────────────────

const depuisAdresse = lireAdresse(location.hash);
if (depuisAdresse) {
  etat.tonalite = depuisAdresse.tonalite;
  etat.grille = depuisAdresse.grille.slice(0, MAX_MESURES);
}
let chiffrageMemorise: string | null = null;
try {
  chiffrageMemorise = localStorage.getItem(CLE_CHIFFRAGE);
} catch {
  chiffrageMemorise = null;
}
if (chiffrageMemorise === 'majuscules') appliquerChiffrage('majuscules');

// La page est déjà rendue au build dans l'état par défaut ; on ne la
// reconstruit que si l'adresse ou un réglage mémorisé en demande un autre.
// Sinon, seuls les états dynamiques (boucle, adresse) sont posés.
if (depuisAdresse || etat.chiffrage !== 'casse') toutRendre();
else {
  $('#cadre').classList.add('boucle');
  ecrireAdresse();
}
