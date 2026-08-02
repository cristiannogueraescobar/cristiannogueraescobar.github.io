  function solve(){
    var res=document.getElementById('result');
    var btn=document.getElementById('solve');
    // The objective direction must be confirmed once per model, so we never
    // solve in the wrong direction from a heuristic guess.
    if(!senseConfirmed()){
      res.innerHTML='<div class="trouble">'+t('senseConfirmBody')+'</div>';
      res.classList.add('show');
      updateSenseHint();
      return;
    }
    if(anyVarError()){
      res.innerHTML='<div class="trouble">'+t('varErrBlock')+'</div>';
      res.classList.add('show');
      return;
    }
    // If the grid changed after variables were detected and custom settings
    // exist, the settings are keyed by cell and could apply to the wrong
    // variable. Make the user refresh first, rather than silently mis-apply.
    if(panelStale && hasCustomSettings()){
      res.innerHTML='<div class="trouble">'+t('varStaleBlock')+'</div>';
      res.classList.add('show');
      return;
    }
    var sheet=sheetFromGrid();
    var wholeNumbers=document.getElementById('whole').checked;
    // One locale mode drives the whole operation: the domain prep below AND the
    // worker payload. Detecting domains as Auto/US while the worker solves as EU
    // would drop bounds/integrality for an EU-only formula and change the model.
    var localeMode=currentLocaleMode();

    // Build per-variable domains from the panel (+ global toggle). Detecting
    // here (fast, no solving) gives the variable cell order to map settings to
    // indices; the worker detects again for the actual solve.
    var domains=null;
    try{
      var m=detectModel_(sheet, localeMode);
      var cells=expandRange_(loadGrid_(sheet, localeMode), m.variables);
      domains=variableDomains(cells, wholeNumbers);
    }catch(e){ domains=null; }   // detection issues surface in the worker

    var w=buildWorker();
    if(!w){ offerCompatMode(); return; }   // no worker support: ask before a sync solve

    // Show a solving state with a Cancel button, so a long solve never traps
    // the user and never freezes the page.
    res.innerHTML='<div class="solving"><span class="spin" aria-hidden="true"></span>'+t('solving')+
      ' <button class="ghost cancel-solve" id="cancelSolve">'+t('cancelSolve')+'</button></div>';
    res.classList.add('show');
    if(btn){ btn.disabled=true; }
    workerBusy=true;
    lastResult=null;   // drop any prior answer up front, so an errored run can't leave a stale one exportable
    var myToken=++workerToken;

    var cancelBtn=document.getElementById('cancelSolve');
    if(cancelBtn) cancelBtn.addEventListener('click',function(){ cancelSolve(); });

    w.onmessage=function(e){
      // Discard any message that isn't from the run that's still current. Check
      // against the GLOBAL workerToken (not the captured myToken): cancelling or
      // editing bumps workerToken, and a message already queued before
      // terminate() must still be dropped. This matches the onerror guard.
      if(e.data.token!==workerToken) return;
      workerBusy=false;
      if(btn){ btn.disabled=false; }
      if(e.data.ok){ presentResult(e.data.out, {wholeNumbers:e.data.wholeNumbers}); }
      else{
        var key=(e.data.phase==='read')?'tRead':'tSolve';
        showEngineTrouble(key, e.data.error||'');
      }
    };
    w.onerror=function(){
      // Ignore an error tied to a run we've already superseded or cancelled.
      if(myToken!==workerToken) return;
      workerBusy=false;
      if(engineWorker){ engineWorker.terminate(); }
      engineWorker=false;   // don't rebuild the same broken worker automatically
      if(btn){ btn.disabled=false; }
      // Don't silently run a solve that could freeze the page. Let the user
      // choose compatibility mode (synchronous main-thread solve).
      offerCompatMode();
    };

    var payload=sheetToArrays(sheet);
    payload.wholeNumbers=wholeNumbers;
    payload.domains=domains;
    payload.sense=(document.getElementById('senseSel')||{}).value;
    payload.localeMode=localeMode;
    payload.token=myToken;
    w.postMessage(payload);
  }

  // Extract the two raw 2D arrays from the sheet wrapper, so they can be
  // structured-cloned into the worker (functions can't cross the boundary).
  function sheetToArrays(sheet){
    var dr=sheet.getDataRange();
    return { formulas:dr.getFormulas(), values:dr.getValues() };
  }

  function cancelSolve(silent){
    if(!workerBusy) return;
    workerToken++;             // any in-flight result is now stale and ignored
    if(engineWorker){ engineWorker.terminate(); engineWorker=null; }  // rebuild next time
    workerBusy=false;
    var btn=document.getElementById('solve'); if(btn){ btn.disabled=false; }
    var res=document.getElementById('result');
    res.innerHTML='<div class="trouble">'+t(silent?'modelChangedBody':'cancelledBody')+'</div>';
    res.classList.add('show');
  }

  // Any edit to the model invalidates an in-flight solve AND any finished
  // result already on screen: both would belong to the old model but appear
  // to describe the new one. Cancel the run, clear the stale receipt, and drop
  // lastResult so the export buttons can't emit an outdated answer.
  function modelChanged(fromPanel){
    if(workerBusy){
      cancelSolve(true);
    } else {
      var res=document.getElementById('result');
      if(res && res.classList.contains('show')){
        res.innerHTML='<div class="trouble">'+t('modelChangedBody')+'</div>';
      }
    }
    lastResult=null;
    // A grid edit may have changed the objective (cell/label), which lapses the
    // direction confirmation. Keep the hint accurate.
    if(!fromPanel) updateSenseHint();
    // A GRID change (not a panel change) may invalidate the detected variables.
    // Keep the settings, but flag the panel and offer to refresh.
    if(!fromPanel && detectedVars.length && !panelStale){
      panelStale=true;
      setDetectLabel(true);
      var body=document.getElementById('varSettingsBody');
      if(body && !body.querySelector('.vs-stale')){
        var note=document.createElement('div');
        note.className='vs-stale';
        note.textContent=t('varStale');
        body.insertBefore(note, body.firstChild);
      }
    }
  }

  // Ask the user before running a synchronous solve that could briefly freeze
  // the page — used both when the worker errors and when it isn't supported.
  function offerCompatMode(){
    var res=document.getElementById('result');
    res.innerHTML='<div class="trouble">'+t('workerFailedBody')+
      ' <button class="ghost compat-solve" id="compatSolve">'+t('compatRetry')+'</button></div>';
    res.classList.add('show');
    var cb=document.getElementById('compatSolve');
    if(cb) cb.addEventListener('click',function(){ solveMainThread(); });
  }

  // Fallback: solve synchronously on the main thread (original behaviour).
  function solveMainThread(){
    var res=document.getElementById('result');
    var btn=document.getElementById('solve');
    res.innerHTML='<div class="solving"><span class="spin" aria-hidden="true"></span>'+t('solving')+'</div>';
    res.classList.add('show');
    if(btn){ btn.disabled=true; }
    setTimeout(function(){ runSolve(); if(btn){ btn.disabled=false; } }, 30);
  }

  function runSolve(){
    var sheet=sheetFromGrid();
    var lm=currentLocaleMode();
    var model;
    try{ model=detectModel_(sheet, lm); }
    catch(err){ return showEngineTrouble('tRead', err); }
    model.wholeNumbers=document.getElementById('whole').checked;
    var senseSel=(document.getElementById('senseSel')||{}).value;
    if(senseSel==='max'||senseSel==='min') model.objective.sense=senseSel;
    try{
      var cells=expandRange_(loadGrid_(sheet, lm), model.variables);
      model.domains=variableDomains(cells, model.wholeNumbers);
    }catch(e){ model.domains=null; }

    var out;
    try{ out=solveModel_(sheet,model, lm); }
    catch(err){ return showEngineTrouble('tSolve', err); }

    presentResult(out, model);
  }