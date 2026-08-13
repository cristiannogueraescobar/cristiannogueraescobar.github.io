# Checkpoint F7a — Examples 9 -> 24 (final)

This is the complete F7a story: the growth of the worked-examples catalogue from the 9 historical
examples inherited from F6 to the final, frozen set of 24. It records every design decision,
correction, permanent contract and validation that produced the final F7a state. Node 24 final
acceptance is a requirement, NOT a claim: this document does not assert Node-24 acceptance.

## Baseline (post-F6)

The diff authority is the integrated post-F6/pre-F7a tree, reconstructed by applying the full
approved ready-to-copy overlay chain in phase order (F2 -> F3a -> F3b -> F3c -> F4a -> F4b ->
F4c -> F5 -> F6) over the base tree. It is gated by 11 sentinels (6 F6 + 5 F5) before any diff.

The final approved F5 package (97,709 bytes, SHA-256
1fd7125ecec88920abe6d79575a1071d6c428ed52801c53eb61db02adbcfb15c) is the historical authority for
the two architecture test files. Their approved historical versions are
tests_f5_examples_architecture.js e18ab8ab6b90... and
tests_f5_examples_architecture_negative.js 4cb3dae7b405..., inherited unchanged by post-F6 and
used by the final F7a A/M/D baseline. (An earlier intermediate checkpoint, 20260809-185042, held
different byte-versions 6094ebcc.../ca1f6665... of those two files, but that checkpoint is not the
approved F5; the approved F5 versions above are authoritative.)

## Phase 1 — mathematical design

Fifteen new optimisation examples were designed across all model families: continuous, integer,
binary and mixed. Each was specified as a spreadsheet model (decision cells, an objective formula
row, and constraint rows) solvable by the real engine, with a canonical expected status,
model type and objective.

## Phase 1 — corrections

Design-review corrections were applied to the fifteen models before integration (objective and
constraint formulations, sense, and expected-vector fixes) until each solved to the intended
canonical result under the real engine. No historical model, objective, policy or translation was
touched.

## 15 approved engine objectives

The fifteen approved canonical objectives were frozen (e.g. bakery-mix 375, factory-batches 2370,
fleet-assignment 355, ingredient-sourcing 5135, lp-basics 430; scholarships and the remaining
examples per the catalogue audit). These are pinned in the tranche baseline and verified by the
real engine.

## Phase 2 — canonical integration

The fifteen examples were integrated into the catalogue and metadata as authored records, wired
through the F5 canonical loader and the F6 generation path, keeping the nine historical keys in
their original order and as bare identifiers, with the fifteen F7a keys double-quoted.

## 9 -> 24 growth

The catalogue grew from 9 to exactly 24 records. The literal 24 appears only in the F7a checkpoint
assertion; all generic infrastructure is count-agnostic (derives from catalogue.length).

## Translations EN/ES/PT/DE/FR

Every F7a example carries complete title and description translations in all five locales
(English, Spanish, Portuguese, German, French), plus the authored content (question/goal) in the
same five locales. Coverage is validated per record.

## F5 count-agnostic loader correction

The F5 loader was corrected to be count-agnostic: it validates and loads whatever the catalogue
contains rather than assuming nine records, so 24 loads through the same path as 9.

## F5 count-agnostic projection correction

The F5 examples projection (categories, model-type option counts, i18n literal projections) was
made count-agnostic, deriving all counts from the loaded catalogue.

## Count-agnostic META regeneration

The generated META / page-head projections regenerate from the count-agnostic catalogue rather
than a hard-coded nine.

## Serializer hyphen-key fix

The serializer was fixed to quote hyphenated record keys (e.g. "bakery-mix") when emitting the
catalogue, with a regression guard so an unquoted hyphenated key fails.

## fieldOrder serialization contract

A per-record fieldOrder contract was added and frozen so the authored field ordering of each
record is pinned; a reversed fieldOrder trips the tranche.

## F6 automatic generation

The F6 examples-library generation path produces the runtime payload automatically from the
integrated catalogue, with no manual card authoring.

## 24 cards

The generated library renders exactly 24 example cards, one per catalogue record.

## Category population

All 10 categories are populated (production-operations, blending-formulation, marketing-finance,
workforce-scheduling, logistics-transport, purchasing-suppliers, education-social,
energy-sustainability, hospitality-retail, learning-engine).

## JSON-LD

The examples page JSON-LD regenerates to describe all 24 examples and is pinned against a golden.

## Digest 6c4f65550533

The generated examples-library payload carries a deterministic content digest; the current frozen
value is 6c4f65550533 (the cache-busting version on the examples.html script reference).

## Phase 3 — historical-suite reconciliation

The historical permanent suites were reconciled to the count-agnostic rule: generic assertions use
catalogue.length; the F7a checkpoint uses === 24; the historical nine remain first and intact.

## Solver golden c-2 migration

The solver-UI golden was migrated to a count-agnostic canonical block (class c-2) via a
count-agnostic canonicaliser with a stable sentinel, applied across the D1-D5 fixtures. Legacy
authority SHAs were unchanged; only the approved canonical block was added (D5 re-pinned solely
for that block).

## Historical provenance source

The canonical block was DERIVED from an independent historical post-F6 (9-example) composed solver
text (solver-ui-golden-historical-source-f6.json), not from the composer under test.

## Canonical solver UI separation

Separation suites prove EXAMPLES data cannot forge protected solver-UI goldens, and that canonical
engine goldens come from independent sources (A/B/C/D provenance).

## Solver catalogue projection contract

A projection contract pins how the solver consumes the catalogue (slug + model projection), so
catalogue drift is caught at the solver boundary.

## E1 migration

The E1 golden-separation migration was completed (EXAMPLES-only vs protected-UI scenarios).

## Tranche protection

A 15-record tranche baseline freezes each F7a record: slug, model type, result policy, objective,
modelHash, fieldOrder, category, difficulty, minutes, tags, direction, status, translations SHA,
content SHA and exact decisions. A negative suite mutates each frozen field in a real record and
requires tranche failure.

## metadataSha256

Each tranche record additionally pins metadataSha256 over the COMPLETE authored metadata record
via a deterministic recursive key-sorting canonicaliser, freezing schemaVersion, audiences,
provenance, capabilities, related and every other authored field. Negative mutations of
capabilities and related require tranche failure.

## Append-only proof

A permanent suite appends a valid synthetic 25th record and proves the F7a tranche historical
baseline STILL passes (the 15 are untouched) while the checkpoint total-count contract (=== 24)
FAILS. This proves F7b can append without re-pinning F7a.

## Browser verification

The browser suite, over the built dist, solves one representative per model type plus lp-basics,
reads the actual visible solve-details Status row (requires Optimal) and the visible objective
value (numeric, tolerant, against the canonical objective), and requires the lp-basics
feasible-region chart to be visible.

## Real search verification

The search suite exercises the real F6 search path: every F7a record is findable by title,
question and tag in all five locales, accent-insensitively; negatives prove a nonsense token finds
nothing and that search discriminates by field.

## Negative coverage

A coverage matrix maps every required negative dimension to its suite and exact mutation: count
drift, duplicate/invalid records, per-field tranche drift, type-vs-engine mismatch, wrong
objective, wrong exact vector, tolerance band, nonlinear construction, strict inequality,
unsupported function, stale cards/category counts/JSON-LD/payload digest/i18n/META, F6 CSS/core/UI
mutation, F5 semantic/core mutation, search failure and lp-basics chart-eligibility loss.

## Windows portability

All scripts and suites use only Node built-ins (fs.cpSync/rmSync/mkdtempSync, execFileSync with
process.execPath) and never shell utilities, so they run on Windows PowerShell. A portability suite
guards this.

## A/M/D

Against the integrated post-F6 baseline (382 files) the final work tree (412 files) is
ADDED 30, MODIFIED 50, DELETED 0. The Phase-4 A/M/D adds this checkpoint document and
docs/f7a-example-catalogue-audit.md to the added set (28 -> 30). The five F5 files (architecture, architecture_negative,
behavioural, baseline.json, metadata.js) are historical baseline files and therefore MODIFIED.

## verify/build determinism

npm run verify runs ALL GREEN twice with an identical real total; npm run build produces a
deterministic identical dist twice. (Exact totals and digests are reported in the final report.)

## Node 24 final acceptance requirement

The final acceptance runtime is Node 24.15.0; the working environment here is Node 22.22.2. The
engines guard (">=24.15.0 <25") is intact. Node-24 acceptance is a REQUIREMENT and is NOT claimed
in this checkpoint.

## Rollback

The change set is a pure overlay over the integrated post-F6 tree with zero deletions, so rollback
is removing the 30 added files and restoring the 50 modified files to their post-F6 versions. No
historical model, objective, policy or translation was altered.

## Work explicitly deferred to F7b

The following are explicitly OUT of F7a and deferred to F7b: growing the catalogue beyond 24
(the append-only proof establishes that F7b may append without re-pinning F7a); any change to the
24-example product state; and any Phase-4/UX redesign of the examples or solver surfaces beyond the
catalogue-projection / golden-separation / serializer changes already required by F7a.
