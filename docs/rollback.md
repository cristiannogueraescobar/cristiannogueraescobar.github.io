# Rollback — Checkpoint A (Vite dist pipeline)

Each checkpoint must be independently revertible. This documents how to undo the
Checkpoint A build/deploy change and how to verify what production is serving.

## What Checkpoint A changed

- Added `vite.config.mjs`, `.node-version`, Vite as a devDependency, the 7 npm
  scripts, and the validation scripts (`engine/validate_dist.js`,
  `engine/test_dist_http.js`, `engine/validate_html.js`, `engine/verify_all.js`).
- Rewrote the **build job** of `.github/workflows/deploy.yml` to build with Vite
  and publish `dist/` instead of rsyncing the repo into `_site/`.
- Did NOT change: page content, URLs, assets, the engine, the Worker, i18n, the
  smoke job, CNAME, DNS, or the GitHub Pages hosting model.

## Last known-good state before Checkpoint A

- The previous pipeline published `_site/` (an rsync of the repo minus dev files),
  not `dist/`. The last commit on `main` using that workflow is the rollback
  target. Record its SHA here when cutting the refactor branch:
  - Last stable `main` SHA (pre-Vite): `__________` (fill in at merge time).

## How to revert the workflow to the previous (\_site rsync) pipeline

The refactor lives on `refactor/modular-architecture` and is NOT merged. So the
simplest rollback is: **do not merge it.** `main` keeps deploying via the old
`_site` rsync workflow.

If Checkpoint A was already merged and you need to undo it on `main`:

1. `git revert` the merge (or the "ci: publish validated dist" commit) so
   `.github/workflows/deploy.yml` returns to the `_site` rsync version.
2. Keep or remove `vite.config.mjs`, `.node-version`, and the Vite devDependency —
   they are inert unless the workflow calls them. Removing them is optional.
3. Push to `main`; the old workflow runs and republishes `_site/`.

The old build job, for reference, did: run tests → stamp `build-info.json` in the
repo root → `rsync` repo into `_site/` excluding `.git .github _site engine
DEPLOY.md hashes.txt node_modules package.json package-lock.json workflows` →
hash `_site` → upload `_site`.

## How to publish a previous dist manually (emergency)

If Actions is unavailable and you must publish a known-good build by hand:

1. Check out the target commit.
2. `npm ci && npm run build` (produces `dist/`).
3. Manually stamp `dist/build-info.json` with that commit SHA (the CI step
   normally does this):
   ```
   node -e 'require("fs").writeFileSync("dist/build-info.json",
     JSON.stringify({commit:"<SHA>",builtAt:new Date().toISOString(),
     testsPassed:6742,buildSystem:"vite",hosting:"GitHub Pages"},null,2)+"\n")'
   ```
4. Write hashes: `cd dist && find . -type f ! -path './assets/hashes.txt' -print0
   | sort -z | xargs -0 sha256sum > assets/hashes.txt`.
5. Publish `dist/` through whatever Pages mechanism is in use (Actions artifact,
   or a branch if Source is temporarily set to a branch).

## How to verify what production is serving

- **Commit served:** `curl -LsS https://plumline.online/build-info.json` — the
  `commit` field must equal the SHA you expect.
- **Files match hashes:** download `assets/hashes.txt` and each served file with
  the same cache-buster, then `sha256sum -c`. (The smoke job does this by fetching
  everything once with one cache-buster and comparing.)
- **Content markers:** `#capabilities` in index.html, `gDirH` in i18n.js,
  `#cap-model-continuous` in capabilities.html.
- **Internal files 404:** `/engine/run_all.js`, `/package.json`,
  `/package-lock.json`, `/node_modules/...`, `/.github/workflows/deploy.yml` must
  all
  return 404.
- **Custom domain:** `curl -sSI https://plumline.online/build-info.json` should
  show GitHub Pages headers (`server: GitHub.com`, `x-github-request-id`). If the
  domain resolves elsewhere, that's a DNS/hosting problem, not a build problem.

## Anti-stale guarantees to keep

Never weaken the smoke job's anti-stale design when rolling back or forward:
one cache-buster per run, poll `build-info.json` until it reports the deployed
SHA, download every resource once with that buster, and compare against the same
fetch. This is what lets you state "production is commit X, which passed N tests,
and the served bytes match the manifest."
