  function renderReceipt(out,model){
    var res=document.getElementById('result');
    var money=''; // we don't assume currency
    var h='<div class="receipt">';
    h+='<div class="tot"><span>'+esc(out.objectiveLabel||t('exResult'))+'</span><b>'+fmt(out.objective)+'</b></div>';
    (out.labels||[]).forEach(function(lb,i){
      h+='<div class="r"><span class="k">'+esc(lb)+'</span><span class="v">'+fmt(out.previous[i])+' &rarr; '+fmt(out.values[i])+'</span></div>';
    });
    (out.constraints||[]).forEach(function(c){
      var pct=c.limit?Math.min(100,Math.abs(c.used/c.limit)*100):0;
      h+='<div class="lim'+(c.satisfied?'':' over')+'"><div class="r"><span class="k">'+esc(c.label)+'</span><span class="v">'+fmt(c.used)+' / '+fmt(c.limit)+(c.binding?' '+t('atLimit'):'')+'</span></div><div class="bar"><i style="width:'+pct+'%"></i></div>';
      if(c.binding&&typeof c.objectiveDelta==='number'&&c.objectiveDelta!==0)
        h+='<div class="shadow">'+t('relaxImprove')+fmt(Math.abs(c.objectiveDelta))+'</div>';
      h+='</div>';
    });
    // Variable limits: show each configured variable's type and bounds, and
    // verify the result honours them. This makes the domains part of the
    // verification, not just something applied silently during the solve.
    if(out.variableDomains && out.variableDomains.length){
      var typeShort={continuous:t('typeContinuous'),integer:t('typeInteger'),binary:t('typeBinary')};
      h+='<div class="vlim-head">'+esc(t('varLimitsTitle'))+'</div>';
      out.variableDomains.forEach(function(d){
        var range=(d.type==='binary')?'0 / 1':
          (fmt(d.min)+' / '+(d.max==null?'&#8734;':fmt(d.max)));
        var mark=d.satisfied?'&#10003;':'&#10007;';
        var bind='';
        if(d.upperBinding && d.lowerBinding) bind=' '+t('atFixed');   // min = max
        else if(d.upperBinding) bind=' '+t('atMax');
        else if(d.lowerBinding) bind=' '+t('atMin');
        h+='<div class="vlim'+(d.satisfied?'':' over')+'"><div class="r"><span class="k">'+esc(d.label)+
           ' <span class="vlim-type">'+esc(typeShort[d.type]||d.type)+'</span></span>'+
           '<span class="v">'+fmt(d.value)+' &middot; '+range+bind+' '+mark+'</span></div></div>';
      });
    }
    // Build the "feasible but not proven optimal" caveat in the user's language,
    // from the real stop reason, rather than trusting an English string.
    var caveat = '';
    if(out.status==='feasible'){
      var rk={time_limit:'feasibleTimeLimit',node_limit:'feasibleNodeLimit',
              iteration_limit:'feasibleIterationLimit',numerical_failure:'feasibleNumericalFailure'}[out.stopReason]||'feasibleGeneric';
      caveat=t('feasibleBody').replace('{reason}', t(rk));
    }
    // Defensive final verification: every constraint AND every variable domain
    // must be satisfied. A correct engine guarantees this, but the product's
    // promise is verifiability, so we check it explicitly rather than trust the
    // status alone. A verification FAILURE takes precedence over every other
    // message, so a numerical breach can never hide behind "feasible".
    var verificationPassed =
      (out.constraints||[]).every(function(c){ return c.satisfied; }) &&
      (out.variableDomains||[]).every(function(d){ return d.satisfied; });
    if(!verificationPassed) h+='<div class="check bad">&#10007; '+t('verifyFailed')+'</div>';
    else if(caveat) h+='<div class="check bad">'+esc(caveat)+'</div>';
    else h+='<div class="check">&#10003; '+t('solvedOk')+'</div>';
    if(/shadow/.test(h)) h+='<div class="shadow-note">'+t('shadowNote')+'</div>';
    h+='</div>';
    h+=solveDetailsHTML(out,model);
    // Exports are hidden when verification failed: we won't hand out a report
    // that claims to be a solution when we couldn't verify it.
    if(verificationPassed){
      h+='<div class="exports"><span class="ex">'+t('exportLabel')+'</span>'+
         '<button class="chip" id="exp-csv">CSV</button>'+
         '<button class="chip" id="exp-xls">Excel</button>'+
         '<button class="chip" id="exp-txt">'+t('exportCopySummary')+'</button></div>';
    }
    res.innerHTML=h; res.classList.add('show'); res.scrollIntoView({behavior:scrollBehavior(),block:'nearest'});

    // Only keep an exportable result when it passed verification.
    lastResult = verificationPassed ? out : null;
    if(verificationPassed){
      document.getElementById('exp-csv').addEventListener('click', exportCSV);
      document.getElementById('exp-xls').addEventListener('click', exportExcel);
      document.getElementById('exp-txt').addEventListener('click', copySummary);
    }

    // If this is a two-variable CONTINUOUS model WITHOUT custom bounds, draw
    // the feasible region. The corner-point method builds the region only from
    // out.constraints, which don't include per-variable bounds, so a bounded
    // continuous model would draw a region larger than what was solved. And
    // discrete models (integer/binary/mixed) have no continuous-vertex optimum
    // to show. In both cases we skip the plot rather than mislead.
    var hasCustomBounds = out.variableDomains && out.variableDomains.some(function(d){
      return d.min > 0 || d.max != null;
    });
    if (out.modelType === 'continuous' && !hasCustomBounds &&
        out.plot && out.values && out.values.length === 2) {
      drawFeasibleRegion(out);
    }

    // Tell the caller whether the defensive verification passed, so it can
    // announce the right outcome. The screen-reader announcement must never
    // contradict the visible "verification failed" message.
    return verificationPassed;
  }

  // Clip the feasible region to the visible rectangle [0,maxX] x [0,maxY] using
  // Sutherland–Hodgman half-plane clipping. Start with the box, clip by each
  // constraint half-plane (a<=b keeps a*p <= b; a>=b keeps a*p >= b; a=b clips
  // by BOTH, collapsing the region to that line) and by x>=0, y>=0. Returns the
  // clipped polygon, its area, and — when the region collapses to a 1-D sliver
  // (an equality ray) — the visible end-points of that segment. This draws the
  // exact visible part of ANY region (bounded, 2-D unbounded, or a ray) without
  // inventing a band from a single recession vector.
  // Dimension of a clipped polygon, decided geometrically (not from the user's
  // "=" symbol). scaleX/scaleY set a RELATIVE tolerance so the test is
  // unit-invariant. Returns 2 (area: polygon), 1 (all points collinear but >=2
  // distinct: segment/ray), or 0 (a single point: a dot).
  function polygonDimension_(points, scaleX, scaleY){
    if(!points || !points.length) return 0;
    var sx = scaleX || 1, sy = scaleY || 1;
    var tol = 1e-6;   // relative to the plot extent
    // dedupe with a relative tolerance
    var uniq = [];
    points.forEach(function(p){
      var dup = uniq.some(function(q){
        return Math.abs(p.x-q.x) <= tol*sx && Math.abs(p.y-q.y) <= tol*sy;
      });
      if(!dup) uniq.push(p);
    });
    if(uniq.length <= 1) return 0;
    if(uniq.length === 2) return 1;
    // 3+ distinct points: 2-D iff some triple is non-collinear. Normalise the
    // cross product by the plot scale so "collinear" is a relative test.
    var a = uniq[0];
    for(var i=1;i<uniq.length;i++) for(var j=i+1;j<uniq.length;j++){
      var ux = (uniq[i].x-a.x)/sx, uy = (uniq[i].y-a.y)/sy;
      var vx = (uniq[j].x-a.x)/sx, vy = (uniq[j].y-a.y)/sy;
      if(Math.abs(ux*vy - uy*vx) > tol) return 2;
    }
    return 1;   // all collinear
  }

  function clipFeasibleToBox_(cons, maxX, maxY){
    // half-plane: keep points with nx*x + ny*y <= c (within a scale-aware
    // tolerance — a fixed 1e-9 would admit points ~15% past a tiny limit like
    // x <= 1e-12, or reject real ones at large coordinates).
    function clip(poly, nx, ny, c){
      if(!poly.length) return poly;
      var out = [];
      var EPS = geometryEpsilon_(nx, ny, c, maxX, maxY);
      for(var i=0;i<poly.length;i++){
        var A = poly[i], B = poly[(i+1)%poly.length];
        var da = nx*A.x + ny*A.y - c, db = nx*B.x + ny*B.y - c;
        var aIn = da <= EPS, bIn = db <= EPS;
        if(aIn) out.push(A);
        if(aIn !== bIn){
          var t = da/(da-db);
          out.push({ x: A.x + t*(B.x-A.x), y: A.y + t*(B.y-A.y) });
        }
      }
      return out;
    }
    var poly = [ {x:0,y:0}, {x:maxX,y:0}, {x:maxX,y:maxY}, {x:0,y:maxY} ];
    poly = clip(poly, -1, 0, 0);   // x >= 0
    poly = clip(poly, 0, -1, 0);   // y >= 0
    cons.map(normalizeConstraint_).filter(function(c){ return !c.degenerate; }).forEach(function(c){
      // Normalised rows: EPS in clip() is now a real distance, so a tiny-coeff
      // limit like 1e-12*x <= 5e-12 clips at x = 5, not somewhere off-chart.
      if(c.op === '<='){ poly = clip(poly, c.x, c.y, c.b); }
      else if(c.op === '>='){ poly = clip(poly, -c.x, -c.y, -c.b); }
      else { poly = clip(poly, c.x, c.y, c.b); poly = clip(poly, -c.x, -c.y, -c.b); }
    });
    // shoelace area of the clipped polygon (math units — informational)
    var area = 0;
    for(var i=0;i<poly.length;i++){
      var A = poly[i], B = poly[(i+1)%poly.length];
      area += A.x*B.y - B.x*A.y;
    }
    area = Math.abs(area)/2;
    // Always expose the two farthest clipped points as a candidate segment, so
    // the caller can draw a polyline when it decides (in SCREEN units) that the
    // region is 1-D. Deciding here in math units is unsafe: a thin-but-real 2-D
    // region has a tiny math-unit area yet a visible screen area.
    var segment = null;
    if(poly.length >= 2){
      var best = null, bestD = -1;
      for(var a=0;a<poly.length;a++) for(var b=a+1;b<poly.length;b++){
        var dx = poly[a].x-poly[b].x, dy = poly[a].y-poly[b].y, d = dx*dx+dy*dy;
        if(d > bestD){ bestD = d; best = [poly[a], poly[b]]; }
      }
      // Reject only a TRULY coincident pair, using a per-axis NORMALISED length
      // so a small-but-real segment (e.g. (0,0)-(1e-7,1e-7)) is kept: in math
      // units its length^2 is 2e-14, which a fixed 1e-12 threshold would drop,
      // reintroducing the unit-dependence polygonDimension_ removed.
      if(best){
        var ndx = (best[0].x-best[1].x) / Math.max(maxX, Number.MIN_VALUE);
        var ndy = (best[0].y-best[1].y) / Math.max(maxY, Number.MIN_VALUE);
        if(ndx*ndx + ndy*ndy > 1e-12) segment = best;
      }
    }
    return { points: poly, area: area, segment: segment };
  }

  function drawFeasibleRegion(out){
    var cons = (out.constraints||[]).filter(function(c){ return c.coefficients && c.coefficients.length===2; })
      .map(function(c){ return { x:c.coefficients[0], y:c.coefficients[1], op:c.relation, b:c.limit - (c.constant||0), label:c.label, binding:c.binding }; });
    if (!cons.length) return;
    var obj = { x: out.plot.objective[0], y: out.plot.objective[1] };
    var maximize = true; // objective sense already baked into detection; corners test both
    var geo = solve2D(obj, cons);
    if (!geo.vertices.length) return;

    var xs = geo.vertices.map(function(p){return p.x;}), ys = geo.vertices.map(function(p){return p.y;});
    // Relative padding, not "* 1.15 + 1": adding an absolute unit shrinks a
    // small-unit region (e.g. x-max 1e-7) to a sub-pixel sliver hugging the
    // axis. Scale by the data extent so the region fills the plot at any unit.
    function plotMaximum_(v){ return v > 0 ? v * 1.15 : 1; }
    var maxX = plotMaximum_(Math.max.apply(null, xs.concat([out.values[0]])));
    var maxY = plotMaximum_(Math.max.apply(null, ys.concat([out.values[1]])));
    var W=440, H=340, pad=34;
    function sx(x){ return pad + x/maxX*(W-2*pad); }
    function sy(y){ return H-pad - y/maxY*(H-2*pad); }

    var lab = out.plot.variableLabels || ['x','y'];

    var svg = '<svg viewBox="0 0 '+W+' '+H+'" class="plot" role="img" aria-label="'+
      (geo.unbounded ? esc(t('regionUnboundedAria')) : esc(t('regionBoundedAria')))+'">';
    // axes
    svg += '<line x1="'+pad+'" y1="'+(H-pad)+'" x2="'+(W-pad)+'" y2="'+(H-pad)+'" class="ax"/>';
    svg += '<line x1="'+pad+'" y1="'+pad+'" x2="'+pad+'" y2="'+(H-pad)+'" class="ax"/>';

    // Draw the feasible region by CLIPPING it against the visible rectangle
    // [0,maxX] x [0,maxY]. This renders exactly the visible part of the region
    // — bounded or not — without inventing a band from a single recession
    // vector. It handles every geometry uniformly: a bounded polygon, a 2D
    // unbounded region with one vertex (two extreme rays), and a 1D segment/ray
    // from an equality constraint (drawn as a line, never a zero-area polygon).
    //
    // A region is 1-D iff an EQUALITY constraint pins it to a line — that is an
    // algebraic fact, independent of the model's units and of the on-screen
    // scale. (Deciding by area alone is unsafe: a thin-but-real 2-D region like
    // 0<=x<=1e-7 has tiny area yet is a rectangle, while a genuine segment has
    // an equality.) The `.open` class — dashed, "continues to infinity" —
    // depends ONLY on geo.unbounded, so a bounded segment reads as closed.
    // Decide the region's DIMENSION from the clipped geometry, not from whether
    // the user typed "=". Dedupe points (relative tolerance), then: >=3
    // non-collinear points => 2-D (polygon); all collinear with >=2 distinct
    // points => 1-D (segment/ray); one point => 0-D (a dot). This correctly
    // handles a redundant 0=0 equality (still 2-D), two opposite inequalities
    // that pin x=y with no "=" (1-D), and x<=0 forcing x=0 (1-D).
    var clip = clipFeasibleToBox_(cons, maxX, maxY);
    var dim = polygonDimension_(clip.points, maxX, maxY);
    var openClass = geo.unbounded ? ' open' : '';
    if (dim === 2) {
      var pts = clip.points.map(function(p){ return sx(p.x)+','+sy(p.y); }).join(' ');
      svg += '<polygon points="'+pts+'" class="region'+openClass+'"/>';
    } else if (dim === 1 && clip.segment) {
      // 1-D region: draw a thick polyline — dashed ONLY when unbounded, so a
      // bounded segment reads as closed rather than continuing off-chart.
      var a = clip.segment[0], b = clip.segment[1];
      svg += '<polyline points="'+sx(a.x)+','+sy(a.y)+' '+sx(b.x)+','+sy(b.y)+
             '" class="region-ray'+openClass+'"/>';
    } else if (clip.points.length || geo.vertices.length) {
      // 0-D: a single feasible point — mark it with a dot.
      var v = clip.points.length ? clip.points[0] : geo.vertices[0];
      svg += '<circle cx="'+sx(v.x)+'" cy="'+sy(v.y)+'" r="4" class="region"/>';
    }
    // constraint lines
    cons.forEach(function(c){
      var p = lineAcrossBox(c, maxX, maxY);
      if(p) svg += '<line x1="'+sx(p.x1)+'" y1="'+sy(p.y1)+'" x2="'+sx(p.x2)+'" y2="'+sy(p.y2)+'" class="cline'+(c.binding?' bind':'')+'"/>';
    });
    // optimum star
    var ox = sx(out.values[0]), oy = sy(out.values[1]);
    svg += '<circle cx="'+ox+'" cy="'+oy+'" r="6" class="opt"/>';
    svg += '<text x="'+(ox+10)+'" y="'+(oy-8)+'" class="optlab">('+fmt(out.values[0])+', '+fmt(out.values[1])+')</text>';
    // axis labels
    svg += '<text x="'+(W-pad)+'" y="'+(H-pad+18)+'" class="axlab" text-anchor="end">'+esc(lab[0]||'x')+'</text>';
    svg += '<text x="'+(pad-6)+'" y="'+(pad-8)+'" class="axlab">'+esc(lab[1]||'y')+'</text>';
    svg += '</svg>';

    var box = document.createElement('div');
    box.className = 'plotwrap';
    var cap = geo.unbounded
      ? (t('regionCap')+' <span class="region-unbounded-note">'+t('regionUnboundedNote')+'</span>')
      : t('regionCap');
    box.innerHTML = '<p class="plotcap">'+cap+'</p>' + svg;
    document.getElementById('result').appendChild(box);

    // Optional worked steps: the corner-point method, the way it's taught.
    // Collapsed by default so it never clutters the answer; the student who
    // wants to see the working opens it.
    addWorkedSteps(out, geo, obj);
  }

  function addWorkedSteps(out, geo, obj){
    if (!geo.vertices.length) return;
    var lab = out.plot.variableLabels || ['x','y'];
    // Identify the optimum by OBJECTIVE VALUE, not by coordinate proximity: with
    // a fixed 1e-6 per-axis test, every corner of a tiny model (x,y <= 1e-7)
    // sits within 1e-6 of the optimum and all get marked "best". Comparing z
    // against the best z (scale-aware) marks only genuine optima — and correctly
    // marks several when the objective is constant along an optimal edge.
    var bestZ = obj.x*out.values[0] + obj.y*out.values[1];
    var zMag = geo.vertices.reduce(function(m,v){ return Math.max(m, Math.abs(obj.x*v.x + obj.y*v.y)); }, Math.abs(bestZ));
    var zEps = 128 * Number.EPSILON * Math.max(1, zMag) * 64;   // a little slack for round-off
    var rows = geo.vertices.map(function(v){
      var z = obj.x*v.x + obj.y*v.y;
      var isOpt = Math.abs(z - bestZ) <= zEps;
      return '<tr'+(isOpt?' class="win"':'')+'><td>('+fmt(v.x)+', '+fmt(v.y)+')</td><td>'+
        fmt(obj.x)+'·'+fmt(v.x)+' + '+fmt(obj.y)+'·'+fmt(v.y)+'</td><td>'+fmt(z)+
        (isOpt?' &larr; '+t('best'):'')+'</td></tr>';
    }).join('');
    var det = document.createElement('details');
    det.className = 'steps';
    det.innerHTML =
      '<summary>'+t('showWorking')+'</summary>'+
      '<p>'+t('workingIntro')+'</p>'+
      '<table class="steptable"><thead><tr><th>'+t('corner')+' ('+esc(lab[0])+', '+esc(lab[1])+')</th>'+
      '<th>'+esc(out.objectiveLabel||t('result'))+'</th><th>'+t('value')+'</th></tr></thead>'+
      '<tbody>'+rows+'</tbody></table>'+
      '<p class="stepnote">'+t('workingNote')+'</p>';
    document.getElementById('result').appendChild(det);
  }

  // Clip a constraint line a*x + b*y = c to the visible box for drawing.
  function lineAcrossBox(cRaw, maxX, maxY){
    var c = normalizeConstraint_(cRaw);
    if (c.degenerate) return null;   // 0*x+0*y is not a line
    // c is unit-norm, so ANGULAR_EPS is the right "is this coefficient zero"
    // test for choosing which box edges the line crosses.
    var pts = [];
    if (Math.abs(c.y) > ANGULAR_EPS) { // y at x=0 and x=maxX
      pts.push({ x:0, y:(c.b - c.x*0)/c.y });
      pts.push({ x:maxX, y:(c.b - c.x*maxX)/c.y });
    }
    if (Math.abs(c.x) > ANGULAR_EPS) { // x at y=0 and y=maxY
      pts.push({ x:(c.b - c.y*0)/c.x, y:0 });
      pts.push({ x:(c.b - c.y*maxY)/c.x, y:maxY });
    }
    var edgeX = 128 * Number.EPSILON * Math.max(1e-300, maxX);
    var edgeY = 128 * Number.EPSILON * Math.max(1e-300, maxY);
    var inb = pts.filter(function(p){ return p.x>=-edgeX && p.x<=maxX+edgeX && p.y>=-edgeY && p.y<=maxY+edgeY; });
    if (inb.length < 2) return null;
    // A line can hit two box edges at the SAME corner (e.g. y=2x through (0,0)),
    // producing duplicate points. Dedupe with PER-AXIS tolerances (a shared one
    // lets a huge maxY swallow a tiny maxX gap, dropping a real horizontal line),
    // then take the two FARTHEST apart so the drawn segment is never zero-length.
    var uniq = [];
    inb.forEach(function(p){
      var dup = uniq.some(function(q){
        return Math.abs(p.x-q.x) <= edgeX && Math.abs(p.y-q.y) <= edgeY;
      });
      if(!dup) uniq.push(p);
    });
    if (uniq.length < 2) return null;
    var a = uniq[0], b = uniq[1], bestD = -1;
    for(var i=0;i<uniq.length;i++) for(var j=i+1;j<uniq.length;j++){
      var dx = uniq[i].x-uniq[j].x, dy = uniq[i].y-uniq[j].y, d = dx*dx+dy*dy;
      if(d > bestD){ bestD = d; a = uniq[i]; b = uniq[j]; }
    }
    return { x1:a.x, y1:a.y, x2:b.x, y2:b.y };
  }

  // Two scale-aware tolerances replace the old fixed absolutes.
  //  - ANGULAR_EPS: for NORMALISED coefficient rows (unit norm). Used where the
  //    quantity is a direction cosine or a unit-row determinant — parallelism
  //    and recession. A near-machine tolerance is correct there because the
  //    inputs are already O(1); 1e-9 was far too coarse and let an extremely
  //    skewed but bounded region (x + 5e-10*y <= 1) read as unbounded.
  //  - geometryEpsilon_: for COORDINATE-space residuals, which can be huge
  //    (y up to 2e9) or tiny (x up to 1e-12). The tolerance scales with the
  //    magnitudes involved so clipping/feasibility never admit a point ~15% past
  //    a tiny limit, nor reject a real vertex at large coordinates.
  //
  // SUPPORTED RANGE: the Math.max(1, ...) floor means the tolerance stops being
  // strictly proportional below ~1e-14 (its minimum is 128*EPSILON ~= 2.84e-14).
  // The visualisation is designed for practical magnitudes — coordinates from
  // ~1e-12 to ~2e9, verified by the suite. Models whose coordinates or objective
  // values fall below ~1e-14 are outside this range and not a target: such
  // values never arise in a real optimisation sheet, and the solver's numeric
  // result is unaffected regardless — only the drawn region could be imprecise.
  var ANGULAR_EPS = 128 * Number.EPSILON;
  function geometryEpsilon_(nx, ny, c, maxX, maxY){
    var scale = Math.max(1, Math.abs(c), Math.abs(nx)*maxX + Math.abs(ny)*maxY);
    return 128 * Number.EPSILON * scale;
  }

  // 2-variable vertex geometry (verified separately).
  // Normalise a constraint row so its coefficient vector is unit length (and b
  // scaled to match). After this, a*p and b are on the same scale for every
  // row, so the absolute tolerances used across the geometry pipeline
  // (intersect/feasible/clip/lineAcrossBox/recedes) are meaningful regardless
  // of the model's units: 1e-12*x <= 5e-12 becomes x <= 5 and behaves like it.
  // A genuinely zero row (0*x+0*y) is flagged degenerate so callers can ignore
  // it instead of treating it as a real (and possibly dimension-reducing) line.
  function normalizeConstraint_(c){
    var norm = Math.hypot(c.x, c.y);
    if (norm === 0) return { x:0, y:0, op:c.op, b:c.b, binding:c.binding, label:c.label, degenerate:true };
    return { x:c.x/norm, y:c.y/norm, op:c.op, b:c.b/norm, binding:c.binding, label:c.label, degenerate:false };
  }

  function solve2D(objRaw, consRaw){
    // Work entirely in normalised coordinates; drop degenerate 0*x+0*y rows,
    // which constrain nothing and must not reduce the region's dimension.
    var cons = consRaw.map(normalizeConstraint_).filter(function(c){ return !c.degenerate; });
    var obj = objRaw;
    var lines = cons.slice();
    lines.push({ x:1, y:0, op:'>=', b:0 });
    lines.push({ x:0, y:1, op:'>=', b:0 });
    function intersect(L1,L2){
      // L1,L2 are unit-norm rows, so |det| is |sin(angle between them)|:
      // ANGULAR_EPS (near machine precision) is the correct parallelism test,
      // not 1e-9 which discards genuine near-axis intersections at large coords.
      var det=L1.x*L2.y-L2.x*L1.y; if(Math.abs(det)<ANGULAR_EPS) return null;
      return { x:(L1.b*L2.y-L2.b*L1.y)/det, y:(L1.x*L2.b-L2.x*L1.b)/det };
    }
    function feasible(p){
      return cons.every(function(c){
        var v=c.x*p.x+c.y*p.y;   // c is unit-norm
        // Coordinate-scaled tolerance: the residual v-c.b lives in coordinate
        // space, which may be up to ~2e9, so a fixed 1e-6 is meaningless there.
        var eps = geometryEpsilon_(c.x, c.y, c.b, Math.abs(p.x), Math.abs(p.y));
        if(c.op==='<=') return v<=c.b+eps;
        if(c.op==='>=') return v>=c.b-eps;
        return Math.abs(v-c.b)<eps;
      }) &&
      // Non-negativity with the SAME scaled tolerance, not a fixed 1e-6, so a
      // near-axis intersection like (-5e-7, 1) is correctly rejected instead of
      // entering the corner list and the Show-working table as an impossible x<0.
      p.x >= -geometryEpsilon_(1, 0, 0, Math.abs(p.x), 0) &&
      p.y >= -geometryEpsilon_(0, 1, 0, 0, Math.abs(p.y));
    }
    // Per-axis dedup tolerances: a single combined epsilon lets a huge y inflate
    // the x tolerance, merging the two top corners of a 0<=x<=1e-7, 0<=y<=2e9
    // rectangle. Scale x and y independently from the two points being compared.
    var verts=[];
    for(var i=0;i<lines.length;i++)for(var j=i+1;j<lines.length;j++){
      var p=intersect(lines[i],lines[j]);
      if(p && feasible(p) && !verts.some(function(q){
          var ex = 128*Number.EPSILON*Math.max(1e-300, Math.abs(q.x), Math.abs(p.x));
          var ey = 128*Number.EPSILON*Math.max(1e-300, Math.abs(q.y), Math.abs(p.y));
          return Math.abs(q.x-p.x)<ex && Math.abs(q.y-p.y)<ey;
        }))
        verts.push(p);
    }
    if(verts.length){
      var cx=verts.reduce(function(s,p){return s+p.x;},0)/verts.length;
      var cy=verts.reduce(function(s,p){return s+p.y;},0)/verts.length;
      verts.sort(function(a,b){return Math.atan2(a.y-cy,a.x-cx)-Math.atan2(b.y-cy,b.x-cx);});
    }

    // Is the feasible region unbounded? A ray can leave a vertex and travel to
    // infinity without leaving the region iff a non-zero recession direction
    // d = (dx,dy) exists with dx,dy >= 0 and, for every constraint, a*d <= 0 for
    // <=, a*d >= 0 for >=, a*d == 0 for =. In 2D the recession cone's extreme
    // rays are among a small EXACT candidate set — the axes and each
    // constraint line's two in-plane directions (b,-a)/(-b,a) — so we test those
    // directly instead of sampling angles (a fixed angular mesh misses exact
    // rays like the 45-degree x=y ray, whose direction lands between samples).
    function recedes(d){
      var mag = Math.abs(d.x) + Math.abs(d.y);
      if (mag < 1e-12) return false;            // must be a non-zero direction
      // Must stay in the first quadrant: x,y >= 0 are real constraints, so a
      // direction with ANY negative component leaves the region. d is unit-norm,
      // so ANGULAR_EPS is the right threshold — 1e-9 was loose enough to accept
      // a direction like (-5e-10, 1) (float noise from a near-vertical boundary)
      // as if it were straight up, spuriously flagging a bounded region.
      if (d.x < -ANGULAR_EPS || d.y < -ANGULAR_EPS) return false;
      return cons.every(function(c){
        // cons rows are already unit-norm, so proj is a true signed distance-
        // rate. Use a near-machine tolerance: 1e-9 was coarse enough to let a
        // near-axis but bounded constraint (x + 5e-10*y <= 1) look recessive.
        var proj = c.x*d.x + c.y*d.y;
        if(c.op==='<=') return proj <= ANGULAR_EPS;
        if(c.op==='>=') return proj >= -ANGULAR_EPS;
        return Math.abs(proj) < ANGULAR_EPS;    // equality: only along the line
      });
    }
    var unbounded = false, recession = null;
    if(verts.length){
      var candidates = [ {x:1,y:0}, {x:0,y:1} ];
      cons.forEach(function(c){
        // Directions along this constraint's boundary line a*d = 0.
        candidates.push({ x: c.y, y: -c.x });
        candidates.push({ x: -c.y, y: c.x });
      });
      for(var i=0;i<candidates.length;i++){
        var d = candidates[i];
        var norm = Math.hypot(d.x, d.y);
        if(norm === 0) continue;                // only a truly zero vector is skipped
        var unit = { x:d.x/norm, y:d.y/norm };
        if(recedes(unit)){ unbounded=true; recession=unit; break; }
      }
    }
    return { vertices:verts, unbounded:unbounded, recession:recession };
  }

  // --- Export. All client-side: the solution never leaves the browser. ---
  var lastResult = null;

  function solutionRows(out){
    // a clean, labelled table anyone can open: the answer, then the limits
    var rows = [[t('exResult'), out.objectiveLabel || t('exObjective'), num(out.objective)]];
    rows.push([]);
    // Solve metadata, so an exported report is auditable on its own: status,
    // model type, whether optimality was proven, why it stopped, work done, and
    // the final verification result.
    var typeNames={continuous:t('sdContinuous'),integer:t('sdInteger'),binary:t('sdBinary'),mixed:t('sdMixed')};
    var verifOk=(out.constraints||[]).every(function(c){return c.satisfied;}) &&
                (out.variableDomains||[]).every(function(d){return d.satisfied;});
    rows.push([t('sdStatus'), out.status||'']);
    rows.push([t('sdModelType'), typeNames[out.modelType]||out.modelType||'']);
    if(out.status==='optimal'||out.status==='feasible') rows.push([t('sdProven'), out.optimalityProven?t('sdYes'):t('sdNo')]);
    if(out.stopReason) rows.push([t('sdStopped'), out.stopReason]);
    if(typeof out.nodesExplored==='number'&&out.nodesExplored!=null) rows.push([t('sdNodes'), num(out.nodesExplored)]);
    if(typeof out.elapsedMs==='number') rows.push([t('sdTime'), out.elapsedMs+' ms']);
    rows.push([t('exVerification'), verifOk?t('exVerifyPass'):t('exVerifyFail')]);
    rows.push([]);
    rows.push([t('exDecision'), t('exFrom'), t('exTo')]);
    (out.labels||[]).forEach(function(lb,i){ rows.push([lb, num(out.previous[i]), num(out.values[i])]); });
    rows.push([]);
    rows.push([t('exLimit'), t('exUsed'), t('exCap'), t('exAtLimit'), t('exRhsChange'), t('exObjChange'), t('exOneMore')]);
    (out.constraints||[]).forEach(function(c){
      var hasImpact=(c.binding && typeof c.objectiveDelta==='number' && c.objectiveDelta!==0);
      rows.push([c.label, num(c.used), num(c.limit), c.binding?t('exYes'):t('exNo'),
                 hasImpact?num(c.rhsChange):'', hasImpact?num(c.objectiveDelta):'',
                 hasImpact?num(Math.abs(c.objectiveDelta)):'']);
    });
    // Variable limits: type and bounds per configured variable, so an exported
    // report documents that a variable was e.g. binary or capped at 10.
    if(out.variableDomains && out.variableDomains.length){
      rows.push([]);
      rows.push([t('exVariable'), t('varType'), t('varMin'), t('varMax'), t('exResult')]);
      out.variableDomains.forEach(function(d){
        var tn={continuous:t('typeContinuous'),integer:t('typeInteger'),binary:t('typeBinary')}[d.type]||d.type;
        rows.push([d.label, tn, num(d.min), (d.max==null?'':num(d.max)), num(d.value)]);
      });
    }
    return rows;
  }
  function num(n){ return (n==null||isNaN(n)) ? '' : Math.round(n*10000)/10000; }

  // Neutralise spreadsheet formula injection: a user label starting with = + - @
  // (or a leading tab/CR) can execute as a formula when the file opens in Excel
  // or Sheets. Prefix a single quote so it's treated as text. Only applied to
  // string cells (numbers are emitted as-is).
  function safeCsvText_(value){
    var s = String(value);
    return /^[=+@\t\r-]/.test(s) ? "'" + s : s;
  }

  function download(name, mime, text){
    var blob = new Blob([text], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  function exportCSV(){
    if(!lastResult) return;
    var csv = solutionRows(lastResult).map(function(r){
      return r.map(function(cell){
        var s = safeCsvText_(cell);
        return /[",\\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s;
      }).join(',');
    }).join('\\r\\n');
    download('plumline-solution.csv', 'text/csv', csv);
  }

  function exportExcel(){
    if(!lastResult) return;
    // SpreadsheetML: opens natively in Excel and Google Sheets, no library.
    var rows = solutionRows(lastResult).map(function(r){
      return '<Row>'+r.map(function(cell){
        var isNum = cell!=='' && !isNaN(Number(cell)) && typeof cell!=='boolean';
        var t = isNum ? 'Number' : 'String';
        var raw = isNum ? String(cell) : safeCsvText_(cell);
        var v = raw.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        return '<Cell><Data ss:Type="'+t+'">'+v+'</Data></Cell>';
      }).join('')+'</Row>';
    }).join('');
    var xml = '<?xml version="1.0"?>'+
      '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" '+
      'xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">'+
      '<Worksheet ss:Name="'+t('excelSheetName')+'"><Table>'+rows+'</Table></Worksheet></Workbook>';
    download('plumline-solution.xls', 'application/vnd.ms-excel', xml);
  }

  function copySummary(){
    if(!lastResult) return;
    var out = lastResult, lines = [];
    lines.push((out.objectiveLabel||t('exResult')) + ': ' + fmt(out.objective));
    (out.labels||[]).forEach(function(lb,i){ lines.push('  ' + lb + ': ' + fmt(out.values[i])); });
    (out.constraints||[]).forEach(function(c){
      var s = '  ' + c.label + ' ' + fmt(c.used) + '/' + fmt(c.limit) + (c.binding?(' ('+t('summaryAtLimit')):' (');
      if(c.binding && typeof c.objectiveDelta==='number' && c.objectiveDelta!==0) s += ', '+t('summaryImpact')+' ' + fmt(Math.abs(c.objectiveDelta));
      lines.push(s + ')');
    });
    if(out.variableDomains && out.variableDomains.length){
      lines.push(t('varLimitsTitle')+':');
      out.variableDomains.forEach(function(d){
        var typeName={continuous:t('typeContinuous'),integer:t('typeInteger'),binary:t('typeBinary')}[d.type]||d.type;
        var rng=(d.type==='binary')?'0-1':(fmt(d.min)+'-'+(d.max==null?t('summaryNoLimit'):fmt(d.max)));
        lines.push('  ' + d.label + ' (' + typeName + ', ' + rng + '): ' + fmt(d.value));
      });
    }
    var text = lines.join('\\n');
    if(navigator.clipboard){
      navigator.clipboard.writeText(text).then(function(){ flash('exp-txt',t('copied')); });
    } else {
      download('plumline-solution.txt','text/plain',text);
    }
  }
  function flash(id,label){
    var b=document.getElementById(id), old=b.textContent;
    b.textContent=label; setTimeout(function(){ b.textContent=old; }, 1200);
  }