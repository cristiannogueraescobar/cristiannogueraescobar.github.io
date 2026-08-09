# Plumline example authoring guide (mandatory for F7)

How to add an example (#10 and beyond) correctly. The architecture is designed so
adding an example touches ONE data file (metadata.js) plus the F1 catalogue record,
not seven duplicated registries.

## Steps
1. Choose a real-world decision. Pick a concrete question a person or small
   organisation could actually face.
2. Choose the category. One primary category from the ten canonical IDs
   (`src/shared/examples/f5/categories.js`). One primary only.
3. Define the model. Build the grid, decision cells, domains/bounds, sense and
   expected contract as an F1 catalogue record (identity + model + expected +
   base title/desc in five locales).
4. Keep data realistic but SYNTHETIC unless genuinely sourced. Do not name a real
   company. If you use a real public source, set provenance.kind = 'sourced' with a
   real source + http(s) url + license.
5. Use SUPPORTED functions only. SUM and SUMPRODUCT are supported; COUNTIF,
   nonlinear and unsupported formulas are not and will fail validation if claimed.
6. Choose difficulty. beginner / intermediate / advanced per the rubric (see the
   checkpoint doc, section 16), not by cell count alone.
7. Choose audience(s). One or more of general / business / student.
8. Choose provenance. synthetic for teaching data; sourced only with a real source.
9. Write localized content. content.question and content.goal in all five locales
   (en/es/pt/de/fr). No English fallback; a missing locale fails validation.
10. Solve using the real engine. Run the model through the engine (see
    tests_f5_examples_behavioural.js) and read the actual status + objective.
11. Record the expected-result policy BY STATUS. optimal/feasible (solution-bearing):
    objective + tolerance, with 'objective-feasible' when several optimal vectors
    exist (default) or 'exact' when a unique decision vector matters (then supply the
    COMPLETE result.decisions keyed by decision cell). infeasible/unbounded
    (no-solution): 'status-only' — status only, NO objective (null/absent) and no
    decision vector, never a fake number. unknown/incomplete are not publishable.
    Add the mathematical values to the independent baseline (status/objective/
    tolerance for solution-bearing; status only for no-solution); the policy lives in
    metadata, not duplicated in the baseline. Confirm the values independently.
12. Validate. `defineExample(rec, meta)` validates structure, rejects unknown
    fields, cross-checks capabilities vs derived facts, assembles and deep-freezes.
13. Run tests. Positive + behavioural + negative suites must stay green; the
    checkpoint count assertion moves from 9 to the new total (kept separate from the
    generic validator, which is not capped at 9).
14. Review public claims. No fabricated business outcomes, no fake metrics, no
    unsupported capability claims.
15. Never fabricate business outcomes. Synthetic means "realistic and honest",
    not "pretend this happened at a real company".

## Final checklist
- [ ] Primary category is one of the ten canonical IDs.
- [ ] key + slug unique; slug lowercase kebab-case; slug not derived from title.
- [ ] `key` is strict lowercase kebab-case `^[a-z0-9]+(?:-[a-z0-9]+)*$` — a stable,
      immutable machine ID, unique in the catalogue, and NOT the same field as slug.
- [ ] `slug` is lowercase kebab-case `^[a-z0-9]+(?:-[a-z0-9]+)*$` (generic grammar,
      not just different from the nine baseline slugs).
- [ ] For a solution-bearing status, the effective tolerance (authored or the 1e-6
      default) is within [1e-12, 1e-2]. For infeasible/unbounded, NO tolerance (and no
      objective): status-only.
- [ ] Every `translations.<locale>.title/desc` is trimmed plain text: no HTML, no
      TODO/lorem placeholder, not the raw field name.
- [ ] `tags` are strict kebab-case (no leading/trailing or double hyphens).
- [ ] Model solves on the real engine with the claimed status (and objective when
      solution-bearing; no objective for infeasible/unbounded).
- [ ] Expected result added to the independent baseline manifest.
- [ ] All five locales present for every required field; no placeholder/TODO/HTML.
- [ ] difficulty, minutes (1..120), audiences, provenance set honestly.
- [ ] capabilities are engine-supported and consistent with derived facts.
- [ ] related ids exist, no self-reference, no duplicates.
- [ ] No derived fact (modelType, counts, ...) stored by hand.
- [ ] Positive + behavioural + negative suites green; checkpoint count updated.
