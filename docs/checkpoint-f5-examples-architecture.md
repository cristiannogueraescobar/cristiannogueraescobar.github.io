# Checkpoint F5 — Canonical examples architecture

F5 turns the nine built-in examples from "just enough data to load a model" into a
single, versioned, rigorously validated canonical source that can carry 60+ real
examples in F7. F5 builds the ARCHITECTURE only. It does NOT build the new gallery
(that is F6), does NOT create the 51 new examples (F7), and does NOT redesign
Examples, the Solver or Home.

## 1. Baseline
Integrated post-F4c tree: 14,560 tests, VERIFY ALL GREEN, deterministic build
(dist/index.html 4ec4fe2f..., dist/solver.html 36bfb88d...), five real locales
(en/es/pt/de/fr), nine public examples, F4a/F4b/F4c closed and protected, engine/
Worker/mirror working, public production without the F6/F8/F9/F10 redesigns.

## 2. Current catalogue audit
The F1 architecture already exists: src/shared/examples/{catalogue,schema,
serialize,projectors,index}.js. catalogue.js is the single editable authority; the
solver EXAMPLES object, assets/i18n.js example keys, examples.html JSON-LD,
assets/examples-data.js and Home references are PROJECTIONS. Each of the nine
records owns key, slug, category (legacy UI grouping start/business/binary), type,
sense, five-language translations (title+desc), model (grid + optional domains/
whole/openVarSettings/fieldOrder) and an expected contract (status/modelType/
objective/tolerance).

## 3. Public compatibility audit
Public slugs are contracts: solver.html?ex=<slug> for all nine. The current public
output (examples-data.js, examples.html, solver EXAMPLES) must not change. F5 keeps
the F1 catalogue byte-identical and adds an editorial metadata layer alongside it,
projecting the same legacy shape.

## 4. External research
Sources studied (principles only, no schema/UI/branding copied):
- Rows templates — categories independent of content, discovery metadata separate
  from template content, individual pages, related templates.
- Quadratic use-cases/templates — use-oriented categories, the real sheet as the
  central object, variety under a stable taxonomy.
- Schema.org — studied only for FUTURE interoperability. The internal Plumline
  schema is NOT a Schema.org mirror; F11 will project to JSON-LD later. Internal
  architecture and SEO architecture stay decoupled.

## 5. Architecture
The canonical example is assembled from three physical layers by responsibility,
with exactly one source per fact (author once, derive whenever possible):
- F1 catalogue.js  — identity (key/slug), model, expected contract, base title/desc.
- F5 metadata.js   — authored classification + editorial content + result policy + SEO.
- F5 derive.js     — derived facts (modelType, counts, functions, bounds, chart,
                     number format) computed from the model; never authored.
Assembled by src/shared/examples/f5/assemble.js; loaded+validated+frozen by
src/shared/examples/f5/index.js (loadCanonical). Projections:
canonical -> validator -> derived facts -> legacy projector -> future library
projector (search/facets) -> future SEO projector (F11).

## 6. Source of truth
One unambiguous canonical assembly (loadCanonical). No duplicated catalogue,
metadata, result, translations or public data. Physical split by responsibility is
not duplication: each fact has exactly one home.

## 7. Schema version
Each metadata record carries schemaVersion: 1 (enums.SCHEMA_VERSION). The validator
rejects any other version with a clear error. A future v2 migration would add a
versioned validator branch and a small migrate() step; F5 only establishes the
contract, not a migration framework.

## 8. Identity
Immutable machine ID (key) + stable public slug, both unique, slug lowercase
kebab-case, never derived from the (translatable) title. The nine current slugs are
frozen by an independent baseline manifest (baseline.json) and a slug-compatibility
test. Array index is never identity.

## 9. Category registry (taxonomy)
Ten canonical roadmap categories in src/shared/examples/f5/categories.js, each with
a stable kebab-case ID, future URL slug, stable order and localized label + short
description in all five locales. Validated: exactly 10, unique IDs, complete
5-language labels, no Italian, no dangling references. No category pages/UI in F5.

## 10. Category mapping of the current nine
production -> production-operations; workshop -> production-operations;
blend -> blending-formulation; marketing -> marketing-finance;
workforce -> workforce-scheduling; shipping -> logistics-transport;
project -> marketing-finance; delivery -> logistics-transport;
supplier -> purchasing-suppliers. Four categories (education-social,
energy-sustainability, hospitality-retail, learning-engine) have zero examples
until F7 — no synthetic example is invented to fill them.

## 11. Tags vs categories vs capabilities
Distinct concepts. Category = the primary real problem. Tags = free discovery
context (controlled lightly: lowercase kebab-case, unique). Capabilities = the
engine feature the example DEMONSTRATES, from a closed registry of engine-supported
features; unsupported claims (COUNTIF, nonlinear) are rejected.

## 12. Capabilities policy
enums.CAPABILITY_IDS lists only features the engine actually supports. The
validator cross-checks each claimed capability against the derived facts (e.g.
chart-eligible requires two continuous variables; bounds requires real bounds;
maximise/minimise must match the sense; sum/sumproduct must appear in the model).

## 13. Authored vs derived policy
Derived (never authored): modelType, objectiveDirection, decisionCount,
constraintCount, variableTypes, hasBounds, functionsUsed, chartEligible,
numberFormat (us/eu/unknown), gridCells. Variable identity and model type come
from the REAL engine detector (detectModel_) and classifier (classifyModel_), not a
bespoke heuristic; detection runs without solving. Authored (editorial, cannot be derived): primaryCategory,
difficulty, minutes, audiences, provenance, tags, capabilities, related, localized
content, result policy, SEO overrides. The validator forbids re-storing a derived
fact on the metadata record.

## 14. Localization architecture
The mathematical/spreadsheet model is ONE (never duplicated per language). Human
content is localized separately: F1 translations (title/desc) + F5 content
(question/goal) in exactly en/es/pt/de/fr. Required publishable fields fail
validation if any of the five is missing — no silent English fallback.

## 15. Grid localization decision
The grid is a STABLE TECHNICAL ARTIFACT independent of UI language. Model
labels/formulas are not duplicated per locale; the nine grids stay byte-identical.
UI chrome is localized by the existing i18n layer, not by forking the model.
numberFormat is DERIVED only when an unambiguous decimal literal is present (dot=us,
comma=eu); an integer-only model is honestly "unknown", never inferred as US.

## 16. Difficulty rubric
Enum beginner/intermediate/advanced (editorial, not a cell count). Beginner: small
model, single simple concept. Intermediate: multiple constraints, integer/binary or
bounds. Advanced: mixed variables, larger interaction or less-obvious modelling.
Documented for F7.

## 17. Estimated-time policy
Authored integer minutes in [1,120], meaning time to EXPLORE/UNDERSTAND the
example, never solver run time. No free strings.

## 18. Audience
Small vocabulary general/business/student; an example may list several.

## 19. Provenance
kind: 'synthetic' for realistic teaching data (all nine). 'sourced' is reserved and
requires a real source + http(s) url + optional license. No fake companies, no fake
sources; a synthetic record may not name a source.

## 20. Model payload
The canonical model IS the F1 model (grid, optional domains/whole/openVarSettings,
fieldOrder serialization contract, sense, expected). F5 does not define a second
engine schema; it represents the product's input.

## 21. Serializer
authoring.serializeCanonical produces deterministic, clone-safe output: recursively
sorted keys, rejects functions/Date/cyclic. Two serializations are byte-identical.

## 22. Expected-result schema
Each publishable example has an engine-validated expected result: status, objective,
tolerance and a policy. The expected STATUS is classified explicitly: solution-bearing (optimal/feasible)
vs no-solution (infeasible/unbounded); unknown/incomplete are NOT publishable (no
audited deterministic contract, rejected as an expected status). RESULT_POLICIES are
exact, objective-feasible and status-only. A no-solution status must use status-only
(no objective, no vector, no feasibility); a solution-bearing status must use exact or
objective-feasible. The F1 expected-objective rule is conditional by status:
solution-bearing requires a finite objective, no-solution requires null/absent (never
a fake number) — the nine existing records, all optimal, stay byte-identical. The
policy is CONDITIONAL: "exact" REQUIRES the COMPLETE decision vector keyed by
stable cell reference — the provided cells must equal the detector's decision-cell
set exactly (no missing, no extra, no unknown, no duplicate, order-independent),
with numeric values; "objective-feasible" must NOT carry a vector. The
canonical metadata owns the policy; the independent baseline owns only the
mathematical values (status/objective/tolerance) with no duplicated policy.
Machine-dependent timing/node counts are never pinned.

## 23. Multiple-optima policy
Two policies: 'exact' (status + objective + a specific decision vector) and
'objective-feasible' (status + objective + feasibility, without pinning an arbitrary
vector). All nine use objective-feasible, so a different optimal vertex never breaks
a test. "exact" is fully implemented (conditional schema + validator + behavioural
verification against the engine solution); a temp exact fixture in the behavioural
suite proves correct-vector passes and wrong/missing/unknown-cell fail. No theorem
prover.

## 24. Tolerance policy
Centralised: DEFAULT_TOLERANCE 1e-6, MIN 1e-12, MAX 1e-2. An example may override
within [min,max] (blend uses 1e-8). A too-loose tolerance is rejected.

## 25. Derived facts
derive.deriveFacts is the single canonical function; deterministic. Decision-variable
identity comes from Engine.detectModel_ (detection only, no solve) and model type from
Engine.classifyModel_ — the same infrastructure the engine and Variable Settings panel
use — so a binary+default-continuous model is correctly "mixed" with two variables.
functionsUsed normalises names to uppercase (=sum(...) counts as SUM). constraintCount
comes from the engine detector's OWN constraint list (model.constraints filtered by
isCompleteConstraint), not a parallel comparator-row heuristic; the model is detected
ONCE (derive.detectInfo) and reused for variable identity AND constraint identity AND
effective domains; deriveFacts calls Engine.detectModel_ exactly once (asserted). Negative tests
prove authored data cannot drift from it.

## 26. Related-example policy
Optional related[] of stable keys: no self-reference, no duplicates, must exist. F6
decides display.

## 27. SEO preparation
Optional localized SEO title/description overrides in metadata. F5 emits NO public
JSON-LD, no Schema.org output, no sitemap change, no new pages. F11 owns SEO
implementation and will project the data.

## 28. Legacy projector
project.legacyMeta derives the public examples-data META shape (key/slug/legacy
category/derived type/sense). No second catalogue; the legacy shape is derived.

## 29. Nine-example migration
All nine migrated: schema valid, ID + slug + model + solver settings preserved,
localization complete, category/difficulty/minutes/audience/provenance assigned,
expected result confirmed by the real engine, derived facts generated, legacy
projection preserved. No model number changed.

## 30. Engine validation results
tests_f5_examples_behavioural.js solves all nine through the real engine and VERIFIES
each with the engine's own machinery, not a status check: status + objective (vs the
independent baseline) + EVERY out.constraints[i].satisfied + per-variable domain/
bounds/integer/binary checks on the decision values. All nine optimal, objectives
within tolerance, all constraints satisfied, all domains respected. A SINGLE reusable
verifier (verifyResult) serves the nine, the exact fixture and the future-#10 dry-run.
It is STATUS-AWARE: solution-bearing statuses (optimal/feasible) require objective +
constraints + decision vector + domains, while no-solution statuses (infeasible/
unbounded, whose real engine output is status-only) require ONLY the status and never
a fake objective or vector. The verifier classifies the status EXPLICITLY (solution-
bearing vs no-solution) and rejects any status without a known policy — no implicit
"anything not no-solution has a solution" fallthrough. Real infeasible and unbounded
examples pass the FULL authoring flow end to end: a real F1 catalogue.js entry ->
f1.loadAndValidateCatalogue -> f5.loadCanonical -> canonical example -> real engine
SOLVE -> status verification. tests_f5_real_loader.js LITERALLY runs this pipeline:
after loadCanonical returns the frozen canonical example, it solves that example on
the temp site's own engine (harness.run over the canonical model + sense) and checks
the real status is infeasible / unbounded with no fake objective or vector. This is
the real path F7 will use, not just a direct defineExample call.
The F1 schema owns the status-aware expected-objective rule (solution-bearing requires
a finite objective; no-solution requires objective null/absent, never a fake number),
so defineExample and loadCanonical agree on every record and authoring.js suppresses
no schema error. It also owns the GENERIC slug grammar (^[a-z0-9]+(?:-[a-z0-9]+)*$,
separate from the historical public-slug baseline) and the localized title/desc
content-hygiene contract (trimmed plain text; no HTML, script, placeholder or raw
field name), the same hygiene the F5 content.question/goal fields carry; F5 metadata
tags use the same strict kebab-case grammar. The machine-id `key` uses that same
strict grammar as an immutable identifier (a separate field and contract from the
public slug and its historical baseline). Tolerance is status-aware: F1 rejects a
tolerance on a no-solution status (status-only) and a non-positive tolerance on a
solution-bearing one, and the F5 layer holds the effective tolerance (authored or the
1e-6 default) within [1e-12, 1e-2] on the generic authoring flow, so a future
out-of-band tolerance is rejected by defineExample and loadCanonical, not merely by
the current-nine baseline. Decision-vector and domain checks use the CANONICAL
effective domains (derive.deriveEffectiveDomains, the same whole/binary/integer
semantics as classifyModel_) and the canonical effective tolerance
(expected.tolerance || default) for the exact decision vector too. It REJECTS vacuous
success — missing/empty constraint output, missing/empty variable
output, a values vector shorter than the variables, or a variable set that does not
equal the detector's decision cells all fail. The future-#10 dry-run now runs the
full cycle: define + derive + real-engine SOLVE + verification (status, plus objective when solution-bearing;
constraints/domains) + projections + deterministic serialization + clone safety; a
malformed fixture still fails and the catalogue stays at exactly nine.

## 31. Compatibility results
Public slugs unchanged; examples-data.js byte-identical; legacy projection stable.

## 32. Model integrity hashes
baseline.json stores a deterministic legacy model hash per example; the positive
suite recomputes and compares; a cell/formula/bound mutation fails specifically.

## 33. Slug baseline
baseline.json is the independent slug authority; the suite detects slug changed/
removed/duplicated without deriving expected slugs from the (possibly mutated)
source.

## 34. Translation validation
Required localized fields: all five locales, non-empty, trimmed, no duplicate
locale, no unsupported locale, no placeholder/TODO/lorem/raw-key, no HTML/JS.
Identical strings across languages are NOT auto-flagged (technical terms may match).

## 35. Files added
src/shared/examples/f5/{enums,categories,derive,metadata,assemble,validate,project,
authoring,index}.js, src/shared/examples/f5/{baseline,protected-baseline}.json,
engine/tests_f5_examples_architecture.js, engine/tests_f5_examples_behavioural.js,
engine/tests_f5_examples_architecture_negative.js, docs/checkpoint-f5-examples-
architecture.md, docs/examples-schema.md, docs/example-authoring-guide.md.

## 36. Files modified
engine/suites.js only, to register the three F5 suites. No other existing file is
modified. The F1 catalogue and all public output stay byte-identical.

## 37. Files deleted
None.

## 38. Production protected
Public pages/assets (index/solver/examples/capabilities/guide/about/privacy/terms
.html, plumline.css, i18n.js, product-capabilities.js, examples-data.js), infra
(vite.config.mjs, package.json, package-lock.json) — byte-identical via an
INDEPENDENT exact-set contract with a CODE-OWNED path authority: the expected paths
and counts live (deep-frozen) in engine/f5_protected_check.js, NOT in the JSON, so
co-editing the manifest sets plus any JSON path list cannot bypass the contract. The
shared checker compares the manifest against the code-owned paths and byte-hashes each.

## 39. F4 protected
src/shared/design-system/ and src/shared/motion/ (all files) PLUS the F4 stable
reference docs docs/design-system-components.md and docs/motion-system.md (27 files
total) — byte-identical. The engine core exact set (6 files) protects the canonical
engine source engine/source/plumline-engine.js, the Node mirror engine/engine.js,
generate-engine-mirror.js, the platform adapter, the Worker client
solve-worker-client.js and the solver composer compose-solver.js. F5 does not own
visual/motion infrastructure or the engine.

## 40. Tests
Three F5 suites, registered in engine/suites.js:
1. Positive static suite (tests_f5_examples_architecture.js): schema, identity,
   taxonomy, locales, authored/derived, current-9 migration, projection, expected
   results, search/facets, protection, roadmap.
2. Behavioural engine suite (tests_f5_examples_behavioural.js): solves all nine
   through the real engine and compares to the independent baseline.
3. Negative mutation suite (tests_f5_examples_architecture_negative.js).

## 41. Negative mutations
Reproducible mutations on temp copies from a path with spaces, each failing for its
specific reason, restored in finally.

## 42. Performance
The runtime public catalogue stays light (examples-data.js unchanged). Exhaustive
engine solve validation runs only in tests/CI, never on user page load. Scaling to
60 is structural: metadata is a flat map keyed by example key; the assembler is
linear; no engine solve happens to build metadata.

## 43. Windows portability
All test tooling uses Node built-ins only (fs.cpSync/rmSync, process.execPath, path,
crypto). No cp/rm/mv/sed/grep/bash/sh/cmd/powershell. Temp cleanup in finally.
Tested from a path containing spaces.

## 44. Limitations
F5 ships architecture + the nine migrated examples only. No gallery, no search/
filter UI, no category pages, no new public example, no SEO output. Difficulty and
editorial content are authored judgements.

## 45. Rollback
Delete src/shared/examples/f5/ and the three F5 test files and the three F5 docs;
remove the three F5 entries from engine/suites.js. Restores the post-F4c state at
14,560. No public output changes because F5 added no public output.

## 46. Exact work deferred to F6
The new examples library UI: cards, category UI, search UI, filter facets UI,
individual example pages, related-example display. F5 provides the data projections
(searchDocument, facetFacts) but no UI.

## 47. Exact work deferred to F7
Expanding 9 -> 60 examples (F7a 9->24, F7b 24->36, F7c 36->48, F7d 48->60) using the
authoring API. F5 adds no tenth example.

## 48. Confirmation: F8 unchanged
F8 remains Solver personalisation and grid UX. F5 does not touch the Solver.

## 49. Confirmation: Home remains F9
The narrative Home redesign remains F9. F5 does not touch Home.

## 50. Confirmation: remaining public-page redesign remains F10
Remaining public/internal page redesign remains F10.

## 51. Confirmation: SEO implementation remains F11
Public SEO implementation (JSON-LD, Schema.org projection, sitemap) remains F11. F5
only prepares optional SEO override fields; it emits no public SEO output.
