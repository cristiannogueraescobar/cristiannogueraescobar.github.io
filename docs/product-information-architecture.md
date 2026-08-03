# Product information architecture (F0 companion)

Status: proposal for review (Checkpoint F0). No public change made.

## Current IA (as audited)

- Header nav: Solver, Examples, Guide, Capabilities, About + language selector.
- Footer: legal (Privacy, Terms) + contact (`contact@plumline.online`).
- Home (`/`): marketing + education + FAQ + add-on, heavily self-linking.
- Solver (`/solver.html`): product + onboarding + marketing + add-on promotion.
- Examples (`/examples.html`): 9 cards + JSON-LD + no-JS fallback.
- Guide (`/guide.html`): educational.
- Capabilities (`/capabilities.html`): scope + checks + limits (title present: "Plumline Capabilities | Spreadsheet Optimisation Solver", i18n key `capPageTitle`).
- About (`/about.html`): maintainer + verification + trust.
- Privacy/Terms: legal.

Problems: Home over-loaded; add-on over-weighted while status unconfirmed;
audience journeys incomplete; solver carries marketing; the shared shell fragments
(`header.html`, `footer.html`) use `index.html` / `index.html#addon` in several
positions, propagated to all 8 pages (25 references across dist) — future
normalisation to `/` and `/#addon` belongs in the shared fragments (see the main
F0.5).

## Proposed IA (candidate, not approved)

Primary nav (lean): Solver · Examples · Learn · Capabilities · About.
Secondary/footer: Privacy · Terms · Contact · Add-on · (Changelog optional).

Pages:

| page | purpose | audience | create/keep | phase |
|---|---|---|---|---|
| `/` | positioning + conversion | all | keep, redesign | F3 |
| `/solver.html` | product + onboarding only | users | keep, de-market | F7 |
| `/examples.html` | filterable library index | all | keep, redesign | F4 |
| `/examples/<slug>.html` | teach one model, SEO | students/business | create | F5 |
| `/learn.html` (from Guide) | education hub | students/teachers | evolve Guide | F6 |
| `/use-cases.html` (+selected) | industry/audience SEO | business/ops | consider | F6 |
| `/for-students.html`, `/for-teachers.html` | education lanes | students/teachers | consider | F6 |
| `/capabilities.html` | honest scope + limits | evaluators | keep | F3 |
| `/add-on.html` | add-on details | Sheets users | consider (move off Home) | F3 |
| `/about.html` | trust | all | keep | — |
| `/privacy.html`, `/terms.html` | legal | all | keep | — |
| `/changelog.html` | transparency | returning | optional | F9 |

Constraint: one-person maintainable, five-language localisable. Do not
auto-approve every page; sequence Home, Examples, example details, then one or two
audience pages.

## Route strategy

Eight hardcoded Vite inputs today, encoded across `validate_dist`,
`requiredPaths`, manifest, sitemap, HTTP tests and page fixtures. For example
detail pages prefer, subject to F1/F4 evaluation, build-time generation from the
canonical example source emitting flat `/examples/<slug>.html` URLs (clean
canonicals, easy sitemap, GitHub Pages friendly). Avoid hash/query-only detail
pages (weak SEO, no per-example canonical/JSON-LD).

## Navigation and journeys

- Business journey: Home hero (business example) → Open solver / See verification → Examples (filter by industry) → example detail → Solver.
- Student/teacher journey: Home audience lane → Learn → Guide/example detail → Solver.
- Existing-solver-user journey: Home "browser + private" angle → Capabilities (honest limits) → Solver.

Each journey must end at the Solver or an example opened in the Solver, with the
verification receipt as the trust moment.

## Request and privacy contract

The approved public contract is six public requests (see the main F0.28). Any new
page or example must not weaken this; build-time example data is preferred over
runtime requests, and no analytics, trackers, cookies-for-tracking or third-party
runtime dependencies are introduced. Local processing and "no data leaves the
device" are the demonstrable differentiators to preserve.
