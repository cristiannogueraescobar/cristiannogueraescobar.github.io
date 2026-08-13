# F7a Phase 2 — Phase-3 test reconciliation list (deferred, controlled)

These suites carry an explicit `=== 9` / `90` / "nine" baseline assumption that becomes 24 / 240 after
F7a's 9→24 expansion. They are **NOT migrated in Phase 2** (the checkpoint defers the mega-suite to
Phase 3). This list makes the reconciliation controlled: each entry records the suite, the old
count-9 assumption, and the expected Phase-3 migration to 24.

**Design guidance for Phase 3 (carried from the checkpoint):** distinguish the *generic projection
invariant* `catalogue.length × 2 × localeCount` from the *F7a checkpoint invariant* `24 × 2 × 5 = 240`,
so F7b can advance to 36 without re-embedding a count-blocking architecture. The two architectural
fixes shipped in Phase 2 (`index.js` count-default, `projectors.js` variable-length regeneration) are
already count-agnostic and must NOT be reverted to a hardcoded 24.

| suite | old 9-count assumption | expected Phase-3 migration |
|---|---|---|
| tests_canonical_catalogue_positive.js | `catalogue.length === 9`; "nine examples"; unique keys/slugs `=== 9`; parity all nine; examples-data META = 9 lines; JSON-LD 9 ListItems | `=== 24`; unique keys/slugs 24; parity all 24; META 24 lines; 24 ListItems |
| tests_f5_examples_architecture.js | `loadCanonical(expectCount: 9)`; nine frozen slugs manifest; validateMetadataCatalogue expectCount 9; grammar/tolerance "nine current records" | `expectCount: 24`; 24-slug manifest (9 frozen + 15 F7a); expectCount 24; 24 records |
| tests_f5_examples_architecture_negative.js | expectCount 9 mutation fixtures | expectCount 24 fixtures |
| tests_f6_examples_library.js | `loadCanonical(expectCount: 9)`; "exactly nine real examples"; "nine card entries in base HTML"; nine-based category/count assertions | `expectCount: 24`; 24 records; 24 cards; category counts from 24 |
| tests_f6_examples_library_behavioural.js | nine-card behavioural counts | 24-card behavioural counts |
| tests_f6_examples_library_negative.js | nine-based negative fixtures | 24-based negative fixtures |
| tests_f6_clear_filters.js | nine visible-count baseline | 24 visible-count baseline |
| tests_f6_nojs_header.js | nine no-JS cards | 24 no-JS cards |
| tests_f6_audit_regression.js | nine-count regression pin | 24-count regression pin |
| tests_examples_i18n_projection.js | "9 keys × 2 × 5 = 90 exName + 90 exDesc = 180"; `r.total === 90` | 24 × 2 × 5 = 240 each; `r.total === 240` (prefer generic `catalogue.length × 2 × 5`) |
| tests_i18n_coverage.js | "nine catalogue keys" in two namespaces; nine-based facet counts | 24 catalogue keys; facet counts from 24 |
| tests_examples_page_projection.js | nine-based examples.html projection | 24-based projection |
| tests_examples_data_projection.js | nine META projection | 24 META projection |
| tests_examples_solve_parity.js | nine solve-parity rows | 24 solve-parity rows |
| tests_examples.js | nine-based examples assertions | 24-based |
| tests_assets.js | "examples-data.js must export exactly 9 examples"; `meta.META.length === 9` | export 24; `META.length === 24` |
| tests_canonical_10_end_to_end.js | "the real site examples.html still has exactly 9 cards" | 24 cards |
| tests_canonical_catalogue_negative.js | `'expected 9'` negative fixture | `'expected 24'` (or generic) |
| tests_f5_examples_behavioural.js | nine-based behavioural rows | 24-based |
| tests_f3b_home_sections.js / tests_f3c_home_sections.js | home references assuming nine examples | reconcile against 24 (home redesign is F9; keep minimal) |
| tests_solver_interface_final.js | nine-based interface refs | 24-based |
| tests_home_capabilities_refs.js | nine-based capability refs | 24-based |
| tests_engine_baseline.js / tests_e6_worker_mirror.js | incidental "9" occurrences (verify not count-load-bearing) | audit; migrate only if count-bearing |

**New Phase-3 suites to add (not now):** `tests_f7a_examples_24.js` (positive), `tests_f7a_examples_engine.js`
(behavioural), `tests_f7a_examples_browser.js` (Playwright), `tests_f7a_examples_negative.js` (~45 mutations),
plus the F7a per-tranche protected baseline. The two focused Phase-2 arch-fix tests already written
(`tests_phase2_arch_fixes.js`) should be folded into the permanent suite.
