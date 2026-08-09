# Checkpoint F4c — Motion system

## 1. Objective
Build a motion INFRASTRUCTURE for Plumline that is sober, meaningful, reusable,
accessible, progressively enhanced and easy to destroy/clean up. Not a collection
of effects: a system. Every primitive answers at least one of: what changed, what
action caused it, where to look now, which element belongs to which state, what
process is happening, what has been checked, what appeared because it is now
relevant. The single approved direction is unchanged: Editorial decision
instrument. F4c is production-READY but NOT production-WIRED.

## 2. Baseline
Integrated post-F4b tree: Node 24.15.0 target, Vite 6.4.3, 13,947 tests VERIFY
ALL GREEN, deterministic build (dist/index.html 4ec4fe2f..., dist/solver.html
36bfb88d...), 5 languages (en/es/pt/de/fr), 9 public examples, F4a and F4b closed,
canonical design system under src/shared/design-system/, Newsreader + Manrope
self-hosted and audited, production visually intact, exact F4b protected-production
baseline of 22 files. Confirmed before any change; no discrepancy.

## 3. Existing-motion audit (production, not modified)
A. Legitimate existing motion: small hover/focus transitions in assets/plumline.css
   (color/border/transform, ~150ms), the reduced-motion global reset, nav-menu.js
   open/close interaction.
B. Accidental/inconsistent motion: none material found.
C. Motion that could later migrate to F4c: the F4a sequence demonstration concept.
D. Interaction feedback that needs NO motion: menu open/close state, form focus.
E. Motion F4c must forbid: perpetual/decorative animation, parallax, `transition:
   all`, layout-geometry animation. Production has 0 @keyframes; F4c does not add
   any to production.
F4c changes NONE of this. Production stays byte-identical.

## 4. F4a lessons
F4a's sequence.js proved the good ideas: progressive enhancement (.seq--enhanced),
no-JS stacked readable stages, aria-current="step", never moving focus, no autoplay
under reduced motion, IntersectionObserver, user pause persisting across viewport
re-entry. Its weaknesses, corrected in the reusable F4c system: it used setInterval
(F4c uses a self-rescheduling cancelable setTimeout); it had NO destroy/cleanup for
the observer or the matchMedia listener (F4c has full cleanup); it had no
document-visibility policy (F4c has one); pause reasons were a single ambiguous
boolean (F4c separates userPaused/viewportPaused/documentPaused/reducedMotion); and
autoplay looped forever (F4c stops at the last step). We extracted the concepts, we
did not copy the file.

## 5. F4b integration
F4c is additive and layers on the F4b design system without modifying any static
F4b file. Motion consumes F4b surfaces (receipt, badges, buttons, links) via their
existing classes; it never redefines a component. F4b static files are protected by
an exact-set hash contract.

## 6. External research
Primary sources consulted and the principle adopted from each:
- MDN prefers-reduced-motion and W3C Media Queries L5: reduced motion means remove/
  reduce/REPLACE non-essential motion, not `* { animation: none }`. Adopted: a
  reduced block that removes spatial offsets and replaces movement+fade with a short
  non-spatial fade conveying the same information.
- W3C WCAG 2.3.3 Animation from Interactions (AAA) and 2.2.2 Pause, Stop, Hide (A):
  non-essential interaction motion must be disableable; autoplay must be pausable.
  Adopted: a Pause control from the start, manual navigation, and reduced-motion opt
  out.
- MDN IntersectionObserver / disconnect / unobserve: one shared observer is cheaper
  than one per element; unobserve after a one-shot; disconnect on destroy. Adopted
  in the shared reveal observer and sequence viewport pause.
- MDN/CSS transitions + compositor guidance: keep animation in CSS (compositor
  thread) and prefer transform/opacity. Adopted as the CSS property policy.

## 7. Motion principles
Calm while working, precise while changing, deliberate while explaining. Motion is a
precision instrument: short, controlled, causal, predictable; no decorative bounce,
no excess elasticity, no floating objects, no large purposeless movement. Personality
comes from small owned movements: alignment, confirmation, calibration, progress,
checking, settling.

## 8. Taxonomy
7.1 Interaction feedback — immediate, tiny, in-place (press settle, small colour
    feedback). 7.2 State transition — neutral to optimal, working to result,
    unchecked to verified, closed to open. 7.3 Reveal — opt-in, rare, one-shot,
    small offset, content visible without JS. 7.4 Process/sequence — the
    production-plan demonstration primitive (F9 will consume it). 7.5 Verification —
    alignment/check appearance/receipt settlement, never confetti. 7.6 Measurement/
    instrument — plumb settle, measure reveal; very subtle, no spring/bounce.

## 9. Tokens
Single canonical source: src/shared/motion/tokens.css, namespace --pl-motion-*.
Durations, easings, distances and stagger are tokens; primitives never write raw
values. Small local geometric values that are not a system decision may stay local.

## 10. Easing
Four clearly distinct curves: standard (symmetric, in-place), enter (decelerate),
exit (accelerate), settle (firm controlled arrival, no overshoot). No spring/bounce.

## 11. Duration
One small scale of five: instant 80ms, fast 140ms, normal 220ms, deliberate 320ms,
sequence 2600ms (one autoplay dwell, demo only).

## 12. Distance
Three: tiny 2px (confirmation/calibration), small 8px (reveal/step), medium 16px
(the largest allowed system offset). No large block displacement.

## 13. Stagger policy
Tokenised: step 60ms, HARD cap 5 items. Larger collections (F6) animate the
container or a small first group, never each of N items. The reveal CSS applies a
stagger delay only to the first five children; the sixth onward gets no delay.

## 14. CSS property policy
Never `transition: all`. Animate compositor-friendly transform/opacity by default;
small state feedback on color/background-color/border-color is allowed and measured.
Do NOT animate width/height/top/left/right/bottom/margin/padding/grid-template/
filter/large shadow. No layout animation for looks.

## 15. Reduced-motion policy
Classified, not blanket-killed. Removed: large translations, parallax, decorative or
repeated motion, autoplay spatial sequences. Replaced: movement+fade becomes a short
non-spatial fade/state change that conveys the SAME information. Essential: only if
it communicates information no other way, with an equivalent reduced alternative.

## 16. Preference controller
src/shared/motion/preference.js: reads current state via matchMedia, listens for
runtime change, notifies subscribers, cleans up its listener, idempotent destroy.
Single source of truth for reduced-motion; never fakes or overrides the OS setting.

## 17. Runtime preference changes
If the user switches to reduced motion while a sequence runs: non-essential autoplay
stops, the UI is left in a stable state, the current logical step is kept, focus is
not moved, and it does not jump to step 1. Switching back to no-preference does NOT
auto-resume something the user manually paused (userPaused wins).

## 18. IntersectionObserver policy
One shared observer per configuration (not one per element): observe(target),
unobserve(target) after a one-shot, disconnect() on destroy, deliberate threshold and
rootMargin. Used to avoid running motion off-screen, for one-shot reveal, and to
pause sequences that are not visible. Never a scroll listener for these functions.

## 19. Fallback
If IntersectionObserver is unavailable: content is visible, controls work, sequences
are usable manually, no error is thrown, nothing stays hidden. The reveal observer
reveals every registered target immediately when IO is absent.

## 20. Visibility policy
When document.hidden is true, non-essential autoplay pauses. On returning visible it
may continue ONLY if autoplay is still authorised, the user did not press Pause, and
the component is active/visible. userPaused always wins.

## 21. Pause reasons / state machine
Four separate reasons, each explaining WHY playback is stopped: userPaused (persists),
viewportPaused, documentPaused (initialised from the real document.hidden),
reducedMotion. Autoplay runs only when none is set. User pause always wins over
viewport re-entry, document-visible and reduce->normal. When autoplay reaches the
final step it latches a completed state: the toggle becomes non-operable with a
"Sequence complete. Restart to replay." status instead of a Play that starts a
useless timer. Manual navigation to an earlier step clears the latch; Restart is the
replay action. destroy() restores the static progressive fallback (removes
.pl-seq--enhanced, un-hides every stage, drops aria-current) so no zombie controls
remain. The Play/Pause toggle label
always reflects the real playing state; when autoplay cannot run (reduced motion or
autoplay disabled) the toggle is disabled with an explanatory status rather than a
fake active Pause. Without JS the interactive controls are hidden while the stage
content stays visible.
Re-entering the viewport clears viewportPaused but never userPaused.

## 22. Timers
No setInterval. A self-rescheduling setTimeout models the sequence dwell; every
pending timeout is cancelable; destroy clears them; repeated init/destroy never
stacks loops and no timer survives destroy.

## 23. Cleanup / destroy
Every controller with listeners/observers/timers has an explicit destroy() that
removes listeners, clears timers, disconnects observers, drops references and leaves
the DOM stable. destroy is idempotent (guarded by a destroyed flag).

## 24. Sequence primitive
src/shared/motion/sequence.js: N steps (not fixed at 5), current/prev/next, play,
pause, restart/replay, optional autoplay, userPaused persistence, viewport pause,
document pause, reduced-motion support, cleanup, no-JS readable fallback. Autoplay
stops at the last step; replay is manual. Demonstration only; it does not run the
engine.

## 25. Reveal primitive
src/shared/motion/reveal.js + .pl-reveal: opt-in, one-shot, progressive enhancement,
no-JS visible, no replay on scroll return, no parallax, no large translation, capped
stagger. List policy: animate the container or a small first group for large
collections, never each item.

## 26. State primitive
.pl-motion-state / .pl-motion-state-enter (armed via .pl-motion-state-armed):
separates logical state from transition
presentation. Under reduced motion the logical state appears immediately or via a
short non-spatial alternative.

## 27. Instrument primitive
pl-plumb-settle and pl-measure-reveal: subtle, one-shot, named, purposeful, with a
reduced-motion equivalent (collapse to the static end state), never perpetual.

## 28. Accessibility
Motion never moves focus, steals focus, changes DOM order for an effect, hides the
focused element, or announces frames to screen readers. Logical information changes
first; motion only represents it. Controls are named; pause is accessible; status is
never colour-only; understanding never requires motion.

## 29. Performance
Primitives animate transform/opacity by default; small state feedback on color/
background-color/border-color is allowed and measured. No will-change at all: no
profiling has shown a need, so F4c ships none (a future checkpoint may add a scoped,
lifecycle-limited one WITH evidence). No FPS or
benchmark is invented; the lab is checked in a real Chromium for 0 console errors, 0
uncaught promise errors, 0 horizontal overflow, and no duplicated controller init.

## 30. No-JS
Without JavaScript: all lab content is visible, sequence steps are readable as a
stacked list, states and explanations are present. No content is opacity:0 or
translated or hidden waiting for JS.

## 31. Five-language stress
Motion tolerates real en/es/pt/de/fr strings. Duration is never computed from
character count. No typing effects, no text scrambling, no counters that hide the
final value.

## 32. Responsive
Validated at 1440x1000, 1024x768, 768x1024, 390x844, 320x720: no horizontal page
overflow, no clipped controls, pause reachable, sequence controls tappable, receipt
not crushed. Motion never fixes a broken layout; layout is correct first.

## 33. Lab
design-review/f4c/ is a motion laboratory (not a landing page), outside dist. It
consumes the REAL F4b design system and the REAL F4c motion system; it duplicates no
tokens or components. lab.css is organisational scaffolding only.

## 34. Files added
src/shared/motion/ (tokens.css, primitives.css, preference.js, lifecycle.js,
reveal.js, sequence.js, index.css, index.js), design-review/f4c/ (index.html,
lab.css, lab.js), engine/tests_f4c_motion_system.js,
engine/tests_f4c_motion_system_negative.js, engine/tests_f4c_motion_behavioural.js,
engine/f4c-protected-baseline.json, docs/motion-system.md,
docs/checkpoint-f4c-motion-system.md.

## 35. Files modified
engine/suites.js only, to register the three F4c suites (static positive,
behavioural runtime and negative mutation). No other existing file is modified.

## 36. Protected production
The exact F4b set of 22 production/infra files stays byte-identical, enforced by an
exact-set hash contract (12 core + 3 infra + 2 mirror/worker + 5 catalogue). F4c
modifies none of them.

## 37. Protected F4b system
An independent exact-set contract protects the 23 F4b/F4a static files (17 design system files + the F4b stable component reference
docs/design-system-components.md + 5 historical design-review artifacts) via engine/f4c-protected-baseline.json,
with the expected list fixed in the test, not trusted from the manifest alone.

## 38. Tests
F4c ships THREE suites, registered in engine/suites.js:

1. Static positive suite (engine/tests_f4c_motion_system.js): validates
   protection, architecture, tokens, no-raw-values, CSS policy, keyframe
   consumer/reduced handling, progressive enhancement (feature-specific gates, no
   global coupling), the real sequence stage-enter animation, honest controls,
   final-step completion, destroy static fallback, preference controller, observer
   ownership + fallback, timers, pause-reason separation, sequence behaviour,
   accessibility and roadmap ownership.
2. Behavioural runtime suite (engine/tests_f4c_motion_behavioural.js): a small
   fake-DOM/browser harness built with Node built-ins ONLY (no jsdom, no
   dependency) that RUNS the real controllers and asserts runtime behaviour that
   static regex cannot see — initial document.hidden, runtime reduced-motion
   changes, userPaused precedence over viewport/document/reduce, timer cleanup,
   feature isolation, destroy restoring the static fallback, and the honest
   final-step completion.
3. Negative mutation suite (engine/tests_f4c_motion_system_negative.js): runs
   reproducible mutations, each failing for its specific reason (against the
   positive or the behavioural suite as appropriate), cleaned up in finally, from
   a path with spaces.

## 40. Windows portability
Tests and tooling use Node APIs only (fs.cpSync/rmSync/process.execPath, path,
crypto). No cp/rm/mv/sed/grep/bash/sh/cmd/powershell. Temp copies are removed in
finally and run from a path containing spaces.

## 41. Limitations
F4c ships no public motion. The lab autoplay dwell is a fixed token, not tuned per
content. Instrument primitives are intentionally minimal (two). Reduced-motion
replacement is a short fade, not a bespoke per-primitive alternative.

## 42. Rollback
Delete src/shared/motion/, design-review/f4c/, the three F4c test files,
engine/f4c-protected-baseline.json and the two F4c docs; remove the three F4c entries
from engine/suites.js. Restores the post-F4b state at 13,947.

## 43. Exact F5 ownership
Canonical examples architecture (schemas, projectors, serialisation) is F5. F4c adds
no example schema and no examples.

## 44. Exact F6 ownership
The examples library UI and the large-collection reveal application are F6. F4c only
provides the reusable reveal + list policy; it renders no gallery and no 60 examples.

## 45. Exact F8 ownership
Solver grid personalisation and UX (row/column resizing, grid personalisation) is F8.
F4c provides the state-transition primitive F8 may consume; it changes no Solver.

## 46. Exact F9 ownership
The narrative Home redesign is F9. F4c provides the sequence + reveal + state
primitives F9 will consume; it does not touch or redesign the Home.

## 47. Exact F10 ownership
The redesign of the remaining public/internal pages is F10. F4c wires motion into no
public page.
