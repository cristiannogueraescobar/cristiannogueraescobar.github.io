# Checkpoint E3 — Canonical Model Construction and Continuous Simplex

## Baseline and scope

E3 builds directly on the approved E2 baseline of **10630** deterministic
assertions. It makes canonical **model construction** and **continuous solving**
testable directly against the production source
(`engine/source/plumline-engine.js`) through the canonical harness, without
touching the engine, the mirror, tolerances, algorithms, pivot order,
tie-breaking, normalisation, names, parameters, returns, messages, statuses,
stop reasons, results, or the public output.

E3 is **structural and contractual**. Where a mathematical defect is found, the
current behaviour is characterised and pinned as a regression, documented, and
classified for a later algorithmic phase — never corrected here.

## E3 boundary

**In scope:** mathematical context creation, grid loading, variable
selection/order, objective, maximize/minimize direction, constraints, constraint
operators, right-hand side, coefficient extraction, coefficient
vectors/matrices, constraint normalisation, bounds, free variables, fixed
variables, lower/upper bounds, domain metadata, continuous model classification,
transformation to the internal representation, standard form, tableau,
continuous simplex, pivot, row/column selection, degeneracy, continuous
feasibility/optimality/unboundedness, internal continuous-infeasibility, the
internal result contract of the continuous solver, and migration of applicable
suites from the mirror to the canonical engine.

**Out of scope (E4/E5/E6):** branch-and-bound, branching, nodes, node/depth
limits, integrality gap, integer feasibility, binary enforcement during solve,
mixed-integer solve, knapsack, branch-and-bound time limits, cancellation,
Worker orchestration/glue/request-response, final solution verification, public
status semantics, error translation, UI, plots, exports, mirror reconciliation,
algorithmic improvements, and Checkpoint E4.

## Functions

Audited from the canonical source by real call graph.

**A — model construction (E3):** `detectModel_` (L1660), `solveModel_` (L1385),
`readConstraint_` (L2017, approved divergence), `senseFor_` (L2105),
`pickObjective_` (L2123), `describeModel_` (L1948), `reachableConstants_`
(L1872), `dependsOnVariables_` (L827).

**B — bounds + domain metadata (E3):** `applyBounds_` (L161),
`buildVariableDomains_` (L220), `integerIndices_` (L266, metadata only),
`classifyModel_` (L193).

**C — continuous simplex (E3):** `optimise_` (L33, dispatcher; only the
continuous path is E3), `solveLinearProgram_` (L417), `normalizeConstraint_`
(L525), `pivot_` (L575), `feasibleAt_` (L296), `finiteModel_` (L140),
`validModelShape_` (L91).

**I — shared:** `loadGrid_` (L711), `newContext_` (L790, approved divergence),
`coefficientVector_` (L1636).

**Excluded (E4-E6, forbidden through the E3 harness):** `solveIntegerProgram_`
(L314, branch-and-bound), `isWhole_` (L276, integer feasibility).

## Exports

`engine/e3-exports.js` is the single authority for the closed E3 list. It is a
separate set, not a copy of E2. The harness serves both phases from one
infrastructure via `createCanonicalEngineHarness({ phase: 'e3' })`; it never
merges the two phases' export sets.

- E2 still exposes exactly its **24** functions.
- E3 exposes exactly its **22** approved functions.
- The E3 harness rejects a missing export, an unknown name, an E4-E6 function, a
  non-function, an undeclared alias, and any name outside the closed E3 list; it
  also fails if E2 accidentally changes its list.

## Model schema (internal, real field names — never renamed)

| field | type | required | default | produced by | consumed by |
|---|---|---|---|---|---|
| `objective` | `array<number>` (coefficients) | yes | — | `solveModel_`/`detectModel_` | `solveLinearProgram_` |
| `constant` | `number` | no | `0` | model construction | objective value |
| `maximize` | `boolean` | yes | — | `senseFor_`/`pickObjective_` | dispatcher |
| `constraints` | `array<{coefficients, relation, rhs}>` | yes | — | model construction | simplex |
| `integer` | `array<number>` (indices) | no | `[]` | domain metadata | `integerIndices_` |
| `bounds` | `array<{lower, upper}>` | no | `[]` | bounds | `applyBounds_` |
| `__infeasible` | internal flag | — | — | `applyBounds_` | dispatcher |

`relation` is one of `<=`, `>=`, `=`. A fully-continuous model (`integer` empty)
goes straight to `solveLinearProgram_` and **never** enters branch-and-bound.

## Objective and direction

`maximize:true` maximises; `maximize:false` minimises; `model.constant` is folded
into the objective value. Objective **parsing** is E2 (`linearize_`); objective
**construction** (cell + sense) is E3 (`pickObjective_`/`senseFor_`); result
**presentation** is E5/UI.

## Constraints

Operators `<=`, `>=`, `=`. Strict `<`/`>` as a relation is rejected by
`readConstraint_` with `STRICT_INEQUALITY:`. `normalizeConstraint_` flips a
negative RHS: it negates the coefficients, flips the relation (`<=`↔`>=`, `=`
stays), and negates the RHS. Construction order is preserved (deterministic).

## Bounds, free and fixed variables

Default lower bound `0`; the simplex already assumes `x>=0`. `applyBounds_` folds
bounds into ordinary constraints: a finite upper becomes `x<=upper`; a positive
lower becomes `x>=lower`. `lower==upper` fixes a variable. `lower>upper` sets
`__infeasible` and yields `infeasible`. `FREE_VARIABLE_LIMIT` stays `50`.

**Characterised behaviour (not corrected):** an `Infinity` bound makes
`finiteModel_` return false, so `optimise_` returns `numerical_failure`. This is
pinned as regression case C18 and classified for a later algorithmic phase.

## Domain metadata

E3 reads, stores, classifies and propagates continuous/integer/binary/mixed
metadata but never branches, tests integrality, or solves mixed-integer.
Continuous simplex tests force fully-continuous models. A positive contract
protects that a continuous model does not invoke branch-and-bound.

## Continuous dispatch, simplex and internal results

`optimise_` calls `integerIndices_(model)`; empty → `solveLinearProgram_`.
`solveLinearProgram_` maps constraints through `normalizeConstraint_`, adds slack
for non-`=` constraints and artificials for non-`<=` constraints
(`total = n + extra + artificials`), builds a tableau + basis, and pivots.
Tolerances are the engine's own: `EPSILON 1e-9`, `PIVOT_TOLERANCE 1e-7`,
`MAX_ITERATIONS 20000` — tests use these, never a new tolerance.

The **internal** result contract is
`{status, stopReason, optimalityProven, nodesExplored, objective, values}`.
Internal statuses observed on the continuous path: `optimal`, `infeasible`,
`numerical_failure`, `invalid_model`, `unbounded`. `nodesExplored` is undefined
on the continuous path. These are INTERNAL contracts; the public status semantics
remain E5 and are not redefined here.

## Continuous cases (pinned)

C1 max 3x+2y st x+y<=4 → optimal 12 [4,0]; C2 min x+y st x+y>=2 → optimal 2;
C3 single var → optimal 50 [10]; C4 equality → optimal 3; C5 negative RHS →
optimal 2; C6 objective constant → optimal 13; C7 optimum at zero → optimal 0
[0]; C8 unbounded; C9 infeasible; C10 degenerate → optimal 2; C11 redundant →
optimal 5; C12 small coeff → optimal 10000; C13 large coeff → optimal 1000;
C14 upper bound → optimal 3; C15 lower bound → optimal 2; C16 fixed → optimal 5;
C17 incompatible bounds → infeasible; C18 Infinity bound → numerical_failure
(characterised).

## Migrated and legacy suites

**Migrated: 0. Split: 0.** The E3 migration is the set of NEW canonical E3 suites
that exercise model construction + continuous simplex directly through the
harness. No legacy suite was migrated or split:

- `tests_bounds.js` — calls `optimise_` directly but mixes continuous cases with
  `integer:[...]` cases that take the E4 branch-and-bound path; the boundary is
  not clean without splitting, and the continuous contracts are already covered
  canonically. Kept legacy (E4 dependency).
- `tests_single_var.js`, `tests_strict.js`, `tests_sumif_criteria.js`,
  `tests_locale.js` — their `run()` helper reaches `detectModel_` + `solveModel_`
  end-to-end, including final-status semantics (E5). Kept legacy.
- `tests_safety.js` (E4 limits), `tests_states.js` (E5 statuses),
  `tests_direction/examples/panel/grid_input` (composedHtml integration),
  `tests_worker_parity` (E6) — kept legacy for their real phase.

No legacy assertion was reduced, and no expectation was changed to make parity
pass.

## Parity (canonical ↔ mirror)

The canonical source is the authority. Classes: **direct** (both expose the same
operation — `loadGrid_`), **observable** (a common public input yields a
comparable model/result — `detectModel_`/`solveModel_`), and **approved
divergence** (only `newContext_` and `readConstraint_`).

- Direct parity cases: 1 (`loadGrid_`).
- Observable parity cases: 4 (`detectModel_` on an LP sheet, a no-formula sheet,
  a max-hint sheet, and `solveModel_` on a continuous LP).

`readConstraint_`'s `allowCachedFormulaFallback` diverges by platform policy: on
the web (where `newContext_` forces the fallback off) a formula whose stored
value is `0` is not folded to its cached value; the add-on mirror allows it.
Inputs that do not trigger the fallback are exactly equal; inputs that do must
match the approved contract exactly, never a false equality. A third divergence
must fail. The mirror is never modified to force parity.

## Fixture, checker, suites, auditor

- **Fixture:** `engine/fixtures/single-engine/engine-e3-model-continuous.json`
  pins the engine SHA, the mirror SHA and the E2 fixture SHA, plus the E3 export
  list, function map, model schema, bounds/domains, continuous dispatch, simplex
  contract, continuous cases, parity matrix, approved divergences, harness/stubs,
  allowlist, provenance, `PINNED_SHA` and anti-regeneration. No absolute paths,
  no timestamps, no function bodies, no time-dependent data.
- **Checker:** `checkCanonicalModelAndContinuousSolver(siteDir)` →
  `{ pass, fail, failures }` in `engine/tests_canonical_model_continuous.js`. It
  runs the canonical source through the official harness and never re-implements
  the simplex.
- **Positive:** `engine/tests_canonical_model_continuous_positive.js`.
- **Negative:** `engine/tests_canonical_model_continuous_negative.js` — each case
  mutates a temp tree, runs the official harness/checker, fails by the declared
  contract with a specific needle, and cleans up in `finally`.
- **Needle auditor:** `engine/tests_e3_needle_audit.js` — every case has a
  specific needle; functional mutations key on a functional assertion, not the
  pinned-hash message (a closed integrity allowlist may); no case points at the
  mirror while claiming canonical; no E4 function is presented as an E3 contract.

## Allowlist

`RAW_SOURCE_ALLOWLIST` stays at **18** (post-E1 18, post-E2 18, post-E3 18). No
E3 harness, functional suite, checker, positive, negative, or fixture is a raw
reader; none were added or removed. A raw entry is valid only for composition,
markers, or physical integrity.

## Metrics reconciliation (authoritative)

The four E3 suites and their exact `PASSED` counts, taken from each suite's own
output:

| suite | PASSED |
|---|---|
| `tests_canonical_model_continuous` (checker) | 52 |
| `tests_canonical_model_continuous_positive` | 50 |
| `tests_canonical_model_continuous_negative` | 48 |
| `tests_e3_needle_audit` | 72 |

Net E3 increment = 52 + 50 + 48 + 72 = **222**, which matches
10852 − 10630 = **+222** exactly.

The negative suite has **48** cases/assertions: 47 `expect*` helper calls
(N1..N47), each performing one `ok()`, plus the inline N48 case. An earlier draft
report stated the negative suite at "50 assertions"; that figure came from
grep-counting `expectCheckFail(` occurrences (which included matches in comments
and strings) rather than the suite's real `PASSED` line. No assertion was
added, removed, or replaced to reach the correct number — the code always
reported 48; only the prose figure was wrong, and it is corrected here to 48.
E2 stays exactly 61/9/67/43, and no legacy suite changed its count.

### Dist-determinism correction (applied during E4)

While closing E4, a dist-dependency was found and fixed across the canonical
suites: some suites gated a `dist/solver.html byte-identical` assertion on
`fs.existsSync(dist)`, so the battery counted differently with and without a prior
build. Two E3 suites were touched: `tests_canonical_model_continuous` lost its
`dist byte-identical` assertion (52 → 51; the contract moved to `validate_dist`,
run during `npm run build`), and `tests_canonical_model_continuous_positive` lost
its P48 skip-as-pass branch (50 → 49). Both changes make the suites deterministic
with or without dist. As a result the E3 baseline used for E4 is the **adjusted**
10849 (10852 − 3, the third −1 being the E2 parser suite). See
docs/checkpoint-e4-integer-branch-and-bound.md for the full reconciliation. No
functional continuous contract was lost — the byte-identity contract is owned by
`validate_dist`.

## How to add a continuous case

Add the model to the continuous-cases block of the checker (or a positive
assertion), drive it through `optimise_` via the probe, and assert the internal
result with the existing tolerances. Do not introduce a new tolerance, do not
correct a numeric result, and keep the case fully continuous (`integer: []`) so
it never enters branch-and-bound. Pin any new stable characterisation in the
fixture.

## How to run

`node engine/tests_canonical_model_continuous.js` (checker),
`..._positive.js`, `..._negative.js`, `engine/tests_e3_needle_audit.js`, or the
full battery with `npm run verify` / `node engine/run_all.js`.

## Rollback

Remove the four E3 suites from `engine/suites.js`, delete `engine/e3-exports.js`,
`engine/tests_canonical_model_continuous*.js`, `engine/tests_e3_needle_audit.js`
and the E3 fixture, and revert the phase additions in
`engine/canonical-engine-harness.js`. The engine, the mirror and the public
output are untouched by E3, so rollback is test-only.

## Pending (E4-E6)

Branch-and-bound and integer/binary/mixed solving remain legacy and unconsolidated
(E4). Final public status semantics and solution verification remain pending
(E5). Worker orchestration and mirror reconciliation remain pending (E6).
Checkpoint E is **not** complete.


## Update: E4 implemented

Checkpoint E4 has since made canonical integer / binary / mixed solving and branch-and-bound run directly against the canonical source through the harness (E4 phase, closed 8-function export list; branch-and-bound traversal, branch selection, incumbent, pruning, node/depth/time limits and the internal integer result contract). A fully-continuous model still never enters branch-and-bound. No engine byte, mirror byte, constant, tolerance or public output changed; engine/engine.js is still the legacy mirror; final statuses (E5) and Worker/mirror reconciliation (E6) remain pending. See docs/checkpoint-e4-integer-branch-and-bound.md. Checkpoint E is not complete.


## Update: Checkpoint E5 (canonical verification, statuses and error contracts)

E5 pins solution verification, final statuses, stop reasons, optimalityProven, the result adaptation and the status-vs-error separation directly against the canonical source through the harness (E5 phase). No engine/mirror/algorithm/public-output change. Verification is the COMBINATION of isSatisfied_ / feasibleAt_ / buildVariableDomains_ / isWhole_ / dotProduct_ orchestrated by solveModel_ (there is no single verifySolution_). Real statuses: optimal/feasible/infeasible/unbounded/unknown/numerical_failure/invalid_model; incomplete is UI-only, NOT an engine status. Exports: E2 24 / E3 22 / E4 8 / E5 9. Parity 3 direct + 1 observable (solveModel_, elapsedMs documented as a non-deterministic temporal field, the ONLY excluded field; all other contractual fields compared exactly). Approved divergences stay 2 (newContext_/readConstraint_). Characterised defects D-E5-1 (explainStatus_ dead branch) and D-E5-2 (limit without incumbent -> unknown, stopReason preserved) are pinned, NOT fixed. Suites: checker 70, positive 54, negative 53, auditor 116; migrated 0, split 0 (status-bearing legacy drive the mirror end-to-end -> E6). Allowlist stays 18. E5 increment +293; total 11392, identical with and without dist. See docs/checkpoint-e5-verification-statuses-errors.md.

## Checkpoint E6 update

Superseded in part by Checkpoint E6. `engine/engine.js` is now a deterministic
generated artefact derived from the single editable canonical source
`engine/source/plumline-engine.js` by `engine/generate-engine-mirror.js` (plus the
two approved platform adaptations in `engine/source/engine-platform-adapter.json`).
This phase's fixture keeps the HISTORICAL mirror SHA
(`6190cb4720dab3493fb2d903abf4bc0d915c1176605f121a903cdcdd0eb3a7fa`) for its phase;
only the E6 fixture records the generated mirror
(`faabb2c240951bb9c2e90bb0d1762a3cf29409f12cf02d4958a0fcb5c77a39a6`) as the current
state. The canonical engine, the public output and this phase's behaviour are
unchanged. See `docs/checkpoint-e6-worker-mirror-final.md` and
`docs/checkpoint-e-final.md`.

Status: Checkpoint E implementation complete; pending Windows/Node 24 validation,
CI, merge and production verification.
