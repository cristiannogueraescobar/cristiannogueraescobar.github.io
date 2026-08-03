# Checkpoint F1 — Canonical example catalogue

## Goal

Convert the nine built-in solver examples from data duplicated across many files
(the solver `EXAMPLES` object, two i18n sub-sections per language, the
`examples-data.js` metadata, the `examples.html` JSON-LD and no-JS fallback, Home
references, capability references) into **one editable, validated authority** that
every consumer is projected from at build time. No public byte changes, no new
example, no new request, no design or copy change, no engine change.

Base commit: `9566e152d59e1a53397eb1a624f0d11cf1774403`.

## The authority

`src/shared/examples/catalogue.js` — a data-only CommonJS module exporting
`CATALOGUE`, an array of nine records. Each record carries:

- identity: `key`, `slug`, `category`, `type`, `sense`;
- `translations`: `{ en, es, pt, de, fr }`, each `{ title, desc }`;
- `model`: `grid` (rows of string cells), optional `whole`, `domains`,
  `openVarSettings`, and `fieldOrder`;
- `expected`: `status`, `modelType`, `objective`, and `tolerance` when present.

The catalogue contains **data only**: no HTML, no JSON-LD blob, no generated URLs,
no test names, no hashes, no build paths, no timestamps, no functions inside
records. It is internal source, never published to `dist`, and adds no runtime
request; it is consumed only during build/composition.

### `model.fieldOrder`

`fieldOrder` belongs to the **historical serialization contract** only: it records
the field order of the original `solver.html` `EXAMPLES` object so the projection
reproduces it byte-for-byte. It is NOT a second model definition and MUST NOT be
used as a mathematical authority. It may be dropped in a future visible rebaseline,
but not in F1.

## Helper modules (separated from the data)

- `schema.js` — strict schema validation (`validateCatalogue`), shape and value
  ranges only; it does not re-implement the parser/detector/solver.
- `serialize.js` — deterministic serializers that reproduce each historical byte
  shape (`serializeSolverExamples`, `i18nExampleLines`, `i18nExpectedOccurrences`,
  `examplesDataMetaLines`, `examplesJsonLd`, `examplesNoJsLinks`).
- `projectors.js` — reusable region replacement (`replaceRegion`) and the closed,
  validated i18n region regenerator (`regenerateI18nExampleRegions`).
- `index.js` — `loadAndValidateCatalogue(siteDir)`: the single entry every
  projection uses. It loads the catalogue from the given `siteDir`, clears only its
  own `require.cache` entries, validates the schema, and returns validated data.
  It works from temp trees and spaced paths and never falls back to the main repo.

No second ESM or JSON representation of the catalogue exists. CommonJS is the single
format, matching the existing tests and compositors.

## Projection system

Each consumer is a projection derived from the catalogue:

| Consumer | File | How it is projected | Public bytes |
|---|---|---|---|
| Solver `EXAMPLES` | `solver.html` (composed) | marker `SOLVER_EXAMPLES_CATALOGUE_START/END` replaced by `serializeSolverExamples` during composition | object 6125 B; composed 215539 B; dist 218349 B |
| i18n example keys | `assets/i18n.js` | `regenerateI18nExampleRegions` rewrites the two sub-sections per language in place (no markers, closed structure) | 274099 B (180 occurrences) |
| Example metadata | `assets/examples-data.js` | `examplesDataMetaLines` reproduces the nine aligned META lines | 2644 B |
| Cards JSON-LD | `examples.html` | `examplesJsonLd` reproduces the ItemList (position/name/url) | JSON-LD 1232 B |
| no-JS fallback | `examples.html` | link href/name derive from slug/title (the fallback's own short description is markup-owned copy) | unchanged |
| Home | `index.html` | slug selection/order/placement derive from the catalogue; Home keeps its own use-case copy (`uc*`) | unchanged |
| Capabilities | `assets/product-capabilities.js` | references examples by `exampleId` (catalogue key); no metadata or full URL stored | unchanged |

The solver EXAMPLES is projected at composition time via a marker; the served
assets (`i18n.js`, `examples-data.js`, `examples.html`) are byte-identical to source
and are kept faithful by stale guards rather than markers (they are served as-is, so
markers would change public bytes).

### i18n regeneration (closed structure)

`assets/i18n.js` is a served asset, so it is not marked. The regenerator locates the
two `exName_`/`exDesc_` sub-sections per language by a closed, validated structure:
it requires exactly `langs.length * 2` blocks of each, each block being the nine
catalogue keys in order, and preserves order, indentation, commas, escaping and LF.
It fails with zero, one, three or more sub-sections, uses no ambiguous global regex,
regenerates the current file byte-for-byte, and two runs produce zero diff.

## URL contract

`buildExampleSolverUrl` in `assets/examples-data.js` is the single authority. It
derives `solver.html?ex=<slug>` from the slug and returns `null` for an unknown key.
The catalogue stores no full URLs; no per-record URL field exists.

## Ownership decisions

- **Home** keeps only a selection/order/placement of example keys (as slug URLs)
  plus its own use-case copy (`uc*` i18n keys, distinct from the canonical
  `exName_`/`exDesc_`). It stores no example titles, descriptions or model metadata.
- **Capabilities**: `assets/product-capabilities.js` is the single owner of the
  capability↔example relation, referencing by `exampleId` (catalogue key). It stores
  no example metadata and no full example URLs. Titles/slugs/URLs resolve through the
  projected `examples-data.js`.

## Detection / solve parity

`tests_examples_solve_parity.js` runs each catalogue grid through the canonical
engine (`detectModel_` + `solveModel_` via the shared harness) and compares
`status`/`modelType`/`objective` (and `tolerance` when present) against the catalogue
expected contract. The engine requires the example's `sense` (the solver UI confirms
it via the sense selector; it is not always auto-detected) and per-variable
`domains` in the `{ integer:[...], bounds:[...] }` shape the panel builds; both come
from the catalogue. No variable-value vector is pinned or compared.

## Generator / compositor

`npm run generate:examples` (`engine/generate-examples.js`) is the single generator.
It loads and validates the catalogue, builds every projection in memory, compares
against current bytes, writes atomically only changed files, uses UTF-8 + LF,
includes no timestamps or absolute paths, never reads dist, never runs Vite, never
touches the engine, works on Windows/Linux and spaced paths, is deterministic (two
runs identical), and reports what changed. With `--check` it writes nothing and exits
non-zero on staleness.

`npm run verify` step 4b runs `generate-examples.js --check`: it validates schema and
projection freshness and never writes.

## Reusable checker

`engine/check-canonical-catalogue.js` exposes
`checkCanonicalExampleCatalogue(siteDir)`, which validates the catalogue and every
projection from one entry, reusing the per-gate guards (it does not re-implement the
engine) and the generator's staleness check, and verifies the F1 fixture. It runs
from temp trees and spaced paths and touches no dist.

## Fixture

`engine/fixtures/product/example-catalogue-f1.json` pins the F1 contract: base
commit, catalogue path/bytes/sha, nine keys/slugs/order, five languages, projection
byte sizes and hashes, expected contracts (status/modelType/objective/tolerance), the
URL contract, ownership, public output invariants (composed 215539, dist 218349, sha
`4dbf1a8a…`, six requests, five languages), and the do-not-regenerate policy. It
contains no absolute paths, timestamps, full HTML/engine, or pinned variable values.
The checker reads it; it is never auto-regenerated.

## Test migration

Suites that compose the solver inside an isolated temp tree now copy the catalogue
module set via `engine/copy-catalogue-tree.js` (the minimal set
`loadAndValidateCatalogue` needs, byte-for-byte, LF/UTF-8/spaces preserved). See the
migration table in this checkpoint's delivery notes.

New suites: `tests_examples_i18n_projection` (12), `tests_examples_data_projection`
(16), `tests_examples_page_projection` (19), `tests_home_capabilities_refs` (9),
`tests_examples_solve_parity` (27), `tests_canonical_catalogue_positive` (41),
`tests_canonical_catalogue_negative` (83), `tests_canonical_catalogue_needle_audit`
(13).

`RAW_SOURCE_ALLOWLIST` gained exactly two entries
(`tests_examples_page_projection.js`, `tests_home_capabilities_refs.js`), each with a
closed reason: they read raw regions the shell composer never touches (JSON-LD/no-JS
links; Home slug references) to assert catalogue-faithful projection. The catalogue,
generator, checker, positive/negative suites, needle auditor and fixture are NOT
allowlisted.

## How to edit an example

1. Edit `src/shared/examples/catalogue.js` (the only authority).
2. Run `npm run generate:examples` to update the served projections.
3. Run `npm run verify` (validates schema + projections, composes, checks bytes).

## How to add an example (future, F5+)

Adding an example is a visible rebaseline: it changes public bytes, the request/JSON-LD
inventory and the fixture. It is out of scope for F1, which preserves the nine
examples exactly.

## Rollback

Restore the pre-F1 `solver.html` inline `EXAMPLES` object and remove the marker; the
served assets are already byte-identical, so no other public file changes.

## Not in F1 / remaining

No engine change, no design/copy change, no new example, no new request. Later
checkpoints (F2–F9) cover the visual redesign, shared fragments, and the expanded
example library.
