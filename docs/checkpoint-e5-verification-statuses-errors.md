# Checkpoint E5 — canonical verification, statuses and error contracts

## Boundary

E5 is **structural and contractual**. It exercises the canonical production engine
(`engine/source/plumline-engine.js`) directly through the canonical harness (E5
phase) to pin: independent solution verification, final statuses, stop reasons,
`optimalityProven`, the final result adaptation, and the status-vs-error
separation. It changes **no** engine byte, mirror byte, solver, tolerance, status,
stop reason, `optimalityProven`, error, message, field order, result, algorithm,
Worker payload or public output.

E5 does **not** touch: Worker Blob/glue/postMessage/stale/cancel/fallback (E6),
mirror reconciliation (E6), translations, UI, accessible announcements, plot,
exports, or algorithms. A defect found in E5 is characterised, regression-pinned
and documented — never fixed here.

## Baseline and totals

| checkpoint | total |
|---|---|
| main pre-E | 10231 |
| post-E0 | 10267 |
| post-E1 | 10450 |
| post-E2 | 10630 |
| post-E3 (historic) | 10852 |
| post-E4 (deterministic) | 11099 |
| **post-E5** | **11392** |

E5 increment: **+293** (checker 70 + positive 54 + negative 53 + auditor 116). The
total is identical with and without a prior build (verified by two `npm run verify`
runs and by the battery both ways).

## Functions (E5.1 inventory)

There is **no single `verifySolution_` function**. Verification is the
**combination** of:

- `isSatisfied_` — constraint verification (`<=`, `>=`, `=`) with a 1e-6 tolerance
- `feasibleAt_` — point feasibility: shape + finiteness + every-constraint re-check
- `buildVariableDomains_` — bound / integer / binary verification per variable
- `isWhole_` — integrality verification (1e-6)
- `dotProduct_` — independent objective / constraint-LHS recomputation
- `solveModel_` — the orchestrator and final result adapter

`explainStatus_` converts a status into internal explanatory text. E5 runs the REAL
functions through the harness; it never writes a parallel mathematical verifier.

## Exports (E5.10)

`engine/e5-exports.js` is the single authority: a **closed list of 9** functions
(`solveModel_`, `isSatisfied_`, `feasibleAt_`, `buildVariableDomains_`, `isWhole_`,
`dotProduct_`, `explainStatus_`, `validModelShape_`, `finiteModel_`). It is a
separate set — it does not copy E2/E3/E4. The harness serves every phase from one
infrastructure and never merges the export sets: E2 stays 24, E3 stays 22, E4 stays
8, E5 is 9. Worker/E6 functions are forbidden through the E5 harness.

## Result schema (E5.8)

`solveModel_` builds the final result. Always present: `status`, `stopReason`,
`optimalityProven`, `nodesExplored`, `objectiveLabel`, `elapsedMs`, `variables`,
`modelType`, `sense`, `labels`, `previous`, `foldedConstants`. Present on
optimal/feasible only: `values`, `objective`, `objectiveBefore`, `constraints`,
`variableDomains`. Two-variable only: `plot`, and `coefficients`/`constant` on each
constraint. Feasible only: `caveat`. Non-optimal-non-feasible only: `explanation`.

Adaptation rules (copied, not derived): `status` verbatim; `stopReason =
solution.stopReason || null` (always present); `optimalityProven =
(solution.optimalityProven === true)` (always a boolean, default false);
`nodesExplored = number || null` (null on the continuous path); `objective =
round_(...)` and `values = ...map(round_)` on optimal/feasible.

The constraint report re-verifies each row: `used = round_(dotProduct_(coeffs,
values) + constant)`, `slack`, `binding = |slack| < 1e-6`, `satisfied =
isSatisfied_(used, relation, limit)`.

## Statuses (E5.2 / E5.3)

The **real** engine statuses are: `optimal`, `feasible`, `infeasible`,
`unbounded`, `unknown`, `numerical_failure`, `invalid_model`.

**`incomplete` is UI-only.** It is not an engine status, appears in no engine
return, and is NOT counted as a canonical mathematical status. The UI may present
`unknown` or a limit stop as "incomplete"; the engine never produces it.

Semantics: `optimal` = proven optimum (`optimalityProven true`, `stopReason null`);
`feasible` = incumbent found but a limit stopped the search (`optimalityProven
false`, `stopReason` = the limit, `caveat` set); `infeasible` = proven (exhausted,
no incumbent); `unbounded` = objective grows without limit; `unknown` = the search
stopped before a conclusion with no incumbent; `numerical_failure` = a numeric
problem prevented a reliable result; `invalid_model` = shape guard failed.

## Stop reasons (E5.4)

`node_limit` (nodes > BRANCH_NODES 4000, or depth > BRANCH_DEPTH 60), `time_limit`
(Date.now() > start + BRANCH_MILLIS 20000), `iteration_limit` (LP MAX_ITERATIONS
20000 surfaced), `numerical_failure` (a branch relaxation failed), and `null`
(proven optimal or proven infeasible). `solveModel_` copies the stop reason
verbatim (`solution.stopReason || null`).

## optimalityProven (E5.5)

`optimalityProven` ALWAYS exists on the final result and is ALWAYS a boolean
(default false). It is **copied** from the internal solve result via a strict
`=== true`, never derived from the status and never recalculated. Continuous /
integer optimal → true; feasible / infeasible / unbounded / unknown /
numerical_failure → false.

## Incumbent / no incumbent

A limit stop **with** an incumbent yields `feasible` + `values` + `caveat`
(`optimalityProven false`, `stopReason` = the limit). A limit stop **without** an
incumbent yields `unknown` + `explanation`, no `values` (`optimalityProven false`).

## Characterised defects (NOT fixed — deferred to a later algorithmic phase)

- **D-E5-1** — `explainStatus_` carries a branch for the status string
  `'no whole-number solution found in time'`, which the engine's internal solver
  never produces (dead branch, cosmetic UI text). Both sides are pinned: the branch
  still returns its own text, and no engine return emits that status. This is a
  characterisation of current behaviour, **not** desirable behaviour; changing it
  would be an algorithmic-phase decision.
- **D-E5-2** — a time/node limit with **no** incumbent yields `status 'unknown'`
  with `optimalityProven false`; `solveModel_` preserves the internal stop reason
  (e.g. `time_limit`). A raw `optimise_` probe can show `stopReason null` depending
  on exactly which `Date.now()` call crosses the deadline. Pinned as current
  behaviour, not corrected.

## Technical errors and status/error separation (E5.7)

A **mathematical status** is a FIELD on the returned result object; a **technical
error** is a THROWN `Error`. `solveModel_` never converts one into the other. Real
technical errors: a guessed constraint (no explicit operator+limit) throws; an
unreadable objective/constraint (`safeLinearize_`) throws. Infrastructure errors
(Worker/Blob/postMessage/timeout) are not in the engine (E6).

## elapsedMs and parity (E5.13)

`elapsedMs` (`Date.now() - started`) is a **non-deterministic temporal field**. It
is NOT silently ignored: it is documented as a temporal, non-comparable field and
is the ONLY field excluded from the observable `solveModel_` equality. Every other
contractual field is compared EXACTLY: `status`, `stopReason`, `optimalityProven`,
`objective`, `values`, `nodesExplored`, `modelType`, `sense`, `variables`,
`labels`, `constraints`, `variableDomains`, `caveat`, `explanation`.

Parity: **3 direct** (`feasibleAt_`, `validModelShape_`, `finiteModel_` — canonical
== mirror) and **1 observable** (`solveModel_` — canonical == mirror excluding
`elapsedMs`, surfacing `isSatisfied_`/`explainStatus_`). The only approved
functional divergences remain `newContext_` and `readConstraint_`; a third
divergence must fail.

## Suites (E5.11 / E5.12)

Migrated 0, split 0. The status-bearing legacy suites drive the MIRROR
(`engine/engine.js`) end-to-end via the legacy `harness.js`
(`detectModel_`+`solveModel_`), so they reach E5 territory but through the add-on
twin; reconciling the mirror is E6. The new canonical E5 suites are the primary E5
coverage.

| suite | PASSED | entry point | phase reached | classification |
|---|---|---|---|---|
| tests_states | 3 | mirror engine.js (detect+solveModel_) | E5 (final statuses) | legacy temporal — mirror is E6 |
| tests_safety | 56 | mirror engine.js | E5 (statuses) | legacy temporal |
| tests_bounds | 12 | mirror engine.js | E3/E5 | legacy temporal |
| tests_single_var | 25 | legacy harness.js → mirror | E5 (end-to-end) | legacy temporal |
| tests_strict | 19 | legacy harness.js → mirror | E2 boundary | legacy |
| tests_sumif_criteria | 22 | legacy harness.js → mirror | E2 boundary | legacy |
| tests_locale | 29 | mirror engine.js | E2/E3 | legacy |
| tests_direction | 10 | composedHtml | integration | composedHtml |
| tests_examples | 143 | composedHtml | integration | composedHtml |
| tests_panel | 34 | composedHtml + mirror | integration | composedHtml |
| tests_grid_input | 43 | composedHtml + mirror | integration | composedHtml |
| tests_error_i18n | 134 | composedHtml | UI localisation | UI |
| tests_solve_announce | 23 | composedHtml | accessible announcements | UI |
| tests_worker_parity | 143 | composedHtml (Worker) | Worker | E6 |

No case was duplicated, no PASSED was lost, no expectation was changed.

## Fixture / checker / positive / negative / auditor

- **Fixture** `engine/fixtures/single-engine/engine-e5-verification-statuses.json`:
  PINNED_SHA, do_not_regenerate, full engine + mirror SHAs, E1-E4 fixture SHAs,
  exports, verification map, result schema, statuses (incomplete-is-UI-only),
  stop reasons, optimalityProven matrix, technical errors, status/error separation,
  continuous/integer/binary/mixed/incumbent/limit/verification cases, D-E5-1,
  D-E5-2, parity with the explicit elapsedMs treatment, divergences, suites,
  allowlist, metrics, provenance. No absolute paths, no timestamps, no sleeps, no
  full function bodies, no data regenerated during verify. Expected values are
  pinned literals, not derived from the running engine in the same run.
- **Checker** `checkCanonicalVerificationAndStatuses(siteDir)` → `{ pass, fail,
  failures }` (**70**). Dist-independent: reads only source/mirror/harness/fixture,
  never `dist/`. Runs the canonical functions through the harness; does not
  re-implement verification, does not derive `optimalityProven`, does not transform
  errors.
- **Positive** (**54**): structural contracts reuse the checker; value contracts
  drive `solveModel_`/`isSatisfied_`/`feasibleAt_`/`buildVariableDomains_` through
  the probe. No skip-as-pass, no dist dependency, no real-time dependency.
- **Negative** (**53** cases): each copies a temp tree, applies ONE mutation, runs
  the official checker/harness, asserts it trips, checks a specific functional
  message, cleans up in finally. Functional mutations key on a functional
  assertion, never on SHA alone; integrity cases key on the pinned-SHA / dist
  message from a closed allowlist.
- **Auditor** `tests_e5_needle_audit` (**116**): every case has a specific needle;
  functional mutations do not key on a bare hash; N1..N53 present; no Worker case as
  E5; no UI localisation as engine; no positive checker depends on dist; no skip
  counted as a pass; cleanup in finally; canonical actually used.

## Allowlist

`RAW_SOURCE_ALLOWLIST` stays **18** post-E5 (added 0, removed 0). No E5 harness,
checker, positive, negative, fixture or functional suite is in it; they use the
harness API, not raw source reads.

## Dist independence

E5 preserves the E4 dist-determinism correction. No E5 suite gates an assertion on
`existsSync(dist)` or reads `dist/solver.html`; the built-artefact byte-identity is
owned solely by `engine/validate_dist.js` during `npm run build`. The battery total
is identical with and without a prior build. `validate_dist` was **reviewed, not
modified** by E5: it still enforces dist == composed source, engine/source
not published, no `SOLVER_ENGINE_SOURCE`, structural markers present, six requests,
manifest and requiredPaths intact. E5 introduced no new public risk, so it added no
new validate_dist check.

## How to add a status case

Add a case to the fixture's `statuses`/`*_cases`, then add an assertion in the
checker that drives `solveModel_` through the probe and asserts the real
`status`/`stopReason`/`optimalityProven`/fields against pinned literals. Never add
`incomplete` as an engine status.

## How to add a verification case

Add a `verification_cases` entry to the fixture, then assert it in the checker by
calling the REAL function through the probe (`isSatisfied_` / `feasibleAt_` /
`buildVariableDomains_` / `isWhole_`) — never a parallel implementation. Add a
matching negative mutation keyed on the new functional needle, and register the
needle in the auditor's `functionalCases`.

## How to run

`node engine/tests_canonical_verification_statuses.js` (and `_positive`,
`_negative`, `tests_e5_needle_audit`), or the full battery via `npm run verify`.

## Rollback

Remove the four E5 suites from `engine/suites.js`, delete `engine/e5-exports.js`,
the four E5 suite files and the E5 fixture, and revert the E5 phase block in
`engine/canonical-engine-harness.js`. The engine, mirror and public output are
untouched, so no production rollback is needed.

## Pending E6

Worker Blob/glue/postMessage/stale/cancel/fallback; mirror reconciliation
(`engine/engine.js` as a derivative of the single source); accessible announcement
finalisation; the final golden and delivery. Checkpoint E is **not** complete.

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
