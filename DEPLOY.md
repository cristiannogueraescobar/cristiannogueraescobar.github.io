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

The `engine/` folder is tests and the dev copy of the solver; the user's
`.gitignore` excludes it from the *served* site, but the tests still need to be
**in the repo** for CI to run them. Ensure `engine/` is committed (it can be in
the repo without being served). If `.gitignore` currently ignores `engine/`
entirely, change it to ignore only what should not ship, or run CI from a path
that includes the tests.
