# WIAC — Piano del prototipo (sintesi dei 3 subagenti)

> Riconciliazione delle tre analisi (math/garanzie · game-loop/UX · architettura) in un set di
> decisioni **buildabili**. I dettagli completi stanno nei ragionamenti dei subagenti; qui ci
> sono le scelte definitive su cui è costruito il codice in `engine/`, `cli/`, `bots/`, `web/`.

## Stack (deciso)
- **JS ESM puro, zero build.** Gli stessi file di `engine/` girano in **Node v22** (CLI + bot) e
  nel **browser** (`<script type="module">`), senza bundler, senza `npm install`, senza transpile.
- Nessun `fetch()` di dati: temi e mondi sono *codice* (import ESM / generati da seed) → `web/index.html`
  si apre anche da `file://`. `engine/` non usa API Node-only (resta runtime-neutral).
- PRNG seedato **mulberry32**; tutta la casualità passa di lì → mondi riproducibili e condivisibili.

## Modello (deciso)
- **Sostanza** = vettore nascosto `s = U·c ∈ ℝⁿ` (`U` colonne ortonormali `n×r`, `r≪n`, `c`=codice latente).
  Il low-rank + cluster di `c` è ciò che crea **analogie/clustering** (la "compressibilità").
  Il vettore **non lascia mai il motore** (boundary in `snapshot.js`).
- **Misura** `μⱼ(s) = gⱼ(wⱼ·s + bⱼ)` — lineare nel core (quindi affine nel codice latente),
  con readout monotòno `gⱼ` (id / tanh) che *nasconde* la linearità senza rompere l'apprendibilità.
- **Operazioni**: `blend(a,b,λ)=(1−λ)a+λb` (continua, è la leva della garanzia); `cook` = mappa affine
  in spazio latente (rotazione ortogonale / contrazione → **numericamente stabile**, niente blow-up).

## Garanzia di solvibilità (deciso — versione robusta)
Il **target è generato come combinazione convessa di sostanze base** `s* = Σαᵢ sᵢ` (α sul simplex).
- **Vincolo singolo** (tutorial/normal): il valore obiettivo cade dentro `[min,max]` delle base sulla
  misura-obiettivo ⇒ esiste una coppia che fa da *bracket* ⇒ **bisezione** su λ in `O(log 1/ε)` (IVT,
  vale anche col readout monotòno). **PROVATO.**
- **Vincolo doppio** (hard): per Carathéodory esiste una combinazione convessa di ≤3 base che colpisce
  i 2 target in spazio-misura ⇒ lo *smart-bot* la trova (enumera triple, risolve 3×3, realizza con
  blend annidati). Solvibilità **garantita per costruzione** del target.
- **Validator** prima di servire un mondo: rank(`W·U`)=r (identificabilità), bracket presente
  (vincolo singolo), nessuna base risolve già l'obiettivo (non-degeneracy), **smart-bot vince**, e
  `bruteCost/smartCost ≥ soglia` (giocabilità). Fallisce → rigenera `seed+1`.

## Costo / "sensazione di ricerca" (deciso)
- L'analisi è **gratis**; **agire costa** (come in un lab reale): `measure` 1 XP per coppia
  (sostanza,misura) nuova (cache gratis), `mix`/`cook` 2 XP, `submit` sbagliato +3 XP di penalità.
- Strumenti d'analisi (il cuore del divertimento): `plot` (scatter ASCII misura-vs-misura → vedi i
  cluster), `trend` (misura-vs-λ → vedi il bracket), `hist`, `corr` (misure ridondanti), `cluster`
  (tassonomia). + notebook: `name`/`tag`/`note`/`hypo` (ipotesi con verdetto SUPPORTED/REFUTED).
- **Punteggio** ancorato ai bot: `bruteCost` (baseline forza bruta), `smartCost` (ricercatore),
  `thetaMin` (ottimo teorico). Mostrati a fine partita ("un ricercatore l'ha fatto in N, tu in K").

## Tier (deciso, 3)
| | tutorial | normal | hard |
|---|---|---|---|
| n / r | 6 / 2 | 12 / 4 | 24 / 6 |
| #base / #cluster | 4 / 2 | 8 / 3 | 14 / 4 |
| #misure | 3 | 6 | 8 |
| readout | id | tanh | tanh |
| ops | blend | blend + cook | blend + cook + refine |
| #vincoli | 1 | 1 | 2 |
| budget XP | 40 | 80 | 150 |

## Architettura (deciso)
`engine/index.js` è l'**unico import** che le UI toccano. La sessione (`session.js`) espone
`allowedActions()`, `apply(action)`, `snapshot()` (UI-safe, vec-free). Il **WorldKernel** è la
*cucitura* sostituibile (oggi `linear-kernel.js`; domani la rete neurale di **UIAC**) — UI e
game-loop non sanno nulla di cosa c'è sotto. Temi = pacchetti di vocabolario (alchemy/biolab/physics).

## In scope (v0.1)
Motore completo · CLI giocabile con tutti gli strumenti d'analisi ASCII · 2 bot + validator headless ·
Web UI interattiva · 3 temi · 3 tier · share-code. **Fuori scope:** kernel-rete UIAC (solo la
cucitura), multiplayer/leaderboard di rete, rumore di misura (knob presente, off in v0.1).
