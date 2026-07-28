# Plumline engine — test harness + fixes

Run:  node tests.js          (25 core tests)
      node tests_states.js   (3 state-integrity tests)

## Status
Core:  25 / 25 passing
State:  3 /  3 passing

## Fix 1 — simplex phase 1 (>= constraints)
Phase 1 could leave an artificial variable basic at ~0; phase 2 could re-inflate
it and silently violate its >= or = constraint, still reporting 'optimal'. Since
branch-and-bound adds >= branches, integer optima needing round-UP were missed.
Fixed by driving zero-valued artificials out of the basis after phase 1, and by
checking phase 1's iterate_ status.
Evidence: case 07 now 20 'optimal' (was 19 'feasible'); 200 random round-up
models: original wrong on 9, fixed on 0; canonical still 1760.

## Fix 2 — state integrity (never a false 'infeasible')
Branch-and-bound abandoned any non-optimal branch without distinguishing why. An
iteration/time/node limit or numerical failure on a branch could end up reported
as 'infeasible' — "could not compute" disguised as "impossible".

Now:
- Only a PROVEN-complete search with no solution returns 'infeasible'.
- A branch that hits a limit or fails marks the search incomplete (exhausted=false)
  and records a stopReason.
- With no solution and an incomplete search, the engine returns:
    { status: 'unknown', stopReason: 'iteration_limit'|'time_limit'|'node_limit'|...,
      optimalityProven: false, nodesExplored: N, objective: null, values: null }
- A found solution carries stopReason / optimalityProven / nodesExplored too.

Internal states: optimal, feasible, infeasible, unbounded, time_limit,
node_limit, iteration_limit, numerical_failure, unknown.

User-facing messages (explainStatus_):
- infeasible         -> "No feasible solution exists" (limits contradict)
- optimal            -> proven optimum
- feasible           -> found, optimality not proven
- unbounded          -> "The model appears unbounded..."
- numerical_failure  -> "A numerical problem prevented a reliable result..."
- unknown / limits   -> "The search stopped before a conclusion could be reached..."

The state test (tests_states.js) loads a copy of the engine with MAX_ITERATIONS=3,
feeds it a model that provably has a solution, and asserts the engine does NOT
report 'infeasible'. It fails on the pre-fix engine and passes on the fixed one.

Applied to both engine.js and the production engine in solver.html.
