# WIAC — *World In A Context*

> Studio approfondito del concept. Questo documento fissa la **tesi**, il **modello formale**,
> le **garanzie** che la generazione deve rispettare, e la **roadmap dei prototipi**.
> È il riferimento da cui partono i prototipi no-LLM.

---

## 0. La frase

> **Comprensione ⇄ Compressione.** Fare scienza è comprimere la realtà: meno formule, meno
> errore (fisica); clusterizzare sostanze per comportamento (chimica); semplificare sistemi
> complessi (biologia). WIAC è un gioco in cui *giocare* significa *comprimere un mondo
> sconosciuto* — cioè trovarne le **analogie**.

La parola chiave è **ANALOGIA**. Un mondo è interessante se e solo se ha analogie: cioè se la
sua **entropia non è massima** e quindi è *comprimibile*. Se tutto è casuale e indipendente,
non c'è niente da scoprire, niente da clusterizzare, niente da prevedere → non è scienza, è
una lotteria. Il design di WIAC è quindi, prima di tutto, un problema di **generazione di
mondi strutturati ma nascosti**.

---

## 1. Visione

- Il **backbone** è così semplice da girare in **CLI**. Sopra si possono costruire molte UI
  diverse (terminale, web, grafiche sperimentali) → un unico motore, tante "lenti".
- Il gameplay è **creatività + scienza allo stato puro**: deve *sembrare* fare ricerca
  scientifica di alto livello.
- **Livelli di difficoltà**: mondi di complessità e vastità diverse generati con un click.
- **Singolo o team competitivo**: strumenti di plotting, analisi, teorie, collaborazione.
- Re-skinnabile: cambiando i nomi di variabili/operatori l'UI diventa chimica, biologia,
  fisica, o "ricerca di algoritmi" di un mondo inesistente. **La matematica sotto è la stessa.**

---

## 2. Il modello formale

Tre primitive elementari (dal documento sorgente):

| Concetto di gioco | Oggetto matematico | Cosa vede il giocatore |
|---|---|---|
| **Sostanza** (variabile) | vettore nascosto `s ∈ ℝⁿ` | *niente* del vettore — solo un nome e i valori delle misure |
| **Misura** (misurazione) | funzione `fⱼ : ℝⁿ → ℝ` | i numeri `fⱼ(s)` (il pH, la densità, …) |
| **Operazione** (mischiare, cuocere) | mappa `zₖ : ℝⁿ × ℝⁿ → ℝⁿ` (o unaria `ℝⁿ → ℝⁿ`) | una *nuova sostanza* con i suoi numeri |

**Punto cruciale di design:** il giocatore **non vede mai i vettori**. Gli unici numeri sono i
risultati delle misure. I vettori `ℝⁿ` sono la "fisica nascosta" del mondo; cambiano di mondo
in mondo. Il giocatore costruisce le sue *analogie* solo da ciò che misura.

### 2.1 Il loop concettuale

```
sostanze base  ──[operazioni]──▶  nuove sostanze  ──[misure]──▶  numeri  ──▶  ipotesi/clustering
      ▲                                                                              │
      └──────────────────────────  scelte informate del giocatore  ◀────────────────┘
```

### 2.2 L'obiettivo

Un obiettivo è una **specifica sui valori di misura**, ad es.:

> «Trova una sostanza `x` tale che `μ₁(x) = 4.56`» (entro tolleranza `ε`)

oppure multi-vincolo: `μ₁(x) ≈ t₁ ∧ μ₂(x) ≈ t₂`. Qualunque cosa significhi `μ₁`: il bello è
che il giocatore deve *scoprire* cosa misura e come spostarla.

---

## 3. Cosa rende un mondo "giocabile"

Tre proprietà, in tensione tra loro:

1. **Struttura (analogie).** Entropia non massima. Le sostanze devono clusterizzarsi: gruppi
   che si comportano in modo simile sotto misure e operazioni. È ciò che rende possibile
   *comprimere* → scoprire.
2. **Nascondimento.** La struttura non deve essere ovvia. Misure e basi nascoste fanno sì che
   scoprirla *richieda* esperimenti e ragionamento (il "lavoro di ricerca").
3. **Solvibilità garantita.** Deve esistere una soluzione, e deve essere raggiungibile con
   **meno esperimenti del brute-force** (altrimenti l'unica strategia è provare tutto = noia).

Il design vincente vive nella tensione 1↔2: troppa struttura visibile = banale; zero struttura =
lotteria. La **difficoltà** è esattamente *quanto è nascosta la struttura*.

---

## 4. Le tre garanzie (il cuore matematico)

### G1 — Esistenza della soluzione
La generazione costruisce l'obiettivo come **endpoint di un "gold path"**: una catena/DAG di
operazioni applicate alle sostanze base, di profondità `D` (dettata dalla difficoltà), che
termina in una sostanza target `s*`. L'obiettivo è `μ(s*)`. **Per costruzione** esiste una
soluzione di profondità ≤ (n° operazioni del DAG). Banale ma solido.

### G2 — Raggiungibilità sotto-brute-force (il giocatore non deve provare tutto)
Non basta che la soluzione esista: deve emergere **abbastanza informazione** da raggiungerla
senza esplorare tutte le combinazioni. Sufficienti due ingredienti:

- **Mondo (localmente) regolare** — piccole variazioni input ⇒ piccole variazioni output. Si
  ottiene con operazioni *smooth* (es. rotazioni, blend) e misure *continue*. → il giocatore
  può fare interpolazione/bisezione invece di ricerca cieca.
- **Misure informative** — almeno `r` misure indipendenti, con `r ≥ rango effettivo` del mondo.
  Allora le sostanze sono *identificabili in spazio-misura* e si può **calcolare** quale
  combinazione colpisce il target (sistema lineare), non indovinarla.

### G3 — Informatività dimostrabile (garanzia *a priori* di una soluzione efficiente)
Caso pulito e dimostrabile: includi tra le operazioni un **blend continuo**
`z_λ(a,b) = (1−λ)·a + λ·b`, `λ∈[0,1]`, e fai sì che il **target in spazio-misura cada
nell'inviluppo convesso** delle sostanze raggiungibili. Se almeno una misura è continua e non
degenere lungo il blend, per il **teorema del valore intermedio** ogni valore tra `μ(a)` e
`μ(b)` è colpibile, e lo si trova per **bisezione** in `O(log(1/ε))` esperimenti — *molto*
sotto il brute-force. Generando il gold path con blend dentro l'hull, G3 è garantita per
costruzione.

> **Riassunto:** *gold path* ⇒ esistenza (G1). *regolarità + misure indipendenti* ⇒
> calcolabilità (G2). *blend continuo + target nell'hull + IVT* ⇒ bisezione `O(log)` (G3).

---

## 5. Approcci di generazione

### 5.1 Vectorial Gen (l'idea primaria)
1. Genera **poche** sostanze base `s₁,…,s_m ∈ ℝⁿ` **già con affinità** (vedi clustering sotto).
2. Genera misure `fⱼ : ℝⁿ → ℝ` (lineari, eventualmente con readout monotòno).
3. Genera operazioni `zₖ : ℝⁿ×ℝⁿ → ℝⁿ` (smooth: blend, mappe affini, rotazioni).
4. Mischia a caso (gold path) fino a profondità `D` → tante sostanze nuove; scegli `s*` come target.
5. Verifica le garanzie (G2/G3) prima di servire il mondo.

**Clustering certo** — due ricette intercambiabili:
- **Low-rank:** `s_i = U·c_i`, con `U ∈ ℝ^{n×r}` (`r ≪ n`) e codici `c_i` raggruppati. Il
  rango `r` limita la complessità → identificabilità con `r` misure.
- **Archetipi + rumore:** `k` centri (archetipi), ogni sostanza = centro + rumore piccolo.
  Cluster espliciti, "famiglie" di sostanze (acidi vs basi vs sali…).
- (avanzato) **Perlin/value noise** su uno spazio latente per cluster morbidi e continui.

### 5.2 Lo spettro Lineare → Non-lineare
- **Mondo lineare-affine** (operazioni affini, misure lineari): garanzia ferrea di solvibilità
  appena `#misure indipendenti ≥ rango`. *Rischio:* potrebbe essere troppo facile/poco
  divertente.
- **Mondo non-lineare con gold-path casuale:** esistenza garantita comunque (G1); il
  divertimento sale ma serve attenzione a G2/G3 (mantenere regolarità locale + hull).
- **Readout monotòno** sulle misure (es. `pH = −log₁₀[·]`): nasconde la linearità senza
  rompere gli ordinamenti → resta apprendibile, ma "sembra chimica".

### 5.3 Generazione via DSL (+ eventuale LLM — *fuori scope per i primi prototipi*)
Rendere la generazione un piccolo **DSL** e armare un generatore (anche LLM) di funzioni di
generazione → mondi meno casuali, più "naturali/umani". **I primi prototipi sono no-LLM**: la
struttura emerge da algebra lineare + clustering controllato.

---

## 6. L'asse di difficoltà (un knob continuo)

| Knob | Facile | Difficile |
|---|---|---|
| Dimensione `n` / n° sostanze | piccola | grande |
| Rango effettivo `r` | basso (molto comprimibile) | alto |
| #misure indipendenti vs rango | ridondanti, abbondanti | scarse, sovrapposte, rumorose |
| Operazioni | blend continuo (bisezione) | discrete/combinatorie |
| Linearità | affine pura | non-lineare smooth → bumpy |
| Profondità gold-path `D` | corta (soluzione vicina) | lunga |
| Vincoli obiettivo | 1 misura | multi-misura accoppiate |
| Rumore di misura | assente | presente |

Difficoltà = **quanto è nascosta la struttura** + **quanto è lontana/vincolata la soluzione**.
Tutte queste manopole sono esposte al generatore → "genera un mondo di livello X con un click".

---

## 7. La sensazione di ricerca (game loop)

Azioni del giocatore (ognuna ha un **costo**: turni/tempo → spinge a essere efficienti come in un lab reale):
- **Misura** una sostanza (rivela `fⱼ`).
- **Sintetizza**: applica un'operazione a una/due sostanze → nuova sostanza.
- **Plotta/analizza**: scatter misura-vs-misura (trova cluster!), misura-vs-λ (trova trend),
  tabelle, distanze. *Gli strumenti d'analisi sono parte del gameplay.*
- **Ipotizza & annota** (lab notebook): nomina sostanze, raggruppa, tieni teorie.
- **Sottometti** una sostanza candidata → il gioco verifica l'obiettivo.

**Punteggio:** n° esperimenti usati vs minimo teorico / brute-force. → leaderboard per team
competitivi; premia la *compressione* (poche mosse intelligenti) sulla forza bruta.

---

## 8. Re-skin tematico (un solo motore, tante scienze)

Un **tema** è solo un *pacchetto di vocabolario*: generatore di nomi sostanze, nomi operazioni,
nomi misure. La matematica non cambia.

| Tema | Sostanze | Operazioni | Misure |
|---|---|---|---|
| Chimica | composti | mischia, cuoci, distilla | pH, densità, reattività |
| Biologia | ceppi/organismi | incrocia, incuba, muta | fitness, espressione genica |
| Fisica | particelle/campi | componi, fai collidere | energia, momento, carica |
| Algoritmi | programmi | componi, trasforma | complessità, accuratezza |

→ La promessa del documento sorgente: «basta cambiare i nomi delle variabili e degli operatori».

---

## 9. UIAC — *Universe In A Context* (estensione "pazza")

Il backbone diventa un insieme di sostanze legate da **una grande rete neurale** che
rappresenta "una natura intera". Si fanno **query** alla natura e questa risponde. È
l'iperbole del modello: invece di operazioni algebriche esplicite, una rete fissa (non
addestrata, solo *inizializzata* con struttura) come oracolo del mondo. **Fuori scope per i
primi prototipi**, ma l'architettura del motore deve permettere di sostituire il "kernel del
mondo" (algebra lineare ↔ rete neurale) senza toccare UI e game-loop.

---

## 10. Domande aperte / rischi

- **R1 — È divertente?** Il mondo lineare puro è *garantito* ma forse banale. Ipotesi di
  lavoro: il divertimento sta nel *nascondimento* (G2 alta) + multi-vincolo + plotting, non
  nella non-linearità in sé. *Da validare sui prototipi.*
- **R2 — Stima dell'informazione.** Vogliamo una misura quantitativa "questo mondo è risolvibile
  in ≤ K esperimenti". Per il caso lineare/blend è dimostrabile (sez. 4). Per il non-lineare
  serve almeno una stima empirica (un *solver-bot* di riferimento, vedi §11).
- **R3 — Decidibilità/sicurezza della generazione.** Il generatore deve *verificare* le garanzie
  prima di servire un mondo (es. controllare rango delle misure, target nell'hull). Mondi che
  falliscono il check vengono rigenerati.
- **R4 — Identificabilità vs nascondimento.** Troppe misure indipendenti = mondo trasparente;
  troppo poche = irrisolvibile. C'è una *finestra dolce* da trovare sperimentalmente.

## 11. Strategia di validazione no-LLM

Per ogni mondo generato, far girare due bot di riferimento **senza** che il giocatore li veda:
- **Brute-force bot** → stabilisce il *costo massimo* (baseline da battere).
- **Smart bot** (bisezione / soluzione lineare / clustering) → dimostra che esiste una
  strategia "da ricercatore" che vince con **≪** esperimenti. Il rapporto `smart/brute` è
  l'indice di *giocabilità* del mondo. Mondi con rapporto troppo vicino a 1 → scartati o
  ri-tarati.

---

## 12. Roadmap dei prototipi

- **P0 — Motore core (no-LLM, no-UI).** Generatore Vectorial Gen + garanzie + bot di riferimento.
  Un unico modulo riusabile (gira in Node *e* in browser, zero build).
- **P1 — CLI backbone.** REPL: `measure`, `mix`, `cook`, `plot`, `note`, `submit`. Tema
  re-skinnabile. Punteggio vs baseline dei bot.
- **P2 — Web UI.** Stessa logica, lente grafica: scatter interattivi, alberi di sintesi,
  notebook. Sperimentare grafiche diverse.
- **P3+** — difficoltà avanzate, multiplayer/competitivo, DSL, e (lontano) UIAC con kernel-rete.

---

*Vedi `docs/PROTOTYPE_PLAN.md` per la sintesi del design di prototipo (output dei subagenti) e
`engine/` per il motore.*
