# Plumline motion system — API reference

Stable reference for the F4c motion primitives and controllers. Canonical source:
`src/shared/motion/`. Namespace `--pl-motion-*` / `.pl-motion-*` / `.pl-reveal` /
`.pl-seq*`. No framework, no dependency, native CSS + native browser APIs.

Import the CSS via `src/shared/motion/index.css`. For JS, `src/shared/motion/index.js`
is the CANONICAL public entry point and is BOTH browser-safe and Node-safe: under
CommonJS it require()s the modules; in a classic browser `<script>` (no `require`) it
assembles the API from the `window.Plumline*` globals the module scripts attach, and
exposes `window.PlumlineMotion`. It never assumes a bundler and never throws a
`require is not defined` error. Motion lives OUTSIDE the F4b design system so F4b
stays byte-identical.

## Anti-patterns (system-wide)
- No `transition: all`. No `infinite` decorative animation. No perpetual pulse,
  floating cards, looping plumb, shimmer, animated backgrounds or marquee.
- No layout-geometry animation (width/height/top/left/right/bottom/margin/padding/
  grid-template/filter/large shadow). Animate transform/opacity; small colour
  feedback is allowed and measured.
- No global `will-change`. No scroll listener for reveal. No `setInterval` for
  sequences. Motion never moves focus, steals focus, reorders DOM for an effect, or
  announces frames to screen readers.
- No raw durations/easings/distances in primitives; use the tokens.

## Tokens (tokens.css)
- Purpose: the single source of durations, easings, distances and stagger.
- Duration: `--pl-motion-duration-instant|fast|normal|deliberate|sequence`.
- Easing: `--pl-motion-ease-standard|enter|exit|settle`.
- Distance: `--pl-motion-distance-tiny|small|medium`.
- Stagger: `--pl-motion-stagger-step` and `--pl-motion-stagger-max` (hard cap 5).
- Performance: durations are short; primitives built on these animate transform/
  opacity.
- Intended future users: all motion consumers (F6/F8/F9/F10).

## createMotionPreference() (preference.js)
- Purpose: single source of truth for `prefers-reduced-motion`, live.
- API: `reduced()` -> boolean; `subscribe(fn)` -> unsubscribe; `destroy()`.
- State model: reads matchMedia; emits on runtime `change`.
- Reduced-motion behaviour: it IS the reduced-motion signal; never faked/overridden.
- No-JS behaviour: not applicable (JS controller); CSS `@media` covers no-JS.
- Lifecycle/destroy: removes the media listener, drops subscribers; idempotent.
- Accessibility: enables honouring the OS preference at runtime.
- Intended future users: F9 (sequence), F8/F9/F10 (state), F6 (reveal).

## lifecycle helpers (lifecycle.js)
- `createTimerGroup()` — cancelable setTimeout ownership (NO setInterval): `after`,
  `cancel`, `clear`, `size`, `destroy`. A repeating dwell is a self-rescheduling
  timeout so pause/resume/cancel never stack callbacks; nothing survives destroy.
- `createVisibility(onChange)` — document.hidden with a `visibilitychange` listener
  and `destroy()`.
- `createRevealObserver(onEnter, options)` — ONE shared IntersectionObserver:
  `observe`, `unobserve`, `disconnect`, `destroy`, `supported`. One-shot: unobserve
  after enter. Fallback: if IO is absent, `onEnter` fires for every target
  immediately (content visible, no error).
- Intended future users: every controller (shared cleanup + observer ownership).

## createReveal(root) (reveal.js)
- Purpose: opt-in, one-shot reveal via progressive enhancement.
- Required markup: elements with class `.pl-reveal` (optionally inside
  `.pl-reveal-group` for capped stagger).
- State model: arms each target with the feature-specific flag `.pl-reveal-armed`
  (which alone applies the start-state), reveals once on first intersection
  (`.pl-reveal-in`). NO global `.pl-motion` flag: a reveal controller cannot change
  another feature's visibility.
- Reduced-motion: CSS replaces the offset with a short fade; still reveals.
- No-JS: the `.pl-reveal` start-state applies only to `.pl-reveal-armed`, which only
  the controller adds, so without JS the content is fully visible.
- Lifecycle/destroy: `reset()` (lab-only replay), `destroy()` disconnects the
  observer and removes `.pl-reveal-armed` from every managed target, so a target
  destroyed BEFORE it entered the viewport is left visible, and a revealed one
  stays visible.
- Performance: no will-change (no profiling has shown a need); transform/opacity only.
- Accessibility: no focus movement; nothing announced.
- Intended future users: F9/F10 (page reveals), F6 (list policy).

## createSequence(root, deps) (sequence.js)
- Purpose: reusable product-sequence DEMONSTRATION (N steps). It does NOT run the
  engine.
- Required markup: `[data-seq]` root with `.pl-seq__step` buttons, `.pl-seq__stage`
  panels, optional `.pl-seq__dot` buttons, `[data-seq-toggle]`, `[data-seq-restart]`,
  optional `data-seq-autoplay="true"`.
- State model: current step, `aria-current="step"` on the active step/dot; N steps.
- Pause model: four SEPARATE reasons — userPaused (persists), viewportPaused,
  documentPaused (INITIALISED from the real `document.hidden`), reducedMotion.
  Autoplay runs only when none is set; viewport re-entry, document-visible and
  reduce->normal never clear userPaused.
- API: `state()`, `next()`, `prev()`, `goto(n)`, `toggle()`, `restart()`,
  `pendingTimers()`, `destroy()`.
- Autoplay: stops at the last step (no infinite loop) and LATCHES a "completed"
  state so the toggle becomes non-operable (a disabled control with a
  "Sequence complete. Restart to replay." status) rather than a Play that starts a
  useless timer. Manual navigation to an earlier step clears the latch; Restart is
  the replay action and never auto-jumps to step 1.
- Reduced-motion: no spatial autoplay; stays on the current step.
- No-JS: all stages are a readable stacked list.
- Lifecycle/destroy: clears timers, disconnects observer, removes listeners,
  unsubscribes preference; idempotent; RESTORES the static progressive fallback —
  removes .pl-seq--enhanced (so the JS-only controls return to their no-JS hidden
  state), un-hides EVERY stage (readable stacked list) and drops aria-current — so
  no zombie controls remain.
- Honest controls: the toggle label ALWAYS reflects the real playing state. When
  autoplay cannot run (reduced motion, or autoplay disabled) the toggle is disabled
  with an explanatory status instead of a fake active "Pause"; manual step/dot
  navigation still works. Without JS the interactive controls are hidden (they only
  work after enhancement) while the stage content stays visible.
- Accessibility: never moves focus; no per-frame announcement.
- Intended future users: F9 (Home narrative).

## State primitive (.pl-motion-state / .pl-motion-state-enter)
- Purpose: present a logical state change (processing to optimal/incomplete,
  unchecked to checked, neutral to selected).
- State model: the logical class/text/badge changes FIRST; the enter start-state
  applies only to a surface the controller armed (`.pl-motion-state-armed`);
  `.pl-motion-in` settles the visual. Without JS the surface is fully visible.
- Reduced-motion: no spatial offset; a short fade or immediate state.
- Intended future users: F8/F9/F10.

## Instrument primitives (pl-plumb-settle, pl-measure-reveal)
- Purpose: subtle Plumline identity motion (a plumb line settling, a measure
  revealing along its length).
- State model: one-shot keyframes run when the run class is added.
- Reduced-motion: collapse to the static end state (no spatial/scaling motion).
- Anti-patterns: never perpetual, never bounce/spring.
- Intended future users: F8/F9 (measurement moments).

## List policy (for F6)
Large collections do NOT animate each item. The stagger is capped at 5; beyond that,
animate the container or a small first group. F6 depends on this decision.
