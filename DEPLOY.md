# Deployment diagnosis and verification

This closes the recurring mismatch where audits saw an older build than what
was delivered. After this is in place you can state, with evidence:

> "Production corresponds to commit `XXXXXXX`; that commit passed N tests; and
> the served files match the committed source."

## The pieces

- **`build-info.json`** — carries the deployed commit SHA, build time and test
  count. Locally it reads `DEV-LOCAL`. The CI workflow overwrites it at deploy.
- **`assets/build-badge.js`** — on every page, reads `build-info.json` and shows
  `build <sha>` in the footer. The live site now *states its own commit*.
- **`.github/workflows/deploy.yml`** — on push to `main`:
  1. runs `node engine/run_all.js` (red build never deploys);
  2. validates `i18n.js`, JSON-LD, and i18n completeness;
  3. stamps `build-info.json` with commit + timestamp + test count;
  4. writes `assets/hashes.txt` (SHA-256 of every served file);
  5. deploys to Pages;
  6. smoke-tests production: `build-info.json` must report THIS commit, and
     `#capabilities` / `gDirH` / JSON-LD must be present live.
- **`engine/verify_deploy.js`** — run from any machine to compare production
  against local source: `node engine/verify_deploy.js`.

## How to close the diagnosis (do this once)

> **If the smoke test fails with `production reports 'DEV-LOCAL'`:** the site is
> serving the unstamped placeholder. The build job now verifies the uploaded
> artifact IS stamped, so the artifact is fine — the problem is that Pages is
> **not serving the Actions artifact**. Go to **Settings → Pages → Build and
> deployment → Source** and set it to **"GitHub Actions"** (not "Deploy from a
> branch"). A branch source publishes the committed `build-info.json`
> (`DEV-LOCAL`) and ignores the Actions artifact entirely. Fix it, then re-run
> the workflow.

1. **Confirm what production publishes.** In the repo on GitHub:
   Settings → Pages. Note the **Source** (branch + folder, or "GitHub Actions").
   If it is a branch/folder that you are *not* pushing the delivered files to,
   that alone is the gap.

2. **Confirm the delivered files are actually in the repo.** Locally:
   ```
   grep -c 'id="capabilities"' index.html      # expect 1
   grep -c 'gDirH' assets/i18n.js              # expect >= 5 (one per language)
   ls engine/tests_i18n_pages.js               # expect the file
   git status                                  # nothing important uncommitted
   git log --oneline -3
   ```
   If `grep` returns 0 or `ls` fails, the delivered files were never copied into
   the repo — fix the copy step, not the source.

   **Remove any stray `workflows/` folder in the repo root.** The workflow must
   live ONLY at `.github/workflows/deploy.yml`. A copy at the top level
   (`workflows/deploy.yml`) is not run by GitHub, is usually outdated, and would
   be published to the site. Delete it:
   ```
   git rm -r workflows        # only if a top-level workflows/ folder exists
   ```
   The deploy now also excludes `workflows/` from the served site and the smoke
   test asserts `/workflows/deploy.yml` returns 404, as belt-and-braces.

3. **Switch Pages to "GitHub Actions"** (Settings → Pages → Source) so
   `deploy.yml` controls the deploy. Push to `main`. The Actions run must go
   green through the smoke job.

4. **Verify from the outside** once the run finishes (allow a few minutes for
   Pages cache):
   ```
   node engine/verify_deploy.js
   ```
   Green means production = your source at the reported commit.

5. **Read the badge.** Open https://plumline.online and check the footer shows
   `build <sha>` matching `git rev-parse --short HEAD`.

## Note on engine/

The `engine/` folder holds the tests and the dev copy of the solver. It is
committed to the repo because **CI needs it** to run the test battery. What
keeps it off the public site is the deploy workflow's `rsync --exclude 'engine'`
when it builds `_site` — not `.gitignore`. `.gitignore` decides what enters Git;
the workflow decides what gets served. **Do not add `engine/` to `.gitignore`** —
that would remove the tests from the repo and CI would have nothing to run.
