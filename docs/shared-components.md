# Shared components (Checkpoint B1 — shared shell composition)

Checkpoint B1 extracts the site's shared **shell** (header, primary nav, mobile
controls, language selector, footer, build-badge span) into a single source that
is composed into every page **at build time**. Nothing is fetched at runtime; the
browser receives complete HTML.

## A. Composition

### Where the shell lives

- `src/shared/fragments/header.html` — the **real** header markup, read at build
  time. One file, two explicit `@section` blocks (`header:informational`,
  `header:solver`), each holding the exact markup of its variant, byte-for-byte,
  including significant whitespace and indentation.
- `src/shared/fragments/footer.html` — the **real** footer markup, read at build
  time. Two `@section` blocks (`footer:informational`, `footer:solver`).
- `src/shared/compose-shell.js` — the composer. It **reads** the two fragment
  files, parses their sections with a small strict parser (not a template
  framework), and substitutes the placeholders. Deterministic: no `fetch`, no
  browser DOM, no `innerHTML`.

Both the build and the tests read the same fragment files. The fragments are the
single source of the shell markup; the composer holds no hard-coded header/footer
HTML. Fragments are **not** shipped to `dist` and are **never** fetched at runtime.

The composer is CommonJS so both the Node test suites (`require`) and
`vite.config.mjs` (`createRequire`) share exactly one implementation, and
`createComposer({ fragmentDir })` lets the negative tests point it at a temporary
fragment directory.

### Fragment format

Each fragment file is line-oriented:

    <!-- @meta ... -->            optional; a documentation block, ignored by the parser
    <!-- @section NAME -->        opens a section (NAME = header:informational, etc.)
    ...literal markup lines...    reproduced verbatim (whitespace is significant)
    <!-- @endsection -->          closes the section

The parser is strict: nested sections, duplicate sections, an `@endsection`
without an open section, an unclosed section, or any non-blank content outside a
section all throw. Only two placeholder kinds are substituted:

- `{{AC:<key>}}` — replaced with ` aria-current="page"` for the active nav link
  (per the page's `active`), or the empty string otherwise. Keys: solver, addon,
  guide, examples, about.
- `{{LEARN_CAPABILITIES}}` — replaced with the extra Capabilities footer link when
  the page's context authorizes it (capabilities.html only), or the empty string.

Everything else in the fragment is literal and reproduced byte-for-byte.

### Marker format

Source pages carry explicit, deterministic markers (no auto-detection):

    <!-- PLUMLINE:HEADER pageType="informational" active="about" -->
    <!-- PLUMLINE:HEADER pageType="solver" active="solver" -->
    <!-- PLUMLINE:FOOTER -->
    <!-- PLUMLINE:FOOTER learnCapabilities="true" -->

The marker occupies its own line with NO indentation — the rendered header/footer
carries its own indentation, so a leading-space marker would double it.

### pageType

- `informational` — `<header class="mast">`, logo SVG 24×38, no on-page nav,
  `<select class="lang" id="lang">`. Used by index, guide, examples, capabilities,
  about, privacy, terms.
- `solver` — `<header class="top"><div class="wrap">`, logo SVG 20×30, an extra
  `<nav class="nav-onpage">` "How to use" (`#how`, `data-i18n="navHow"`), and a
  `<select id="lang">` with **no** `class="lang"`. Used by solver only.

Unknown `pageType` throws (`unknown pageType`).

### active

Selects which primary-nav link gets `aria-current="page"`. Valid values: `solver`,
`guide`, `examples`, `about`, or `""` / `none` for pages with no active link
(index, capabilities, privacy, terms). Unknown values throw (`invalid active`).
`active` is never inserted into markup — it is only compared against link keys, so
it cannot inject HTML.

### learnCapabilities

`learnCapabilities="true"` on the FOOTER marker adds one extra footer link in the
"Learn" column: `<a href="capabilities.html" data-i18n="navCapabilities">Capabilities</a>`.
See `docs/checkpoint-b-baseline.md` — this difference PREDATES B1 and appears on
`capabilities.html` only. `tests_shell_b1.js` asserts no other page carries it.

### Process used by Vite

- **`npm run dev`**: `plumlineComposeShell()` (a `transformIndexHtml` hook, order
  `pre`) composes the markers when the dev server serves each page. So the dev
  output already contains the full shell.
- **`npm run build`**: the same hook runs, and `plumlineBuild().closeBundle()`
  additionally re-derives each dist page from its source and composes it, so the
  built HTML is authoritative and byte-for-byte determined by the source.

Both paths call the SAME `composeHtml` from `src/shared/compose-shell.js`, so dev
and build produce identical HTML.

### PAGE_CONTEXT (authoritative per-page context)

`compose-shell.js` exports a single explicit map, `PAGE_CONTEXT`, keyed by each of
the 8 filenames, giving each page its exact `{ pageType, active, learnCapabilities }`.
`composeHtml(html, label)` looks the page up by `label` (its basename, e.g.
`solver.html`) and requires the marker attributes to MATCH that entry. It throws if:

- `label` is not in `PAGE_CONTEXT` (no unknown pages);
- the HEADER `pageType` differs from the page's context (e.g. solver as
  informational, or an informational page as solver);
- the HEADER `active` differs from the page's context;
- the HEADER omits `pageType` OR omits `active` — both are REQUIRED, even when
  `active` is the empty string (`active=""`);
- the FOOTER carries `pageType` (there is **no** free-form footer type override —
  the footer variant is DERIVED from the page's `pageType` in `PAGE_CONTEXT`);
- `learnCapabilities` appears on any of the 7 non-capabilities pages (unknown
  attribute there), or is omitted on capabilities.html, or on capabilities.html
  is anything other than exactly `"true"` (`learnCapabilities="false"` is rejected
  on every page);
- an attribute is unknown or duplicated;
- a boolean attribute (`learnCapabilities`) has any value other than `true`/`false`.

The marker body is parsed by a strict left-to-right parser (`parseAttrs`) that
consumes the WHOLE body: only whitespace is allowed between and around attributes,
and the only accepted token shape is `name="value"` with double quotes. A bare
word, an unquoted value, single quotes, stray punctuation, embedded HTML/comment
text, or any leftover character throws — there is no global regex that silently
skips unrecognized parts. `parseAttrs` also enforces the per-marker `required`
set (HEADER: `pageType` + `active`; FOOTER on capabilities.html: `learnCapabilities`;
FOOTER elsewhere: none).

The footer variant is never taken from a marker attribute; the earlier
`const footerType = fAttrs.pageType || pageType` override was removed.

### Validations and errors

`composeHtml(html, label)` also throws on: no/duplicate HEADER marker, no/duplicate
FOOTER marker, unknown `pageType`, invalid `active`, and any unresolved `PLUMLINE:`
marker left after composition. `validate_dist.js` additionally requires that each
dist page equals `composeHtml(source)` exactly and contains no residual marker
(this replaced Checkpoint A's source==dist byte equality for migrated pages, with
an equal-or-stronger guarantee).

### Golden baseline (drift protection)

`engine/fixtures/shell-golden/*.html` holds nine independent fixtures — five
informational headers (no active, and solver/guide/examples/about active), the
solver header, and three footers (informational, capabilities, solver). They were
extracted from the **pre-B1 approved product** (and, for the one case with no real
page — an informational header with the solver link active — derived by hand from
the no-active fixture by applying the known `aria-current` rule), NOT by calling
the composer. `engine/tests_shell_golden.js` compares the composer's output to each
fixture byte-for-byte. Because the expected values are independent of the composer,
an accidental change to the composer cannot silently redefine both the output and
the expected: the suite fails instead.

## B. How to add a page

1. Create the source HTML with the page's `<main>` content.
2. Add the two markers: `<!-- PLUMLINE:HEADER pageType="informational" active="…" -->`
   (own line, no indentation) and `<!-- PLUMLINE:FOOTER -->`.
3. Choose `pageType` (`informational` unless it is the solver).
4. Set `active` to the page's own nav key, or `""` if it has no active link.
5. Register the page as a Vite input in `vite.config.mjs` (`PAGES` / rollup input).
6. Add the page to `requiredPaths`/manifest coverage (it is a public page, so it is
   already covered by `PUBLIC_PAGES` in `engine/internal-paths.js`).
7. Add any page-specific validations.
8. Add tests (the B1 structural suite already iterates `PAGES`).
9. Build and verify: `npm run build` then confirm `dist/<page>.html` equals
   `composeHtml(source)`, has no residual marker, correct active link, correct
   metadata/JSON-LD.

## C. What belongs in shared

INCLUDED (Checkpoint B1): header, primary navigation, the structural mobile menu
(the `.menu-toggle` button and its `aria-controls` target), the structural
language `<select>`, footer, and the build-badge `<span>` target.

EXCLUDED — do NOT put these in shared:
- solver logic, the inline engine, the Worker;
- Home-specific logic (hero, use-cases, FAQ);
- Examples-specific and Capabilities-specific logic;
- any styling or behavior slated for B2 (shared behavior) or B3 (shared styles).

B1 moves only the shell MARKUP composition. The shell's JavaScript behavior
(`assets/nav-menu.js` drawer, `assets/build-badge.js`, the language selector
runtime) is unchanged in B1 and is the subject of B2.

## D. Reverting B1 without losing Checkpoint A

B1 is additive and reversible. To revert:

1. In each of the 8 pages, replace the `<!-- PLUMLINE:HEADER … -->` and
   `<!-- PLUMLINE:FOOTER … -->` markers with the literal header/footer markup
   (available from `composeHtml(source)` output, or from git history of the
   pre-B1 page).
2. Do the same in `engine/templates/capabilities.template.html`, then run
   `node engine/gen_capabilities.js` to regenerate `capabilities.html`.
3. Remove `src/shared/`, `engine/composed-html.js`, `engine/tests_shell_b1.js`,
   `engine/tests_shell_composition_negative.js`, `engine/tests_composed_reads.js`,
   and drop them from `engine/suites.js`.
4. In `vite.config.mjs`, remove `plumlineComposeShell()` and the `composeHtml`
   call in `closeBundle` (revert step (d) to the plain source-bytes restore).
5. Revert `engine/validate_dist.js` step 3 to the byte-identical source==dist
   check, and revert the `composedHtml` reads in the test suites to direct reads.

Checkpoint A (the Vite dist pipeline, manifest verification, smoke, hashes,
lockfile) is untouched by B1 and remains in force throughout.
