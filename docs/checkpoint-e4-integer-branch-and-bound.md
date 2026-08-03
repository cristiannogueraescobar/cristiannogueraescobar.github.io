# Checkpoint E4 — Canonical Integer, Binary, Mixed and Branch-and-Bound

## Metrics reconciliation (E3, mandatory pre-E4 step)

Before E4 the E3 increment was reconciled. The four E3 suites and their exact
`PASSED` counts:

| suite | PASSED |
|---|---|
| `tests_canonical_model_continuous` (checker) | 52 |
| `tests_canonical_model_continuous_positive` | 50 |
| `tests_canonical_model_continuous_negative` | 48 |
| `tests_e3_needle_audit` | 72 |

Sum = 52 + 50 + 48 + 72 = **222** = 10852 − 10630. The earlier "+224" came from
reporting the negative suite as "50 assertions"; its real `PASSED` is **48** (47
`expect*` helper calls N1..N47, each one `ok()`, plus the inline N48). No
assertion was added, removed, or replaced — only the prose figure was wrong, now
corrected. E2 stays 61/9/67/43; no legacy suite changed. The E3 total **10852**
is reproducible via `node engine/run_all.js`.

## Baseline and scope

E4 builds on the reconciled E3 baseline of **10852**. It makes canonical
**integer / binary / mixed solving** and **branch-and-bound** testable directly
against the production source (`engine/source/plumline-engine.js`) through the
canonical harness (E4 phase), without touching the engine, the mirror, constants,
tolerances, branching policy, variable selection, node order, tie-breaking,
pruning, limits, defaults, results, errors, statuses, stop reasons, or the public
output.

E4 is **structural and contractual**. Where a defect is found, the current
behaviour is characterised and pinned as a regression, documented, and classified
for a later phase — never corrected here.

## E4 boundary

**In scope:** integer variables, binary variables, mixed models, whole-number
detection, integer indices, branch-and-bound, branch-variable selection, branch
creation, branch bounds, the search tree, depth, node count, incumbent, pruning,
solution comparison, integrality, binary bounds, node limit, depth limit, the
branch-and-bound time limit, internal integer/mixed results, the full non-continuous
optimisation path, the dispatch contract from `optimise_`, and migration of any
applicable suites from the mirror to the canonical engine.

**Out of scope (E5/E6):** public status/stopReason semantics, independent
solution verification, final `optimalityProven` semantics, localised messages,
accessible announcements, UI, Worker glue/orchestration, stale-response handling,
Worker cancellation, mirror reconciliation/generation, algorithm changes, and
Checkpoint E5.

## Constants (confirmed intact)

`BRANCH_NODES 4000`, `BRANCH_DEPTH 60`, `BRANCH_MILLIS 20000`, `EPSILON 1e-9`,
`PIVOT_TOLERANCE 1e-7`, `MAX_ITERATIONS 20000`. `isWhole_` uses a literal
integrality tolerance of `1e-6` (NOT a named `ENGINE` constant). No value changed.

## Functions

Audited from the canonical source by real call graph.

**B — integrality (E4):** `isWhole_` (L276, `|v−round(v)| < 1e-6`).

**C/D/E/F/G/H — branch-and-bound (E4):** `solveIntegerProgram_` (L314). It runs a
recursive DFS `explore(extra, depth)`; the root relaxation is `solveLinearProgram_`
on the base constraints; the branch variable is the first index in `wanted` whose
relaxed value is not whole; the **ceiling** branch (`>= ceil`) is explored first,
then the **floor** branch (`<= floor`); the incumbent updates only when the snapped
exact-integer objective strictly improves; pruning is by bound, by proven
infeasibility (a dead end that keeps the search exhaustive), and by integrality;
limits are node (`> BRANCH_NODES`), depth (`> BRANCH_DEPTH`) and time
(`Date.now() > start + BRANCH_MILLIS`). Its outgoing calls are `solveLinearProgram_`,
`isWhole_`, `feasibleAt_`, `round_`, `dotProduct_`.

**A — shared integer/binary/mixed metadata (E3/E4):** `integerIndices_` (L266),
`buildVariableDomains_` (L220), `classifyModel_` (L193).

**E — node solver (reused from E3):** `solveLinearProgram_` (L417),
`feasibleAt_` (L296).

**D — dispatcher:** `optimise_` (L33). `integerIndices_` empty →
`solveLinearProgram_` (E3 continuous path); non-empty → `solveIntegerProgram_`
(E4 branch-and-bound path).

**Excluded (E5-E6, forbidden through the E4 harness):** `solveModel_` (E5
adaptation / final status), `describeModel_` (E5/UI presentation).

## Exports

`engine/e4-exports.js` is the single authority for the closed E4 list of **8**
functions: `solveIntegerProgram_`, `isWhole_`, `integerIndices_`,
`buildVariableDomains_`, `classifyModel_`, `solveLinearProgram_`, `feasibleAt_`,
`optimise_`. It is a SEPARATE closed set — not a copy of E2 or E3. The harness
serves E2 (24), E3 (22) and E4 (8) from one infrastructure via
`createCanonicalEngineHarness({ phase: 'e4' })`; it never merges the phases' export
sets. The harness rejects a missing export, an unknown name, an E5-E6 function, a
non-function, an undeclared alias, and any name outside the closed E4 list; it also
fails if E2 or E3 accidentally changes its count.

## Domain contract

`model.integer`: undefined → `[]` (continuous); `true` → all indices; array →
those indices. **Binary** is an integer index whose bounds are `lower===0 &&
upper===1`. **Mixed** has continuous variables alongside integer/binary, or both
binary and plain-integer variables. `classifyModel_(domains, wholeToggle, n)`
returns `continuous` / `integer` / `binary` / `mixed`. The default domain is
continuous, lower `0`, upper `null`. `buildVariableDomains_` produces the
per-variable receipt (metadata only; it does not solve).

## Integrality

`isWhole_(v) = Math.abs(v − Math.round(v)) < 1e-6`: exact integer → true; `3.0000001`
→ true; `3.5` → false; `−2` → true; `0` → true. Applied only to declared integer
indices; continuous variables are not integrality-checked.

## Binary

Binary requires bounds `{lower:0, upper:1}`, folded by `applyBounds_` (E3). A
fractional binary value is branched like any integer. All-binary integer vars →
`binary`; binary + plain integer → `mixed`; binary + continuous → `mixed`.

## Branch-and-bound (real implementation)

Node representation is the recursion `explore(extra, depth)`, where `extra` is the
accumulated branch constraints and `depth` is the tree depth. Traversal is DFS.
Order is **ceiling first**, then floor. The branch variable is the first fractional
index in `wanted` order. The incumbent starts `null` and updates only when the
snapped exact-integer objective strictly improves (`> best+EPSILON` maximise, `<
best−EPSILON` minimise). Snapping is `Math.round(v*1e9)/1e9` then `Math.round` on
integer indices, re-checked with `feasibleAt_`. Pruning: by bound (`!better
return`), by proven infeasibility (dead end, search stays exhaustive), and by
integrality (a whole relaxation is a candidate, not a branch point). A branch that
resolves to anything other than optimal/infeasible marks the search non-exhaustive
and records a `stopReason`.

## Traversal cases (pinned, deterministic)

I1 integer 1 var max 5x st 2x≤7 → optimal 15 [3] nodes 3; I2 already integral max
3x+2y st x+y≤4 → optimal 12 [4,0] nodes 1; I3 fractional relaxation max x+y st
2x+2y≤5 → optimal 2 [0,2] nodes 13; I4 `integer:true` → optimal 15 [3]; I5 integer
infeasible (x≥2 and x≤1) → infeasible nodes 1; I6/I7 max/min integer; B1 binary 1
var max 5x {0,1} → optimal 5 [1] nodes 1; B2 binary knapsack max 6a+5b st 3a+3b≤4
→ optimal 6 [1,0] nodes 5; M1 mixed x continuous + y integer max x+10y st x+y≤3.5
→ optimal 30.5 [0.5,3] nodes 3.

## Limits (deterministic, no real wait)

Node: `nodes > BRANCH_NODES(4000)` → non-exhaustive, `node_limit`. Depth: `depth >
BRANCH_DEPTH(60)` → `node_limit`. Time: `Date.now() > start + BRANCH_MILLIS(20000)`
→ `time_limit`. Per-node LP is capped by `MAX_ITERATIONS(20000)`. A limit reached
WITH an incumbent yields `feasible` (optimalityProven false); WITHOUT an incumbent
yields `unknown`. The time-limit branch is tested with a `Date.now()` **stub** that
returns a base time then a value past the deadline — it reaches the exact deadline
branch with no real 20-second wait and no production change, so the tests are not
flaky. Pinned: L1 time_limit without incumbent → unknown/time_limit nodes 1; L2
time_limit with incumbent → feasible obj 2 nodes 13; L3 normal model → optimal.

## Internal result contract

`{ status, stopReason, optimalityProven, nodesExplored, objective, values,
nodes }`. Internal statuses: `optimal` (exhausted + incumbent), `feasible`
(incumbent + limit), `infeasible` (exhausted, no incumbent), `unknown`
(non-exhausted, no incumbent). `nodesExplored` is undefined on the continuous path.
These are INTERNAL contracts; the public status/stopReason/optimalityProven
semantics remain E5 and are not redefined here.

## Suites — migrated and legacy

**Migrated: 0. Split: 0.** The E4 migration is the set of NEW canonical E4 suites
that exercise integer/binary/mixed + branch-and-bound directly through the harness.
No legacy suite was migrated or split:

- `tests_bounds.js` — calls `optimise_` directly but mixes continuous (E3) and
  `integer:[...]` (E4) cases with assertions on final solve output (E5-adjacent);
  the boundary is not clean without splitting, and the E4 contracts are already
  covered canonically. Kept legacy.
- `tests_safety.js` — exercises branch-and-bound safety limits but asserts final
  statuses (`feasible`, `numerical_failure`, E5-adjacent). Kept legacy.
- `tests_single_var.js` — `run()` reaches `solveModel_` end-to-end incl.
  final-status semantics (E5). Kept legacy.
- `tests_states.js` (E5 statuses), `tests_worker_parity.js` (E6 Worker),
  `tests_direction/examples/panel/grid_input` (composedHtml integration),
  `tests_strict/sumif_criteria/locale` (E2/E3 boundary via `run()`) — kept legacy.

The new canonical E4 suites constitute the primary E4 coverage. No legacy
assertion was reduced, and no expectation was changed to make parity pass.

## Parity (canonical ↔ mirror)

The canonical source is the authority. The mirror exposes `optimise_`,
`classifyModel_`, `loadGrid_` and `detectModel_`, but **not** `isWhole_`,
`solveIntegerProgram_` or `integerIndices_`. So:

- **Direct** parity: `classifyModel_` (1 case set across continuous/integer/binary/
  mixed inputs).
- **Observable** parity: `optimise_` over integer, binary-knapsack and mixed models
  (3 cases). This is where `isWhole_`/`solveIntegerProgram_`/`integerIndices_`
  parity surfaces — through identical branch-and-bound results.

Inputs outside the two approved divergences (`newContext_`, `readConstraint_`) must
be exactly equal; a third divergence must fail. The mirror is never modified to
force parity, and `nodesExplored`/`stopReason`/`optimalityProven`/values order/
constraints order/errors are never dropped.

## Fixture, checker, suites, auditor

- **Fixture:** `engine/fixtures/single-engine/engine-e4-integer-branch-and-bound.json`
  pins the engine SHA, the mirror SHA and the E1/E2/E3 fixture SHAs, plus the E4
  export list/categories, forbidden set, constants, domain/integrality/binary
  contracts, node schema, traversal order, branch selection, floor/ceil
  construction, incumbent, pruning, limits, result schema, integer/binary/mixed/
  limit cases, classification cases, continuous bypass, suites, parity, divergences,
  harness/stubs, allowlist, provenance, `PINNED_SHA` and anti-regeneration. No
  absolute paths, no timestamps, no function bodies, no time-dependent data.
- **Checker:** `checkCanonicalIntegerAndBranchAndBound(siteDir)` →
  `{ pass, fail, failures }` in
  `engine/tests_canonical_integer_branch_and_bound.js`. It runs the canonical
  source through the official harness and probe; it never re-implements
  branch-and-bound. It is **dist-independent**: it reads only the canonical source,
  the mirror, the harness and the fixture — never `dist/` — and returns the same
  pass count with or without a prior build. The public-output byte-identity is a
  build-only contract owned by `validate_dist`.
- **Positive:** `engine/tests_canonical_integer_branch_and_bound_positive.js`.
- **Negative:** `engine/tests_canonical_integer_branch_and_bound_negative.js` — 52
  cases; each mutates a temp tree, runs the official harness/checker, fails by the
  declared contract with a specific needle, and cleans up in `finally`. Functional
  engine mutations key on a functional assertion (verified: none rely on the SHA
  message alone); integrity cases (N42, N48-N51) may key on the pinned-hash message.
- **Needle auditor:** `engine/tests_e4_needle_audit.js` — every case has a specific
  needle; functional mutations key on a functional assertion, not the pinned-hash
  message; no case points at the mirror while claiming canonical; no E5 function is
  presented as an E4 contract.

## Allowlist

`RAW_SOURCE_ALLOWLIST` stays at **18** (post-E1 18, post-E2 18, post-E3 18, post-E4
18). No E4 harness, functional suite, checker, positive, negative, or fixture is a
raw reader; none were added or removed.

## Metrics

| item | value |
|---|---|
| E3 baseline (original, with dist) | 10852 |
| E3 baseline (adjusted, deterministic) | **10849** |
| E3 baseline adjustment | −3 |
| E4 total | **11099** |
| E4 increment (net) | **+250** |
| checker | 55 |
| positive | 55 |
| negative | 52 cases / 52 assertions |
| needle auditor | 88 |
| E2 / E3 / E4 exports | 24 / 22 / 8 |
| E4 functions excluded (E5-E6) | 2 |
| direct / observable parity | 1 / 3 |
| approved divergences | 2 |

### Dist-determinism reconciliation (11095 vs 11104)

`npm run verify` runs the full battery (`run_all.js`, step 1-2) **before** the
build (step 6). Five suites gated a `dist/solver.html byte-identical` assertion on
`fs.existsSync(distSolver)`, so a first verify from a clean checkout (no dist)
skipped them (**11095**) while a second verify (dist present from a prior build)
counted them (**11104**). The nine assertions:

| suite | sin dist | con dist | diff | category |
|---|---|---|---|---|
| tests_canonical_engine_source | 46 | 50 | 4 | A (E1 composition) |
| tests_canonical_engine_source_positive | 9 | 11 | 2 | A (E1 composition) |
| tests_canonical_integer_branch_and_bound | 55 | 56 | 1 | B (built artefact) |
| tests_canonical_model_continuous | 51 | 52 | 1 | B (built artefact) |
| tests_canonical_parser_frontend | 60 | 61 | 1 | B (built artefact) |

**Category A (6 assertions, E1 composition):** ENGINE_START/END markers, no
SOLVER_ENGINE_SOURCE, no canonical path, six requests, source not published. These
now use the composed output from the OFFICIAL compositor (`composeSolverInterface`,
which E1 already computes from `solver.html` and is allowlisted to read for exactly
that composer contract). They run always, dist or not. E1 counts with dist were
already 50/11 in the baseline, so E1 does NOT change the total-with-dist and does
NOT affect the E3 baseline.

**Category B (3 byte-identity assertions):** the `dist/solver.html byte-identical`
assertions in `tests_canonical_parser_frontend`, `tests_canonical_model_continuous`
and `tests_canonical_integer_branch_and_bound` were REMOVED from the normal suites;
that contract is owned solely by `engine/validate_dist.js` (assertion "dist matches
expected (composed) source: solver.html", run during `npm run build`). It is
**three**, not four — an earlier note said "four" and was wrong.

**Two skip-as-pass branches removed (separate from Category B):** P48
(`tests_canonical_model_continuous_positive`) and P54
(`tests_canonical_integer_branch_and_bound_positive`) were `else { ok(..., true) }`
skips that counted a skip as a pass. Both assertions were REMOVED (not substituted,
not left as a skip); their byte-identity contract is owned by validate_dist. P49/P55
(checker-independent-of-dist) remain as real deterministic assertions.

**Net effect (5 count changes):**

| suite | PASSED before (with dist) | PASSED after | diff | contract removed | authority now |
|---|---|---|---|---|---|
| tests_canonical_parser_frontend | 61 | 60 | −1 | dist byte-identical (Cat B) | validate_dist |
| tests_canonical_model_continuous | 52 | 51 | −1 | dist byte-identical (Cat B) | validate_dist |
| tests_canonical_model_continuous_positive (P48) | 50 | 49 | −1 | skip-as-pass branch | validate_dist |
| tests_canonical_integer_branch_and_bound | 56 | 55 | −1 | dist byte-identical (Cat B) | validate_dist |
| tests_canonical_integer_branch_and_bound_positive (P54) | 56 | 55 | −1 | skip-as-pass branch | validate_dist |

Three of these lower the **E3 baseline** (parser −1, model_continuous −1, P48 −1 →
10852 − 3 = **10849**); two lower the **provisional E4 count** (integer checker
56→55, P54 56→55). E4 suites final: 55 + 55 + 52 + 88 = **250**. Total =
10849 + 250 = **11099**, identical with and without dist (verified by running the
full battery both ways). The `tests_needle_audit` suite already enforces that no
positive checker gates an assertion on `existsSync(dist...)`.

## Known behaviours

The continuous `Infinity`-bound case still returns `numerical_failure` via
`finiteModel_` (characterised in E3, unchanged). Branch-and-bound behaviours above
are pinned as-is; none were corrected.

## How to add an integer case

Add the model to the checker (or a positive assertion), drive it through
`optimise_` via the probe, and assert the internal integer result. Keep the
declared integer indices, do not introduce a new tolerance, and do not correct a
numeric result. Pin any new stable characterisation in the fixture.

## How to test limits without flakiness

Use a `Date.now()` stub: return a base time for the first N calls, then a value
past `start + BRANCH_MILLIS`. Choosing N controls whether the search stops before
any incumbent (→ `unknown`) or after one (→ `feasible`). Never use a real wait, and
never change production timing.

## Rollback

Remove the four E4 suites from `engine/suites.js`, delete `engine/e4-exports.js`,
`engine/tests_canonical_integer_branch_and_bound*.js`, `engine/tests_e4_needle_audit.js`
and the E4 fixture, and revert the E4 phase additions in
`engine/canonical-engine-harness.js`. The engine, the mirror and the public output
are untouched by E4, so rollback is test-only.

## Pending (E5-E6)

Final public status/stopReason semantics, `optimalityProven` semantics,
independent solution verification and localised messages remain E5. Worker
orchestration and mirror reconciliation remain E6. **Checkpoint E is not complete.**


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
