# Plumline examples — canonical schema reference (F5)

Reference for F6/F7/F11. Every field of a canonical example, its type, whether it
is required, whether it is authored or derived, how it is validated, an example
value, and its future consumer. The canonical object is assembled by
`src/shared/examples/f5/assemble.js` from three layers with one source per fact.

## Layers
- Core model + identity + expected  -> `src/shared/examples/catalogue.js` (F1).
- Authored classification + content + policy + SEO -> `src/shared/examples/f5/metadata.js`.
- Derived facts -> `src/shared/examples/f5/derive.js` (computed, never authored).

## Core model (authored in F1, represents the product input)
- `key` — string, required, AUTHORED. STABLE, IMMUTABLE machine ID: strict lowercase
  kebab-case `^[a-z0-9]+(?:-[a-z0-9]+)*$`. It is the canonical identity, the metadata-map
  key and the related-example reference. Its GRAMMAR (any record) and its UNIQUENESS
  (no duplicate keys in the catalogue) are separate contracts, and both are separate
  from the slug: key and slug are DIFFERENT fields and neither is derived from the
  other.
  non-empty, unique across catalogue. Consumer: every projection, identity.
- `slug` — string, required, AUTHORED. Stable public slug, unique, lowercase
  kebab-case, never derived from the title. Validation is TWO separate contracts:
  (A) a GENERIC slug GRAMMAR `^[a-z0-9]+(?:-[a-z0-9]+)*$` enforced by the F1 schema on
  EVERY record (rejects spaces, uppercase, underscores, leading/trailing and double
  hyphens), so a future example #10 with a malformed slug is rejected on its own; and
  (B) an INDEPENDENT public-slug BASELINE that pins the nine current slugs for
  historical compatibility. (A) validates syntax; (B) protects the existing public
  URLs. Consumer: solver.html?ex=<slug>, examples-data, future pages.
- `model.grid` — string[][], required, AUTHORED. The spreadsheet. Validation: F1
  schema (non-empty rows, string cells). Consumer: engine, Solver, chart.
- `model.domains` — object, optional, AUTHORED. Per-cell variable domains
  (type/min/max). Validation: F1 schema (cells exist, types valid). Consumer:
  Variable Settings panel, engine.
- `model.whole` — boolean, optional, AUTHORED. Whole-number toggle. Consumer: engine.
- `model.openVarSettings` — boolean, optional, AUTHORED. Consumer: Solver UI.
- `model.fieldOrder` — string[], optional, AUTHORED. Historical serialization
  order; NOT a mathematical authority. Consumer: legacy serializer.
- `sense` — 'max' | 'min', required, AUTHORED. Objective direction. Consumer: engine,
  derived direction.
- `expected` — object, required, AUTHORED. { status, modelType, objective,
  tolerance? }. Validation is two-layered and status-aware:
  - F1 schema (structure): solution-bearing statuses (optimal/feasible) require a
    finite objective and, when a tolerance is present, it must be finite and > 0.
    No-solution statuses (infeasible/unbounded) are status-only — objective must be
    null/absent AND tolerance must be ABSENT.
  - F5 metadata (quality band): for solution-bearing statuses the EFFECTIVE tolerance
    (the authored value, or enums.DEFAULT_TOLERANCE = 1e-6 when absent) must lie within
    [MIN_TOLERANCE = 1e-12, MAX_TOLERANCE = 1e-2]. This runs on the generic authoring
    flow (defineExample / loadCanonical), so a FUTURE record with tolerance = 5 fails
    for exceeding MAX and tolerance = 1e-20 fails for being below MIN; it is not gated
    only by the current-nine baseline. The default applies ONLY to solution-bearing
    statuses. Consumer: expected-result contract.

## Identity + versioning (F5 metadata)
- `schemaVersion` — integer, required, AUTHORED. Must equal enums.SCHEMA_VERSION
  (1). Validation: exact match. Consumer: future migration.

## Classification (F5 metadata, authored)
- `primaryCategory` — string, required, AUTHORED. One of the ten canonical category
  IDs. Validation: membership. Consumer: library grouping (F6).
- `difficulty` — 'beginner'|'intermediate'|'advanced', required, AUTHORED.
  Validation: enum. Consumer: filter facet (F6).
- `minutes` — integer [1,120], required, AUTHORED. Exploration time (not solve
  time). Validation: integer + range. Consumer: library card (F6).
- `audiences` — string[], required, AUTHORED. Subset of general/business/student,
  non-empty, no duplicates. Consumer: filter facet (F6).
- `provenance` — object, required, AUTHORED. { kind: 'synthetic' } or { kind:
  'sourced', source, url, license? }. Validation: synthetic may not name a source;
  sourced needs a real http(s) url. Consumer: trust/attribution (F11).
- `tags` — string[], required (may be empty in principle; the nine are non-empty),
  AUTHORED. STRICT lowercase kebab-case `^[a-z0-9]+(?:-[a-z0-9]+)*$` (no leading/
  trailing or double hyphens, no underscores), unique. Consumer: discovery/search (F6).
- `capabilities` — string[], required non-empty, AUTHORED. Engine-supported
  capability IDs; cross-checked against derived facts. Consumer: filter facet,
  capability page.
- `related` — string[], optional, AUTHORED. Stable keys; no self/dup; must exist.
  Consumer: related display (F6).

## Localized content (F5 metadata, authored)
- `content.question` — { en,es,pt,de,fr }, required, AUTHORED. The real-world
  question. Validation: all five, non-empty, trimmed, plain text. Consumer: card +
  page (F6).
- `content.goal` — { en,es,pt,de,fr }, required, AUTHORED. The learning goal.
  Same validation. Consumer: page (F6).
- (base `translations.<locale>.title/desc` remain in F1.) These five-locale
  title/desc strings satisfy the SAME localized content-hygiene contract as the F5
  `content.question/goal` fields, enforced in the F1 schema (F1 does not depend on
  F5): each is a non-empty, trimmed, plain-text string — no HTML tags, no
  script/event content, no TODO/FIXME/lorem-ipsum placeholder, and never the raw
  field name. Identical wording across locales is allowed.

## Expected result (F5 policy + F1 contract)
- `resultPolicy` — 'exact' | 'objective-feasible' | 'status-only', required, AUTHORED.
  Solution-bearing statuses (optimal/feasible) use exact or objective-feasible;
  no-solution statuses (infeasible/unbounded) use status-only. optimal+status-only
  and infeasible/unbounded+exact/objective-feasible are rejected.
- expected status contract: PUBLISHABLE statuses are optimal, feasible, infeasible,
  unbounded. unknown/incomplete are NOT publishable (no audited deterministic
  contract). Solution-bearing statuses require a finite objective; no-solution
  statuses carry objective null/absent — never a fake number. Consumer:
  behavioural verification.
- `resultDecisions` — { cell: number } | null, CONDITIONAL, AUTHORED. Required when resultPolicy is 'exact' and must be the COMPLETE decision vector — the
  provided cells must equal the detector's decision-cell set exactly (no missing,
  extra, unknown or duplicate), numeric values; must be null/absent for
  'objective-feasible'. Consumer: exact behavioural verification.

## SEO preparation (F5 metadata, authored, optional)
- `seo.title` — { locale: string }, optional, AUTHORED. Localized SEO title
  override. Plain text. Consumer: F11 JSON-LD/meta projection (not F5).
- `seo.description` — { locale: string }, optional, AUTHORED. Consumer: F11.

## Derived facts (DERIVED — never authored)
- `facts.modelType` — 'continuous'|'integer'|'binary'|'mixed'. From the engine
  classifier (classifyModel_) fed the detected variables + domains; a binary+default-
  continuous model is correctly 'mixed'.
- `facts.objectiveDirection` — mirrors sense.
- `facts.decisionCount` — integer. From the engine detector (detectModel_), not a
  column heuristic; handles variables outside column B and multi-cell blocks.
- `facts.constraintCount` — integer. From Engine.detectModel_().constraints
  filtered by isCompleteConstraint (a single detection shared with decision-cell and
  effective-domain derivation), not comparator cells.
- `facts.variableTypes` — string[]. Distinct decision variable kinds.
- `facts.hasBounds` — boolean. From domains.
- `facts.functionsUsed` — string[]. From formulas (e.g. SUM, SUMPRODUCT).
- `facts.chartEligible` — boolean. Two continuous variables.
- `facts.numberFormat` — 'us' | 'eu' | 'unknown' | 'mixed'. DERIVED only from an
  unambiguous decimal literal (dot=us, comma=eu); integer-only models are 'unknown'
  (never inferred as US).
- `facts.gridCells` — integer. Total grid cells.
Consumer: filter facets, chart eligibility, capability cross-check.
