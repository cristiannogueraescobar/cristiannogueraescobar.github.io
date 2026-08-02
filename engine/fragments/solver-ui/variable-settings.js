  // Objective direction must be confirmed once per model before solving, so we
  // never silently solve in the wrong direction. We remember a signature of the
  // objective (its cell, label, and formula) that was confirmed; if the
  // objective itself changes, confirmation lapses. Editing coefficients or
  // constraints does NOT lapse it.
  var confirmedObjectiveSig=null;

  // A light signature of the current objective: cell + label + formula (+ detected).
  // Returns null if the model can't be read yet.
  function objectiveSignature(){
    try{
      var sheet=sheetFromGrid();
      var lm=currentLocaleMode();
      var model=detectModel_(sheet, lm);
      var grid=loadGrid_(sheet, lm);
      return {
        cell: model.objective.cell,
        label: labelFor_(grid, model.objective.cell)||'',
        // The formula itself is part of the objective's identity: editing it in
        // the same cell (same label) must lapse confirmation, while changing a
        // referenced coefficient value must not.
        formula: (cellAt_(grid, model.objective.cell)||{}).formula||'',
        detected: (model.objective.sense==='min'?'min':'max')
      };
    }catch(e){ return null; }
  }
  function sameObjective(a,b){
    return a&&b&&a.cell===b.cell&&a.label===b.label&&a.formula===b.formula;
  }
  // The direction is confirmed when the selector holds an explicit max/min AND
  // that choice was made for the current objective.
  function senseConfirmed(){
    var sel=document.getElementById('senseSel');
    if(!sel||sel.value==='auto') return false;
    return sameObjective(confirmedObjectiveSig, objectiveSignature());
  }

  // Show the detected direction as a proposal, and whether confirmation is
  // still pending. The heuristic proposes; the user confirms.
  function updateSenseHint(){
    var hint=document.getElementById('senseHint');
    if(!hint) return;
    var sig=objectiveSignature();
    if(!sig){ hint.textContent=''; return; }
    var detectedName=(sig.detected==='min')?t('senseMin'):t('senseMax');
    if(senseConfirmed()){
      hint.className='sense-hint';
      hint.textContent='';
    } else {
      hint.className='sense-hint pending';
      var proposal=t('senseDetected').replace('{dir}', detectedName).replace('{label}', sig.label||sig.cell);
      hint.textContent=proposal+' '+t('senseConfirmShort');
    }
  }

  // A full model replacement (load example, clear, import CSV) makes old
  // per-variable settings meaningless, since they're keyed by cell. Wipe them
  // so a new model never silently inherits an old variable's type.
  function resetVarPanel(){
    varSettings={}; detectedVars=[]; panelStale=false;
    var sel=document.getElementById('senseSel'); if(sel) sel.value='auto';   // new model: re-detect direction
    confirmedObjectiveSig=null;   // require re-confirmation for the new objective
    var panel=document.getElementById('varSettings');
    if(panel){ panel.style.display='none'; panel.open=false; }
    var body=document.getElementById('varSettingsBody'); if(body) body.innerHTML='';
    setDetectLabel(false);
  }
  // Switch the button between "Variable settings" and "Refresh variables".
  function setDetectLabel(stale){
    var b=document.getElementById('detectVars');
    if(b) b.textContent = stale ? t('refreshVars') : t('detectVars');
  }

  // Detect the model on the main thread (fast: no solving) to populate the
  // panel with one row per decision variable.
  function detectForPanel(opts){
    var openPanel=!opts || opts.open!==false;   // default: open (manual button use)
    var sheet=sheetFromGrid();
    var lm=currentLocaleMode();
    var model;
    try{ model=detectModel_(sheet, lm); }
    catch(err){ showEngineTrouble('tRead', err); return; }
    var grid=loadGrid_(sheet, lm);
    var cells=expandRange_(grid, model.variables);
    detectedVars=cells.map(function(cell){ return { cell:cell, label:labelFor_(grid, cell)||cell }; });
    // Drop settings for cells that are no longer decision variables, so an old
    // invalid bound on a now-removed variable can't block solving invisibly.
    var active={};
    detectedVars.forEach(function(v){ active[v.cell]=true; });
    Object.keys(varSettings).forEach(function(cell){ if(!active[cell]) delete varSettings[cell]; });
    panelStale=false;
    setDetectLabel(false);
    renderVarPanel();
    var panel=document.getElementById('varSettings');
    if(panel){ panel.style.display=''; if(openPanel) panel.open=true; }
  }

  function settingsFor(cell){
    if(!varSettings[cell]) varSettings[cell]={ type:'continuous', min:0, max:null };
    return varSettings[cell];
  }

  // Parse a bound field. Returns null for empty, a finite number for valid
  // input, or NaN for a non-finite value (NaN, Infinity) so it can be flagged
  // as an error rather than silently treated as "no limit".
  function cleanBound(raw){
    if(raw==='' || raw==null) return null;
    var n=Number(raw);
    if(!isFinite(n)) return NaN;   // invalid: distinct from null (empty)
    return n;
  }

  // Validate one variable's bounds and show/clear an inline message. Returns
  // an error key or null. Variables are non-negative (the simplex assumes it),
  // so a negative minimum is rejected rather than silently ignored.
  function varError(s){
    if(s.type==='binary') return null;
    // A NaN marker means the field held a non-finite value.
    if(typeof s.min==='number' && isNaN(s.min)) return 'varErrFinite';
    if(typeof s.max==='number' && isNaN(s.max)) return 'varErrFinite';
    var lo=(typeof s.min==='number')?s.min:0;
    var hi=(typeof s.max==='number')?s.max:null;
    if(lo<0) return 'varErrNegative';
    if(hi!=null && lo>hi) return 'varErrMinMax';
    return null;
  }
  function showVarError(cell){
    var row=document.querySelector('.vs-row[data-cell="'+cell+'"]');
    if(!row) return;
    var s=settingsFor(cell);
    var err=varError(s);
    var msgEl=row.parentNode.querySelector('.vs-err[data-for="'+cell+'"]');
    if(err){
      if(!msgEl){
        msgEl=document.createElement('div');
        msgEl.className='vs-err'; msgEl.setAttribute('data-for',cell);
        row.parentNode.insertBefore(msgEl, row.nextSibling);
      }
      var label=(varSettings[cell]&&detectedVars.filter(function(v){return v.cell===cell;})[0]);
      msgEl.textContent=t(err).replace('{name}', label?label.label:cell);
    } else if(msgEl){ msgEl.parentNode.removeChild(msgEl); }
  }
  // Are any variable bounds invalid? Blocks solving with a clear message.
  function anyVarError(){
    for(var c in varSettings){ if(varSettings.hasOwnProperty(c) && varError(varSettings[c])) return true; }
    return false;
  }
  // Has the user set any non-default type or bound? (Used to decide whether a
  // stale panel is risky enough to block solving.)
  function hasCustomSettings(){
    for(var c in varSettings){
      if(!varSettings.hasOwnProperty(c)) continue;
      var s=varSettings[c];
      if(s.type!=='continuous') return true;
      if(typeof s.min==='number' && s.min!==0) return true;
      if(typeof s.max==='number') return true;
    }
    return false;
  }

  function renderVarPanel(){
    var body=document.getElementById('varSettingsBody');
    if(!body) return;
    var typeOpts=[['continuous',t('typeContinuous')],['integer',t('typeInteger')],['binary',t('typeBinary')]];
    var rows=detectedVars.map(function(v,i){
      var s=settingsFor(v.cell);
      var opts=typeOpts.map(function(o){return '<option value="'+o[0]+'"'+(s.type===o[0]?' selected':'')+'>'+esc(o[1])+'</option>';}).join('');
      var binLocked=(s.type==='binary');
      var minVal=(s.min==null?'':s.min), maxVal=(s.max==null?'':s.max);
      return '<div class="vs-row" data-cell="'+esc(v.cell)+'">'+
        '<span class="vs-name">'+esc(v.label)+'</span>'+
        '<select class="vs-type" aria-label="'+esc(t('varType'))+' '+esc(v.label)+'">'+opts+'</select>'+
        '<label class="vs-field"><span class="vs-mlabel">'+esc(t('varMin'))+'</span>'+
        '<input class="vs-min" type="number" step="any" placeholder="0" value="'+esc(String(binLocked?0:minVal))+'"'+(binLocked?' disabled':'')+' aria-label="'+esc(t('varMin'))+' '+esc(v.label)+'"></label>'+
        '<label class="vs-field"><span class="vs-mlabel">'+esc(t('varMax'))+'</span>'+
        '<input class="vs-max" type="number" step="any" placeholder="&#8734;" value="'+esc(String(binLocked?1:maxVal))+'"'+(binLocked?' disabled':'')+' aria-label="'+esc(t('varMax'))+' '+esc(v.label)+'"></label>'+
        '</div>';
    }).join('');
    var head='<div class="vs-row vs-head"><span class="vs-name">'+esc(t('varName'))+'</span>'+
      '<span>'+esc(t('varType'))+'</span><span>'+esc(t('varMin'))+'</span><span>'+esc(t('varMax'))+'</span></div>';
    var staleNote=panelStale?'<div class="vs-stale">'+esc(t('varStale'))+'</div>':'';
    body.innerHTML=staleNote+head+rows;
    // Wire each row's inputs to update varSettings.
    var rowEls=body.querySelectorAll('.vs-row[data-cell]');
    for(var k=0;k<rowEls.length;k++){
      (function(row){
        var cell=row.getAttribute('data-cell');
        var typeSel=row.querySelector('.vs-type');
        var minIn=row.querySelector('.vs-min');
        var maxIn=row.querySelector('.vs-max');
        typeSel.addEventListener('change',function(){
          saveUndo();              // snapshot BEFORE the change, so undo reverts just this
          var s=settingsFor(cell); s.type=typeSel.value;
          if(s.type==='binary'){ s.min=0; s.max=1; }
          modelChanged(true);      // changing a domain invalidates any solve/result
          renderVarPanel();    // re-render to lock/unlock min/max
        });
        if(minIn) minIn.addEventListener('input',function(){
          var s=settingsFor(cell);
          s.min=cleanBound(minIn.value);
          modelChanged(true);
          clearUndo();   // don't let Ctrl+Z jump past this edit to an earlier change
          showVarError(cell);
        });
        if(maxIn) maxIn.addEventListener('input',function(){
          var s=settingsFor(cell);
          s.max=cleanBound(maxIn.value);
          modelChanged(true);
          clearUndo();
          showVarError(cell);
        });
      })(rowEls[k]);
    }
    // The panel HTML was just rebuilt, which drops any inline error messages.
    // Re-show them so invalid bounds stay visible (e.g. after changing another
    // variable's type, or switching language).
    detectedVars.forEach(function(v){ showVarError(v.cell); });
  }

  // Build {integer, bounds} for optimise_ from the panel + the global toggle.
  // Returns null when the panel hasn't been used and the global toggle is off,
  // so untouched models pass nothing extra and behave exactly as before.
  function variableDomains(variableCells, wholeToggle){
    var anyPanel=false;
    for(var i=0;i<variableCells.length;i++){ if(varSettings[variableCells[i]]) { anyPanel=true; break; } }
    if(!anyPanel && !wholeToggle) return null;
    var integerIdx=[], bounds=[], anyInteger=false, anyBound=false;
    for(var j=0;j<variableCells.length;j++){
      var s=varSettings[variableCells[j]]||{ type:'continuous', min:0, max:null };
      var isInt=(s.type==='integer'||s.type==='binary');
      // Global "whole numbers" makes everything integer EXCEPT explicit binaries
      // (which are already integer anyway) and leaves nothing continuous.
      if(wholeToggle && s.type!=='binary') isInt=true;
      if(isInt){ integerIdx.push(j); anyInteger=true; }
      // Treat a NaN marker (invalid input) as no limit; solve() already blocks
      // on validation errors, so this is only a safety net.
      var sMin=(typeof s.min==='number' && !isNaN(s.min))?s.min:null;
      var sMax=(typeof s.max==='number' && !isNaN(s.max))?s.max:null;
      var lo=(s.type==='binary')?0:(sMin!=null?sMin:0);
      var hi=(s.type==='binary')?1:sMax;
      // A positive min below the engine's activation tolerance is effectively
      // zero; normalise it so it doesn't look "set" while being ignored.
      if(lo>0 && lo<=1e-9) lo=0;
      // Variables are non-negative; a negative lower is clamped to 0 here as a
      // safety net (the UI already rejects it, so this shouldn't trigger).
      if(lo<0) lo=0;
      bounds.push({ lower:lo, upper:hi });
      // A bound is "active" if it constrains beyond the default 0..inf.
      if(lo>1e-9 || hi!=null) anyBound=true;
    }
    return { integer: anyInteger?integerIdx:false, bounds: anyBound?bounds:null };
  }