/**
 * tests_region_plot.js — the 2-variable feasible-region plot must tell the
 * truth about unbounded regions. solve2D() detects whether the region recedes
 * to infinity (via an EXACT recession-cone check, not an angular mesh that can
 * miss rays like the 45-degree x=y ray); drawFeasibleRegion() then renders an
 * OPEN band with a localized note and aria-label — never a closed polygon that
 * misrepresents an infinite region as finite.
 *
 * Drives the real inline solve2D() and drawFeasibleRegion() from solver.html
 * (exposed via the test-only hook) inside jsdom. Requires jsdom (CI installs).
 *
 * Run: node engine/tests_region_plot.js
 */
const fs = require('fs');
const path = require('path');

let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) {
  if (process.env.CI) { console.error('REGION PLOT TESTS  FAILED: jsdom missing under CI'); process.exit(1); }
  console.log('REGION PLOT TESTS  SKIPPED (jsdom not installed — run npm ci)');
  process.exit(0);
}

const siteDir = path.join(__dirname, '..');
const solverHtml = fs.readFileSync(path.join(siteDir, 'solver.html'), 'utf8');
const i18nSrc = fs.readFileSync(path.join(siteDir, 'assets', 'i18n.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, detail) { if (cond) pass++; else { fail++; console.log('  FAIL:', name, detail || ''); } }

const htmlNoExternal = solverHtml.replace(/<script src="assets\/[^"]*"[^>]*><\/script>/g, '');

const dom = new JSDOM(htmlNoExternal, {
  runScripts: 'dangerously',
  url: 'https://plumline.online/solver.html',
  beforeParse(window) {
    window.__PLUMLINE_TEST__ = true;
    window.matchMedia = window.matchMedia || function () { return { matches: false, addEventListener() {}, addListener() {} }; };
    window.scrollTo = window.scrollTo || function () {};
    if (window.Element) window.Element.prototype.scrollIntoView = function () {};
    window.console.log = function () {};
    window.console.warn = function () {};
    window.eval(i18nSrc);
  }
});
const { window } = dom;

setTimeout(function () {
  const api = window.__plumline;
  if (!api || !api.solve2D || !api.drawFeasibleRegion) {
    console.log('REGION PLOT TESTS  FAILED: test hook not installed'); process.exit(1);
  }
  const document = window.document;
  const solve2D = api.solve2D;
  const obj = { x: 1, y: 1 };

  // ---- solve2D detection ------------------------------------------------

  {
    const geo = solve2D(obj, [ { x:1, y:0, op:'<=', b:4 }, { x:0, y:1, op:'<=', b:3 } ]);
    ok('bounded region: has vertices', geo.vertices.length >= 3, JSON.stringify(geo.vertices));
    ok('bounded region: NOT flagged unbounded', geo.unbounded === false, String(geo.unbounded));
  }

  {
    const geo = solve2D(obj, [ { x:1, y:0, op:'<=', b:5 } ]);
    ok('x<=5 region: flagged unbounded', geo.unbounded === true, String(geo.unbounded));
    ok('x<=5 region: recession has +y component', !!geo.recession && geo.recession.y > 0.5,
       JSON.stringify(geo.recession));
  }

  {
    const geo = solve2D(obj, [ { x:1, y:1, op:'>=', b:2 } ]);
    ok('x+y>=2 region: flagged unbounded', geo.unbounded === true, String(geo.unbounded));
  }

  // EXACT 45-degree ray: x - y = 0, x + y >= 2. Direction is exactly (1,1)/√2;
  // an even-degree angular mesh would miss it. The exact check must catch it.
  {
    const geo = solve2D(obj, [ { x:1, y:-1, op:'=', b:0 }, { x:1, y:1, op:'>=', b:2 } ]);
    ok('x=y ray (45 deg exact): flagged unbounded', geo.unbounded === true, String(geo.unbounded));
    ok('x=y ray: recession ~ (1,1) normalized', !!geo.recession &&
       Math.abs(geo.recession.x - geo.recession.y) < 1e-6 && geo.recession.x > 0.5,
       JSON.stringify(geo.recession));
  }

  // Narrow cone (a wedge thinner than the old mesh step).
  {
    const geo = solve2D(obj, [ { x:3, y:-1, op:'>=', b:0 }, { x:1, y:-3, op:'<=', b:0 },
                               { x:1, y:1, op:'>=', b:1 } ]);
    ok('narrow cone: flagged unbounded', geo.unbounded === true, String(geo.unbounded));
  }

  {
    const geo = solve2D(obj, [ { x:1, y:1, op:'<=', b:10 }, { x:1, y:0, op:'<=', b:4 },
                               { x:0, y:1, op:'<=', b:8 } ]);
    ok('bounded triangle: NOT flagged unbounded', geo.unbounded === false, String(geo.unbounded));
  }

  // ---- drawFeasibleRegion DOM rendering --------------------------------

  function clearResult() { document.getElementById('result').innerHTML = ''; }
  function mkOut(constraints, values) {
    return {
      status: 'optimal', modelType: 'continuous', objective: 0,
      objectiveLabel: 'Z', labels: ['x', 'y'], previous: [0, 0], values: values,
      constraints: constraints,
      plot: { objective: [1, 1], variableLabels: ['x', 'y'] },
    };
  }

  {
    window.__plumline.setLang('en');
    clearResult();
    const out = mkOut([{ label: 'CapX', coefficients: [1, 0], relation: '<=', limit: 5, binding: true }], [5, 6]);
    api.drawFeasibleRegion(out);
    const result = document.getElementById('result');
    const openPoly = result.querySelector('.region.open');
    const closedPoly = result.querySelector('.region:not(.open)');
    const note = result.querySelector('.region-unbounded-note');
    const svg = result.querySelector('svg.plot');
    ok('unbounded render: draws .region.open (not a closed polygon)', !!openPoly && !closedPoly,
       'open=' + !!openPoly + ' closed=' + !!closedPoly);
    ok('unbounded render: shows the localized unbounded note', !!note && /unbounded/i.test(note.textContent),
       note ? note.textContent.slice(0, 40) : 'no note');
    ok('unbounded render: aria-label mentions unbounded', !!svg && /unbounded/i.test(svg.getAttribute('aria-label')),
       svg ? svg.getAttribute('aria-label') : 'no svg');
    ok('unbounded render: open polygon has finite points',
       !!openPoly && /^[\d.,\s-]+$/.test(openPoly.getAttribute('points')) &&
       openPoly.getAttribute('points').trim().length > 0,
       openPoly ? openPoly.getAttribute('points').slice(0, 40) : 'no poly');
  }

  {
    window.__plumline.setLang('es');
    clearResult();
    const out = mkOut([
      { label: 'CapX', coefficients: [1, 0], relation: '<=', limit: 4, binding: true },
      { label: 'CapY', coefficients: [0, 1], relation: '<=', limit: 3, binding: true },
    ], [4, 3]);
    api.drawFeasibleRegion(out);
    const result = document.getElementById('result');
    const openPoly = result.querySelector('.region.open');
    const closedPoly = result.querySelector('.region:not(.open)');
    const note = result.querySelector('.region-unbounded-note');
    const svg = result.querySelector('svg.plot');
    ok('bounded render: draws a closed .region (not .open)', !!closedPoly && !openPoly,
       'open=' + !!openPoly + ' closed=' + !!closedPoly);
    ok('bounded render: no unbounded note', !note, note ? note.textContent : '');
    ok('bounded render: aria-label is localized (not English)',
       !!svg && svg.getAttribute('aria-label') === 'Regi\u00f3n factible con el \u00f3ptimo marcado',
       svg ? svg.getAttribute('aria-label') : 'no svg');
  }

  // Shoelace area of a polygon points-string "x,y x,y ...".
  function shoelace(pointsAttr) {
    const pts = String(pointsAttr).trim().split(/\s+/).map(function (p) {
      return p.split(',').map(Number);
    });
    let a = 0;
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length;
      a += pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1];
    }
    return Math.abs(a) / 2;
  }
  function distinctCount(pointsAttr) {
    const seen = {};
    String(pointsAttr).trim().split(/\s+/).forEach(function (p) { seen[p] = 1; });
    return Object.keys(seen).length;
  }

  // EQUALITY RAY (the regression): x - y = 0, x + y >= 2 has ONE vertex (1,1)
  // and recedes along (1,1). It must render as a .region-ray polyline, NEVER a
  // zero-area [far, vertex, far] polygon.
  {
    window.__plumline.setLang('en');
    clearResult();
    const out = mkOut([
      { label: 'Eq', coefficients: [1, -1], relation: '=', limit: 0, binding: true },
      { label: 'Sum', coefficients: [1, 1], relation: '>=', limit: 2, binding: true },
    ], [1, 1]);
    api.drawFeasibleRegion(out);
    const result = document.getElementById('result');
    const ray = result.querySelector('.region-ray.open');
    const poly = result.querySelector('polygon.region');
    ok('equality ray: rendered as .region-ray.open polyline', !!ray, ray ? 'ray present' : 'no ray');
    ok('equality ray: NOT a polygon', !poly, poly ? poly.getAttribute('points') : '');
    ok('equality ray: aria-label mentions unbounded',
       /unbounded/i.test(result.querySelector('svg.plot').getAttribute('aria-label')));
    if (ray) {
      const pts = ray.getAttribute('points').trim().split(/\s+/);
      ok('equality ray: polyline has two distinct endpoints',
         pts.length === 2 && pts[0] !== pts[1], ray.getAttribute('points'));
    }
  }

  // 2-D UNBOUNDED region with a single vertex: x + y >= 0 (redundant with the
  // axes) leaves the whole first quadrant feasible. The visible region must be
  // an area spanning both axes, NOT a single line.
  {
    window.__plumline.setLang('en');
    clearResult();
    const out = mkOut([{ label: 'S', coefficients: [1, 1], relation: '>=', limit: 0, binding: false }], [0, 0]);
    api.drawFeasibleRegion(out);
    const result = document.getElementById('result');
    const poly = result.querySelector('polygon.region.open');
    ok('first-quadrant region: drawn as an open polygon', !!poly, poly ? 'poly present' : 'no poly');
    ok('first-quadrant region: polygon area is positive (not a line)',
       !!poly && shoelace(poly.getAttribute('points')) > 1, poly ? String(shoelace(poly.getAttribute('points'))) : '-');
  }

  // Every .region.open polygon that IS drawn must enclose positive area — this
  // is the direct guard against the [far, vertex, far] degeneracy. Re-check the
  // x<=5 case with shoelace.
  {
    window.__plumline.setLang('en');
    clearResult();
    const out = mkOut([{ label: 'CapX', coefficients: [1, 0], relation: '<=', limit: 5, binding: true }], [5, 6]);
    api.drawFeasibleRegion(out);
    const poly = document.getElementById('result').querySelector('polygon.region.open');
    ok('x<=5 open polygon: positive shoelace area',
       !!poly && shoelace(poly.getAttribute('points')) > 1, poly ? String(shoelace(poly.getAttribute('points'))) : '-');
    ok('x<=5 open polygon: at least 3 distinct points',
       !!poly && distinctCount(poly.getAttribute('points')) >= 3,
       poly ? poly.getAttribute('points') : '-');
  }

  // Structural guard: the recession detection must be the EXACT algebraic
  // cone check, not the old angular mesh, and the render must clip to the box.
  // (Reads the source so a silent reversion to sampling angles is caught even
  // if some behavioural case happened to still pass.)
  {
    ok('source: uses clipFeasibleToBox_ for rendering', /function clipFeasibleToBox_/.test(solverHtml));
    ok('source: draws a .region-ray for 1-D regions', /region-ray/.test(solverHtml));
    ok('source: no angular mesh (a += 2 degree sampling) remains',
       !/for\s*\(\s*var\s+a\s*=\s*0\s*;\s*a\s*<=\s*90\s*;\s*a\s*\+=\s*2\s*\)/.test(solverHtml));
    // Every constraint must be normalised before use in the geometry pipeline,
    // and the line/polygon choice must be geometric (polygonDimension_), not the
    // user's "=" symbol.
    ok('source: defines normalizeConstraint_', /function normalizeConstraint_/.test(solverHtml));
    ok('source: solve2D normalises its constraints',
       /consRaw\.map\(normalizeConstraint_\)/.test(solverHtml));
    ok('source: clip normalises its constraints',
       /cons\.map\(normalizeConstraint_\)/.test(solverHtml));
    ok('source: dimension decided by polygonDimension_, not the "=" symbol',
       /function polygonDimension_/.test(solverHtml) && /polygonDimension_\(clip\.points/.test(solverHtml));
  }

  // BOUNDED EQUALITY SEGMENT (the regression): x - y = 0, x + y <= 2 is the
  // segment (0,0)-(1,1). It is 1-D so it draws as .region-ray, but it is BOUNDED
  // so it must NOT be dashed (.open) and must NOT show the unbounded note — the
  // presentation must be internally consistent with the bounded aria-label.
  {
    window.__plumline.setLang('en');
    clearResult();
    const out = mkOut([
      { label: 'Eq', coefficients: [1, -1], relation: '=', limit: 0, binding: true },
      { label: 'Sum', coefficients: [1, 1], relation: '<=', limit: 2, binding: true },
    ], [1, 1]);
    api.drawFeasibleRegion(out);
    const result = document.getElementById('result');
    const ray = result.querySelector('.region-ray');
    const rayOpen = result.querySelector('.region-ray.open');
    const note = result.querySelector('.region-unbounded-note');
    const svg = result.querySelector('svg.plot');
    ok('bounded segment: rendered as .region-ray', !!ray, ray ? 'ray' : 'no ray');
    ok('bounded segment: NOT dashed (.open absent)', !rayOpen, rayOpen ? 'has .open' : '');
    ok('bounded segment: no unbounded note', !note, note ? note.textContent : '');
    ok('bounded segment: bounded aria-label',
       !!svg && /Feasible region/.test(svg.getAttribute('aria-label')),
       svg ? svg.getAttribute('aria-label') : 'no svg');
    if (ray) {
      const pts = ray.getAttribute('points').trim().split(/\s+/);
      ok('bounded segment: two distinct endpoints', pts.length === 2 && pts[0] !== pts[1],
         ray.getAttribute('points'));
    }
  }

  // THIN 2-D RECTANGLE: 0<=x<=1e-7, 0<=y<=1 is a real rectangle with a tiny area
  // in model units. It must render as a POLYGON, not collapse to a ray — the
  // line/polygon choice must not depend on the model's units. (No equality is
  // present, so it is 2-D by construction.)
  {
    window.__plumline.setLang('en');
    clearResult();
    const out = mkOut([
      { label: 'Cx', coefficients: [1, 0], relation: '<=', limit: 1e-7, binding: true },
      { label: 'Cy', coefficients: [0, 1], relation: '<=', limit: 1, binding: true },
    ], [1e-7, 1]);
    api.drawFeasibleRegion(out);
    const result = document.getElementById('result');
    ok('thin rectangle: drawn as a polygon (not a ray)',
       !!result.querySelector('polygon.region') && !result.querySelector('.region-ray'),
       'poly=' + !!result.querySelector('polygon.region') + ' ray=' + !!result.querySelector('.region-ray'));
  }

  // SCALE INVARIANCE of unboundedness: x<=5 and 1e-12*x<=5e-12 describe the same
  // bounded region (x<=5). Both must be classified bounded — the recession check
  // must normalise per-constraint coefficients, not use a raw absolute
  // tolerance that treats 1e-12 as zero.
  {
    const a = solve2D(obj, [ { x:1, y:0, op:'<=', b:5 }, { x:0, y:1, op:'<=', b:5 } ]);
    const b = solve2D(obj, [ { x:1e-12, y:0, op:'<=', b:5e-12 }, { x:0, y:1, op:'<=', b:5 } ]);
    ok('scale: x<=5 (normal coeffs) is bounded', a.unbounded === false, String(a.unbounded));
    ok('scale: 1e-12*x<=5e-12 (tiny coeffs) is ALSO bounded', b.unbounded === false, String(b.unbounded));
  }

  // ---- Geometric dimension & scale-invariant geometry ------------------

  // FALSE REGION guard: 1e-12*x <= 5e-12 (== x<=5), x<=100, y<=5. The visible
  // region must stop at x=5, not extend to x=100 — every geometry function must
  // treat the tiny-coefficient row on the same scale as the others.
  {
    window.__plumline.setLang('en');
    clearResult();
    const out = mkOut([
      { label: 'Tiny', coefficients: [1e-12, 0], relation: '<=', limit: 5e-12, binding: true },
      { label: 'Big', coefficients: [1, 0], relation: '<=', limit: 100, binding: false },
      { label: 'Cy', coefficients: [0, 1], relation: '<=', limit: 5, binding: true },
    ], [5, 5]);
    api.drawFeasibleRegion(out);
    const poly = document.getElementById('result').querySelector('polygon.region');
    ok('false-region guard: polygon exists', !!poly, poly ? 'ok' : 'no poly');
    if (poly) {
      const pts = poly.getAttribute('points').trim().split(/\s+/).map(function (p) { return p.split(',').map(Number); });
      // convert screen x back is unnecessary — just check the clip stopped at x=5
      const clip = api.clipFeasibleToBox_(out.constraints.map(function (c) {
        return { x: c.coefficients[0], y: c.coefficients[1], op: c.relation, b: c.limit };
      }), 100 * 1.15, 5 * 1.15);
      const maxCx = Math.max.apply(null, clip.points.map(function (p) { return p.x; }));
      ok('false-region guard: region stops at x=5 (not 100)', maxCx <= 5 + 1e-6, 'maxX=' + maxCx);
    }
  }

  // polygonDimension_ classifies geometry, not the user's "=" symbol.
  {
    const pd = api.polygonDimension_;
    ok('dimension: square is 2-D',
       pd([{x:0,y:0},{x:5,y:0},{x:5,y:5},{x:0,y:5}], 5, 5) === 2);
    ok('dimension: collinear points are 1-D',
       pd([{x:0,y:0},{x:1,y:1},{x:2,y:2}], 2, 2) === 1);
    ok('dimension: single point is 0-D', pd([{x:1,y:1}], 5, 5) === 0);
    ok('dimension: thin-but-real rectangle is 2-D (relative tolerance)',
       pd([{x:0,y:0},{x:1e-7,y:0},{x:1e-7,y:1},{x:0,y:1}], 1e-7, 1) === 2);
  }

  // REDUNDANT 0=0 equality must NOT force a 1-D render: the region is a square.
  {
    window.__plumline.setLang('en');
    clearResult();
    const out = mkOut([
      { label: 'X', coefficients: [1, 0], relation: '<=', limit: 5, binding: true },
      { label: 'Y', coefficients: [0, 1], relation: '<=', limit: 5, binding: true },
      { label: 'Zero', coefficients: [0, 0], relation: '=', limit: 0, binding: false },
    ], [5, 5]);
    api.drawFeasibleRegion(out);
    const result = document.getElementById('result');
    ok('redundant 0=0: drawn as polygon (not a diagonal ray)',
       !!result.querySelector('polygon.region') && !result.querySelector('.region-ray'),
       'poly=' + !!result.querySelector('polygon.region') + ' ray=' + !!result.querySelector('.region-ray'));
  }

  // 1-D region WITHOUT an "=" symbol: two opposite inequalities pin x=y.
  {
    window.__plumline.setLang('en');
    clearResult();
    const out = mkOut([
      { label: 'A', coefficients: [1, -1], relation: '<=', limit: 0, binding: true },
      { label: 'B', coefficients: [1, -1], relation: '>=', limit: 0, binding: true },
      { label: 'C', coefficients: [1, 1], relation: '<=', limit: 2, binding: true },
    ], [1, 1]);
    api.drawFeasibleRegion(out);
    const result = document.getElementById('result');
    ok('opposite inequalities (x=y, no "="): drawn as a ray/segment',
       !!result.querySelector('.region-ray') && !result.querySelector('polygon.region'),
       'ray=' + !!result.querySelector('.region-ray') + ' poly=' + !!result.querySelector('polygon.region'));
  }

  // Thin-but-real rectangle must be VISIBLE, not a sub-pixel sliver: with
  // relative padding the polygon must span a meaningful screen width.
  {
    window.__plumline.setLang('en');
    clearResult();
    const out = mkOut([
      { label: 'X', coefficients: [1, 0], relation: '<=', limit: 1e-7, binding: true },
      { label: 'Y', coefficients: [0, 1], relation: '<=', limit: 1, binding: true },
    ], [1e-7, 1]);
    api.drawFeasibleRegion(out);
    const poly = document.getElementById('result').querySelector('polygon.region');
    ok('thin rectangle: rendered as a polygon', !!poly, poly ? 'ok' : 'no poly');
    if (poly) {
      const xsArr = poly.getAttribute('points').trim().split(/\s+/).map(function (p) { return Number(p.split(',')[0]); });
      const width = Math.max.apply(null, xsArr) - Math.min.apply(null, xsArr);
      ok('thin rectangle: visible screen width > 1px (relative padding)', width > 1, 'width=' + width);
    }
  }

  console.log('REGION PLOT TESTS  PASSED: ' + pass + '   FAILED: ' + fail);
  process.exit(fail > 0 ? 1 : 0);
}, 120);
