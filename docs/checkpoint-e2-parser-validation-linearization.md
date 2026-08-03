# Checkpoint E2 — canonical parser, references, validation and linearisation contracts

E2 makes the mathematical FRONT-END (references, ranges, tokeniser, parser/AST
forms, SUM/SUMIF, comparison + SUMIF criteria, syntactic validation, linearity
detection, linearisation, coefficient extraction) run DIRECTLY against the
canonical production source through a `vm` harness — not only against the legacy
mirror. E2 is structural and contractual: it changes NO engine byte, no parser,
no operator, no literal, no error, no tolerance, no result, no order, no name, no
parameter, no return, no logic. **Checkpoint E is NOT complete after E2.** No
mathematical improvement was implemented; the current behaviours below are
COMPATIBILITY CHARACTERISATIONS, not endorsements.

## Allowlist reconciliation (17/18)

Computed from `.git`: the allowlist at the base commit `2832526…` is **17**. An
earlier summary said "18 pre-E"; that was the **post-E0** count (17 +
`tests_engine_baseline.js`, added by E0). Progression: pre-E **17** → post-E0
**18** → post-E1 **18** → **post-E2 18** (unchanged — the harness and the E2
suites use a normal API, not raw reads).

## Export reconciliation (22 → 24)

An earlier report said the epilogue exported 22 functions but the closed list had
24 names. Reconciled programmatically: **24 requested == 24 exported**, all
functions, 0 missing, 0 extra, 0 non-function, 0 undeclared alias. The "22" was
the count BEFORE the two shared context builders (`loadGrid_`, `newContext_`)
were added to feed the front-end functions. The closed list now lives in ONE
authority module, `engine/e2-exports.js`, reused by the harness, checker, fixture
verification, tests and docs.

## Harness architecture

`engine/canonical-engine-harness.js` loads ONLY
`engine/source/plumline-engine.js` in a `vm` context and appends a test-only
export epilogue exposing the closed list. It never modifies the source, never
copies a body, never uses `engine/engine.js`, never reads `solver.html` or
`dist`, gives each call a fresh context, and works from spaced paths on
Windows/Linux. Guards: it rejects an E3-E5 name, an unknown name, a non-function
export, and an undeclared alias (two names → the same function); the epilogue
throws if a requested function is missing.

Documented environment stubs: `console` (no-op; tests never assert on logs), the
standard globals (`Math`, `Date`, `JSON`, `Number`, …; native semantics), and
`sheetStub` (supplies formulas/values as 2-D arrays to `loadGrid_`; the engine's
own loader does all shaping/normalisation, so the stub adds no math or parsing).
None changes any tested behaviour.

## E2 functions (24, closed list)

References/addresses/columns/rows: `cellAt_`, `parseAddress_`, `columnIndex_`,
`columnLetter_`, `referencedCells_`, `listFormulaCells_`. Ranges: `expandRange_`,
`expandReference_`. Grid-cell/locale/normalisation: `isFormulaInput_`,
`formulaCellText_`, `classifyGridCell_`, `detectLocale_`, `normalizeFormula_`,
`normalizeValue_`. Comparison/SUMIF criteria: `compareValues_`,
`parseCriterionOperand_`, `matchesCriterion_`. Tokeniser/parser/AST-forms:
`tokenize_`, `linearize_`, `safeLinearize_`. Linearity/coefficients:
`candidateIsLinear_`, `coefficientVector_`. Shared context builders (class G, the
engine's own constructors): `loadGrid_`, `newContext_`.

### Mixed / excluded (E3-E5, NOT exposed)

`detectModel_`, `solveModel_`, `solveLinearProgram_`, `optimise_`, `pivot_`,
`classifyModel_`, `buildVariableDomains_`, `feasibleAt_`, `readConstraint_`,
`finiteModel_`, `validModelShape_`, `senseFor_`. Exposing any of these would force
simulating model construction or the solver.

## Grammar BY LAYER

The layer matters — a blanket "strict `<`/`>` unsupported" would be wrong.

- **Tokeniser (general formula parser)**: `.5` is REJECTED (`unsupported syntax
  near`); `1e3` is NOT scientific — it tokenises as number `1` + ref `E3`;
  `<=`/`>=`/`=` tokenise as punct; strict `<`/`>` tokenise as punct (not rejected
  here).
- **SUMIF criteria parser** (separate): `.5` → `0.5`; `1e3` → `1000`; `+10` →
  `10`; `20.0` equals `20`; `>10` stays the string `>10`.
- **`compareValues_` (internal operator evaluation)**: evaluates strict `<`/`>`
  (`5<10` true, `5>10` false) and `<=`/`>=`/`=`.
- **Constraint reading + final validation (E2/E3 boundary)**: a strict `<`/`>`
  used as a RELATION is rejected with `STRICT_INEQUALITY:`; `<=`/`>=`/`=` are
  supported; `</>` are NOT accepted as substitutes.

Supported functions: `SUM`, `SUMPRODUCT`, `IF`, `SUMIF` (plus constant-only
`CONSTANT_FUNCTIONS` like `MIN`/`MAX`). **`COUNTIF` is NOT implemented or
announced.**

## Errors (front-end)

`bad cell reference "…"` (parseAddress_), `unknown comparison …`
(compareValues_), `unsupported syntax near "…"` (tokenize_), `unexpected token …`
/ `unexpected end of formula` / `a range is only valid inside SUM or SUMPRODUCT`
(parser), `expected …` (consume_), `a comparison involves a decision variable`,
`unsupported function …`, `SUMPRODUCT ranges have different sizes`, `IF() tests a
decision variable`, `the SUMIF criterion depends on a decision variable`,
`reference cycle or too deep` / non-linear var*var / division-by-variable /
`division by zero` (linearize_ and form ops), `STRICT_INEQUALITY: …` (constraint
layer), and `safeLinearize_` wraps any cell failure as `<cell> could not be read
as a number or a linear expression of …`.

## References, ranges, linearisation, vectors

`parseAddress_('A1')` → `{column:1,row:1}`, `'AA10'` → `{column:27,row:10}`;
`columnIndex_`/`columnLetter_` are 1-based. `expandRange_('A1:B2')` is row-major
→ `['A1','B1','A2','B2']`. `linearize_('=2*A2+3*A3')` →
`{constant:0,terms:{A2:2,A3:3}}`; `coefficientVector_` returns coefficients in the
requested variable order (`[A2,A3]`→`[2,3]`, `[A3,A2]`→`[3,2]`). `var*var` and
`x/var` are non-linear → error. `SUMIF(A2:A4,'>15')` over `[10,20,30]` folds to
`{constant:50,terms:{}}`.

## Suites: migrated vs legacy (audited by real call graph)

`harness.js run()` calls `detectModel_` AND `solveModel_` end-to-end, so every
suite built on `run()` reaches E3 model construction + the solver and is NOT pure
front-end. The E2 migration is therefore the NEW canonical suites; the four
legacy candidates stay legacy:

| suite | run() | reaches | classification | reason |
|-------|-------|---------|----------------|--------|
| tests_strict.js | 16 | detectModel_+solveModel_ | C legacy (E3) | strict rejection is a constraint-layer contract; migrating forces exposing detectModel_/readConstraint_ |
| tests_sumif_criteria.js | 3 | detectModel_+solveModel_ | C legacy (E3) | full models; pure criteria contracts already covered by the E2 checker + an observable parity probe |
| tests_locale.js | 11 (+3 direct) | mixed | C legacy (no clean split) | cases mix direct locale calls with run(); a split would be artificial; locale contracts covered by the E2 checker |
| tests_single_var.js | 25 | detectModel_+solveModel_ | C legacy (E3) | single-variable MODEL classification is entirely E3 |

No suite was migrated or split (`migrated_count = 0`, `split_count = 0`); no
assertion count dropped and no expectation was changed. Composed-html integration
suites (`tests_direction`, `tests_panel`, `tests_grid_input`, `tests_examples`)
stay as integration.

## Parity matrix (honest)

The mirror exposes only 20 entry points; the pure front-end functions are not
among them, so parity is anchored at `loadGrid_` (direct) and `detectModel_`
(observable). `detectModel_` is used ONLY as an observable E2/E3-boundary probe —
NOT exposed through the E2 harness, NOT a migrated E2 function, NOT the checker's
parser authority.

| id | canonical | mirror | kind | input | result |
|----|-----------|--------|------|-------|--------|
| P1 | loadGrid_ | loadGrid_ | direct | 3×2 grid | identical grid shape + normalisation |
| P2 | detectModel_ (probe) | detectModel_ | observable | strict-< constraint | same model/error |
| P3 | detectModel_ (probe) | detectModel_ | observable | SUMIF criteria | same model/error |
| P4 | detectModel_ (probe) | detectModel_ | observable | locale eu decimal | same model/error |

Approved divergences remain `newContext_` and `readConstraint_`; a third
divergence must fail. The mirror is never modified to force parity, and
`engine/engine.js` is untouched.

## Fixture, checker, negatives, auditor

- Fixture `engine/fixtures/single-engine/engine-e2-front-end.json` — full hashes,
  reconciled export count, layered grammar, errors, contracts, parity matrix,
  suite classification, stubs, provenance, `do_not_regenerate`, no absolute
  paths, no function bodies.
- Checker `checkCanonicalParserFrontEnd(siteDir)` (61 assertions) — the ONE
  authority; harness canonical-only, closed list, clean state, layered grammar,
  references/ranges, operators, SUM/SUMIF/criteria, linearisation/vectors,
  observable parity, no third divergence, engine SHA `5d68ed17…` intact, public
  output intact. Both the positive and the negatives use it.
- Positive (9), negatives (34 cases / 67 assertions), needle auditor (43).

## RAW_SOURCE_ALLOWLIST

post-E1 **18** → post-E2 **18** (unchanged). The harness needs no raw entry, the
E2 suites use a normal API, and no negative is in the allowlist. A raw entry is
valid only to check source markers, composition, or physical integrity.

## validate_dist

Reviewed; unchanged in E2. It still enforces every E1 contract:
`engine/source` not published, no `plumline-engine.js` in dist, no
`SOLVER_ENGINE_SOURCE` marker, engine byte-identical, D fragments not published,
six requests, manifest and requiredPaths intact. E2 introduces no new public
risk, so no new logic was added.

## How to add an E2 case

Add the function name to `engine/e2-exports.js` (only if it is a real front-end
function), load it via `loadCanonicalEngine`/`freshEngine`, build a grid with
`gridFromArrays`, and assert against the canonical behaviour. Run `node
engine/tests_canonical_parser_frontend.js` (and the positive/negative). Do NOT
add an E3-E5 function; the harness rejects it.

## Rollback

E2 is additive and reversible without touching E0/E1: delete the harness,
`e2-exports.js`, the E2 fixture/checker/positive/negative/auditor, and unregister
them from `engine/suites.js`. Nothing in production, the canonical source, the
mirror or the public output changes.

## Still pending (E3-E6)

E3 model construction / bounds / domains / continuous simplex; E4
branch-and-bound / integer / binary / mixed / limits; E5 verification / states /
stop reasons / errors; E6 Worker / fallback / **mirror reconciliation** / error
accessibility / final golden / ZIP.


## Update: E3 implemented

Checkpoint E3 has since made canonical model construction and continuous solving run directly against the canonical source through the harness (E3 phase, closed 22-function export list, continuous simplex/bounds/domains/parity contracts). A fully-continuous model never enters branch-and-bound. No engine byte, mirror byte, or public output changed; engine/engine.js is still the legacy mirror; branch-and-bound (E4), final statuses (E5) and Worker/mirror reconciliation (E6) remain pending. See docs/checkpoint-e3-model-construction-continuous-simplex.md. Checkpoint E is not complete.


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
