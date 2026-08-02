  var openEx=document.getElementById('openExamples'); if(openEx) openEx.addEventListener('click',openDrawer);
  var closeEx=document.getElementById('closeExamples'); if(closeEx) closeEx.addEventListener('click',closeDrawer);
  var backdrop=document.getElementById('exDrawerBackdrop'); if(backdrop) backdrop.addEventListener('click',closeDrawer);
  document.addEventListener('keydown',function(e){
    var drawer=document.getElementById('exDrawer');
    if(!drawer || drawer.hidden) return;
    if(e.key==='Escape'){ closeDrawer(); return; }
    if(e.key==='Tab'){
      // Keep Tab focus inside the open drawer.
      var f=drawer.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if(!f.length) return;
      var first=f[0], last=f[f.length-1];
      if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
      else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
    }
  });
  document.getElementById('solve').addEventListener('click',solve);
  document.getElementById('clear').addEventListener('click',function(){loadExample('blank');});
  document.getElementById('addRow').addEventListener('click',addRow);
  document.getElementById('delRow').addEventListener('click',delRow);
  document.getElementById('addCol').addEventListener('click',addCol);
  document.getElementById('delCol').addEventListener('click',delCol);
  document.getElementById('undoGrid').addEventListener('click',doUndo);
  document.getElementById('detectVars').addEventListener('click',detectForPanel);
  // Toggling integer mode changes the model but not the detected variables,
  // so pass fromPanel=true: invalidate the result, don't mark the panel stale.
  document.getElementById('whole').addEventListener('change',function(){ modelChanged(true); });
  // Changing the objective direction changes the model; invalidate the result.
  var senseEl=document.getElementById('senseSel');
  if(senseEl) senseEl.addEventListener('change',function(){
    // An explicit max/min is a confirmation for the current objective.
    if(senseEl.value==='max'||senseEl.value==='min'){ confirmedObjectiveSig=objectiveSignature(); }
    else { confirmedObjectiveSig=null; }
    updateSenseHint();
    modelChanged(true);
  });
  // Changing the number format re-interprets every formula and value, so it can
  // change the detected structure. Invalidate the result AND mark the panel for
  // re-detection (fromPanel=false), and cancel any in-flight worker so a result
  // computed under the previous locale can't be presented.
  var localeEl=document.getElementById('localeSel');
  if(localeEl) localeEl.addEventListener('change',function(){ modelChanged(false); });
  // Import CSV: the button opens the hidden file picker; picking a file imports.
  document.getElementById('importCsv').addEventListener('click',function(){
    document.getElementById('csvFile').click();
  });
  document.getElementById('csvFile').addEventListener('change',function(e){
    var f=e.target.files&&e.target.files[0];
    importCSVFile(f);
    e.target.value='';   // reset so the same file can be re-imported
  });
  // Ctrl/Cmd+Z right after a paste or delete undoes it.
  document.addEventListener('keydown',function(e){
    if((e.ctrlKey||e.metaKey)&&(e.key==='z'||e.key==='Z')&&lastUndo){
      e.preventDefault(); doUndo();
    }
  });


  // --- Self-check: proves the engine works end to end, in plain language ---
  function runSelfTest(){
    var out=document.getElementById('selftest-out'); out.innerHTML='';
    function line(ok,label,detail){
      var d=document.createElement('div');
      d.innerHTML=(ok?'<span style="color:var(--true)">PASS</span>':'<span style="color:var(--wrong)">FAIL</span>')+
        ' &nbsp;'+label+(detail?' <span style="color:var(--faint)">'+detail+'</span>':'');
      out.appendChild(d);
    }
    function sheetFrom(grid){
      var F=[],V=[];
      for(var r=0;r<grid.length;r++){var fr=[],vr=[];for(var c=0;c<grid[r].length;c++){
        var cell=classifyGridCell_(grid[r][c]);   // single source of truth
        fr.push(cell.formula);vr.push(cell.value);
      }F.push(fr);V.push(vr);}
      return {getDataRange:function(){return{getRow:function(){return 1;},getColumn:function(){return 1;},getFormulas:function(){return F;},getValues:function(){return V;}};}};
    }
    // Solve an example exactly as loadExample would: apply its sense, whole
    // flag, and per-variable domains, then solve.
    function solveExample(ex, senseOverride){
      try{
        var sh=sheetFrom(ex.grid);
        var lm=currentLocaleMode();
        var m=detectModel_(sh, lm);
        m.objective.sense=senseOverride||ex.sense;
        m.wholeNumbers=!!ex.whole;
        if(ex.domains){
          var cells=expandRange_(loadGrid_(sh, lm), m.variables);
          var integer=[],bounds=[];
          cells.forEach(function(cell,i){
            var d=ex.domains[cell]; if(!d) return;
            if(d.type==='binary'){ integer.push(i); bounds[i]={lower:0,upper:1}; }
            else if(d.type==='integer'){ integer.push(i); bounds[i]={lower:d.min==null?0:d.min,upper:d.max==null?null:d.max}; }
            else { bounds[i]={lower:d.min==null?0:d.min,upper:d.max==null?null:d.max}; }
          });
          m.domains={integer:(ex.whole?true:(integer.length?integer:null)),bounds:bounds.length?bounds:null};
        }
        return solveModel_(sh,m, lm);
      }catch(e){ return {status:'error',error:String(e.message||e)}; }
    }
    // Every example must solve to its expected status, model type, objective
    // (within tolerance), prove optimality, and pass verification.
    Object.keys(EXAMPLES).forEach(function(key){
      var ex=EXAMPLES[key], exp=ex.expected||{}, out=solveExample(ex, senseOf(key));
      var tol=exp.tolerance||1e-6;
      var verified=(out.constraints||[]).every(function(c){return c.satisfied;})&&
                   (out.variableDomains||[]).every(function(d){return d.satisfied;});
      var okStatus=out.status===exp.status;
      var okType=!exp.modelType||out.modelType===exp.modelType;
      var okObj=exp.objective==null||(typeof out.objective==='number'&&Math.abs(out.objective-exp.objective)<=tol);
      var okProven=out.status!=='optimal'||out.optimalityProven===true;
      var all=okStatus&&okType&&okObj&&okProven&&verified;
      line(all, t('exName_'+key),
        (exp.objective!=null?('obj '+fmt(out.objective)+(okObj?'':' (exp '+exp.objective+')')):out.status)+
        (verified?'':' [verify FAILED]')+(okProven?'':' [not proven]'));
    });
    // Shadow price is computed on a binding continuous limit.
    var p=solveExample(EXAMPLES.production, senseOf('production'));
    var hasShadow=(p.constraints||[]).some(function(c){return c.binding&&typeof c.objectiveDelta==='number'&&c.objectiveDelta!==0;});
    line(hasShadow,'Estimated one-unit impact (shadow price) is computed', hasShadow?'a binding limit shows its value':'none found');
    // Contradictory limits are caught, not faked.
    var imp=solveExample({grid:[['Item','Make','Profit','Total','',''],['X','0','10','=B2*C2','',''],['Y','0','8','=B3*C3','',''],['','','','','',''],['Total profit','','','=SUM(D2:D3)','',''],['Min make','','','=B2','>=','100'],['Max make','','','=B2','<=','20']],sense:'max'});
    line(imp.status==='infeasible','Contradictory limits are caught cleanly','reported: '+(imp.status||imp.error||'?'));
    var allPass=out.querySelectorAll('span[style*="wrong"]').length===0;
    var summary=document.createElement('div');
    summary.style.marginTop='10px';summary.style.fontWeight='600';
    summary.style.color=allPass?'var(--true)':'var(--wrong)';
    summary.textContent=allPass?'All checks passed. The solver works.':'Something failed above.';
    out.appendChild(summary);
  }
  document.getElementById('selftest').addEventListener('click',runSelfTest);
  // The self-check is a development diagnostic, not a user task. Show it only
  // when the URL carries ?debug=1, so it stays out of the normal flow.
  if(/[?&]debug=1/.test(location.search)){
    var scr=document.getElementById('selfcheck-row'); if(scr) scr.style.display='';
  }

  // Language: the shared engine wires the <select>, applies text, returns the lang.
  LANG = Plumline.i18n.init('solver');
  var sel=document.getElementById('lang');
  if(sel) sel.addEventListener('change',function(){
    applyLang(sel.value);                     // sets LANG and relabels grid cells
    setDetectLabel(panelStale);              // button label follows the language
    if(detectedVars.length) renderVarPanel(); // re-render dynamic panel in new language
    updateSenseHint();                        // hint text follows the language
    // If the examples drawer is open, re-render its cards and Close label.
    var exd=document.getElementById('exDrawer');
    if(exd && !exd.hidden){
      if(typeof renderExamplesDrawer==='function') renderExamplesDrawer();
      var cb=document.getElementById('closeExamples'); if(cb) cb.setAttribute('aria-label', t('closeLabel'));
    }
  });

  var _ex=(function(){ try{ return new URLSearchParams(location.search).get('ex'); }catch(e){ return null; } })();
  loadExample(EXAMPLE_BY_SLUG[_ex] || 'production');

  // Test-only hook: expose the presentation functions so the a11y test battery
  // can drive presentResult() directly with crafted engine output. Guarded by a
  // flag that production never sets, so it is inert on the live site.
  if (typeof window !== 'undefined' && window.__PLUMLINE_TEST__) {
    window.__plumline = { presentResult: presentResult, renderReceipt: renderReceipt,
      announce: announce, fmt: fmt, setLang: function(l){ LANG=l; },
      openDrawer: openDrawer, closeDrawer: closeDrawer,
      localizeEngineError: localizeEngineError, showTrouble: showTrouble,
      showEngineTrouble: showEngineTrouble, solve2D: solve2D,
      drawFeasibleRegion: drawFeasibleRegion, clipFeasibleToBox_: clipFeasibleToBox_,
      polygonDimension_: polygonDimension_, normalizeConstraint_: normalizeConstraint_,
      lineAcrossBox: lineAcrossBox, geometryEpsilon_: geometryEpsilon_,
      addWorkedSteps: addWorkedSteps,
      isFormulaInput_: isFormulaInput_,
      classifyGridRow_: function(row){
        // Run the REAL app converter on a single row: returns {formulas,values}
        // exactly as sheetFromGrid would, so tests exercise the app's own
        // classification (not a reimplementation).
        var save=data, sr=ROWS, sc=COLS;
        data=[row.slice()]; ROWS=1; COLS=row.length;
        var sheet=sheetFromGrid();
        var out={ formulas: sheet.getDataRange().getFormulas()[0],
                  values: sheet.getDataRange().getValues()[0] };
        data=save; ROWS=sr; COLS=sc;
        return out;
      } };
  }