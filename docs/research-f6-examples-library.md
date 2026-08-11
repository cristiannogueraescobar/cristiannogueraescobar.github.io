# F6 research — Examples library UI

Research done before designing the F6 Examples library. The goal is to extract
FUNCTIONAL principles for discovery of a catalogue that will grow 9 -> 60, not to copy
any competitor's branding or layout. No claims are invented about competitors; each row
records a source, the observed pattern, the useful principle, the rejected pattern, and
the implication for Plumline.

## Plumline today (current examples.html)

- Source: the served `examples.html` in this repo (also https://plumline.online/examples.html).
- Observed: a compact editorial intro (eyebrow "Examples", h1 "Ready-to-solve models.",
  a lead paragraph) followed by a plain `<ul>` of nine links, each `Title — description
  (type)`, linking to `solver.html?ex=<slug>`. A progressive-enhancement script reads
  `assets/examples-data.js` (`CATALOG`) and, when JS runs, replaces the list with cards
  grouped by the three legacy UI categories (start / business / integer-binary).
- Useful principle: the intro already frames examples as ready-to-solve and openable in
  the Solver; the no-JS `<ul>` already keeps every example reachable without JS. Keep both.
- Rejected pattern: the enhanced view is an undifferentiated card grid with no search, no
  filtering, and only three coarse legacy groups; it does not scale to 60 and buries the
  business question.
- Implication: F6 keeps the honest intro and the no-JS base list, but replaces the
  enhancement with real discovery (search + facets) driven by the F5 canonical facts and
  the ten-category taxonomy, with the business question made primary.

## Rows templates (rows.com/templates)

- Source: https://rows.com/templates (a spreadsheet-template catalogue).
- Observed: a left/side category list plus a search field; templates presented as cards
  with a short "what it does" line; a large catalogue kept navigable by category + search
  rather than one long scroll.
- Useful principle: for a technical/productivity catalogue, category browsing + free-text
  search is enough to stay navigable at scale; each card leads with the job it does, not
  its mechanism. Counts next to categories help a user judge where to look.
- Rejected pattern: template-marketplace framing (author bylines, popularity, "use this
  template" commerce chrome) — Plumline examples are not user-submitted products.
- Implication: F6 uses category + search as the primary axes, leads each card with the
  decision it answers, and shows a per-category count derived from the visible catalogue;
  no marketplace chrome.

## Notion template gallery (notion.com/templates)

- Source: https://notion.com/blog/new-notion-template-gallery and notion.com/templates.
- Observed: a keyword search bar plus a large set of granular categories; curated
  "collections" around use cases; in-app and web parity.
- Useful principle: granular categories with a prominent search scale to thousands of
  items; typing anything into one search bar is the primary path, categories are the
  secondary browse path.
- Rejected pattern: 250+ categories, creator ecosystem, and editor-curated "collections"
  based on popularity/analytics — Plumline has ten canonical categories and no popularity
  data, so a "featured/collections" notion would be fake here.
- Implication: F6 keeps ONE prominent search plus the ten canonical categories (showing
  only populated ones in the primary control now, with the full registry preserved in F5
  for F7). No featured/popularity/collections.

## Faceted-search UI principles (industry write-ups)

- Sources: general 2026 faceted-search/filter-UI guidance (e.g. bricxlabs "15 filter UI
  patterns", FacetWP/Empathy facet docs). Used only for neutral, well-established UX
  principles, not for any product claim.
- Observed / useful principles:
  - Show a result count and, optionally, per-facet counts so users can see where results
    are; keep option lists short (roughly 7-10) rather than exhaustive.
  - "Zero-count" handling: omit or clearly mark facet values that would return nothing,
    so users are not offered dead ends.
  - Provide an "active filters" summary with a clear-all and per-filter clear.
  - Return a real "no results" state (not an error) when a combination matches nothing.
  - Reflect discovery state in the URL for back/forward and shareable filtered views.
- Rejected patterns: dozens of simultaneous facets; a query language; infinite facet
  lists; treating an empty result as an error.
- Implication for Plumline: F6 uses a small, decision-useful facet set (category, model
  type, difficulty, goal), each facet OR within itself and AND across facets, with a
  visible result count, an active-filter summary + reset, a localized empty state, and
  safe `URLSearchParams` state that ignores unknown values and preserves `?lang=`.

## Net design implications (carried into the checkpoint)

1. Search is primary; categories secondary; technical facets tertiary. A casual user meets
   the business question before any OR/MILP jargon.
2. Everything renders from the F5 projection (searchDocument + facetFacts + category
   registry); no hand-written parallel catalogue.
3. The base HTML lists all nine examples with correct Solver links and no JS; JS only
   enhances search/filter/count/URL.
4. The layout algorithm must generalise to 60 (a uniform, scalable card grid with an
   index header and a category rail), not a hand-placed nine-card mosaic.
5. No marketplace / gallery / SaaS-card framing; the library reads as a technical model
   index in the existing F4 visual language.
