/* build-badge.js — reads build-info.json and shows the deployed commit in the
 * footer, so the running site states exactly which build it is. This is what
 * lets anyone confirm "production corresponds to commit XXXXXXX" without guessing.
 *
 * The element with id="buildBadge" (in every page footer) is filled here. If
 * the fetch fails or the file is the DEV-LOCAL placeholder, the badge stays
 * empty rather than showing a misleading value.
 */
(function () {
  function short(sha) { return (sha && sha !== 'DEV-LOCAL') ? sha.slice(0, 7) : null; }
  function run() {
    var el = document.getElementById('buildBadge');
    if (!el) return;
    fetch('build-info.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (info) {
        if (!info) return;
        var sha = short(info.commit);
        if (!sha) return;                         // DEV-LOCAL or missing: show nothing
        var when = info.builtAt && info.builtAt !== 'unbuilt' ? info.builtAt : '';
        var tests = (typeof info.testsPassed === 'number' && info.testsPassed > 0)
          ? (' \u00b7 ' + info.testsPassed + ' tests') : '';
        el.textContent = 'build ' + sha + (when ? ' \u00b7 ' + when.slice(0, 10) : '') + tests;
        el.setAttribute('title', 'Deployed commit ' + info.commit + (when ? ' at ' + when : ''));
      })
      .catch(function () { /* stay silent on failure */ });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
