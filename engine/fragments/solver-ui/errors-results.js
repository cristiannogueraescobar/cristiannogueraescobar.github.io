  function presentResult(out, model){
    if(out.status!=='optimal'&&out.status!=='feasible'){
      // Pick a title that matches the actual outcome, so the headline never
      // says "no solution" when the search was simply incomplete.
      var title, body;
      if(out.status==='infeasible'){ title=t('tInfeasible'); body=t('statusInfeasibleBody'); }
      else if(out.status==='unbounded'){ title=t('tUnbounded'); body=t('statusUnboundedBody'); }
      else if(out.status==='numerical_failure'){ title=t('tNumerical'); body=t('statusNumericalBody'); }
      else if(out.status==='invalid_model'){ title=t('tInvalidModel'); body=t('statusInvalidBody'); }
      else { title=t('tIncomplete'); body=t('statusUnknownBody'); }   // unknown, iteration_limit, time_limit, node_limit...
      return showTrouble(title, body, out, model);
    }
    var verified = renderReceipt(out,model);
    // The announcement must match what the receipt shows. If the defensive
    // verification failed, never announce success — announce the failure.
    if(!verified){ announce(t('verifyFailed')); return; }
    // Concise spoken summary (the receipt itself is not a live region).
    var word=(out.status==='optimal')?t('announceOptimal'):t('announceFeasible');
    announce(word+'. '+(out.objectiveLabel||t('exResult'))+': '+fmt(out.objective));
  }

  function showTrouble(title,msg,out,model){
    var res=document.getElementById('result');
    var extra=(out?solveDetailsHTML(out,model||{}):'');
    // Escape title and msg: engine error messages can include fragments of a
    // user-written formula or cell label, so they must never be treated as HTML.
    res.innerHTML='<div class="trouble"><b>'+esc(title)+'.</b> '+esc(msg)+'</div>'+extra;
    res.classList.add('show'); res.scrollIntoView({behavior:scrollBehavior(),block:'nearest'});
    announce(title);   // concise: just the headline outcome
  }

  // Single choke point for surfacing an engine error to the user: it localizes
  // the message and shows it. EVERY route that displays an engine error calls
  // this, so no route can drift back to raw English. Accepts an Error or string.
  function showEngineTrouble(titleKey, error){
    var message = (error && error.message != null) ? error.message : error;
    return showTrouble(t(titleKey), localizeEngineError(message));
  }

  // A collapsible "Solve details" block that surfaces what the engine reports:
  // status, time, nodes, model type, and (when relevant) why it stopped and
  // whether optimality was proven. Turns internal engine fields into visible value.
  function solveDetailsHTML(out,model){
    // A continuous LP can hand back a bare limit status (iteration_limit,
    // time_limit, node_limit) as its status, with no stopReason. Normalise
    // that here, in the presentation layer, so the status reads "Search
    // incomplete" and a "Stopped because" row still appears. The engine keeps
    // returning its raw fields untouched (it's shared with the add-on).
    var limitStatuses=['iteration_limit','time_limit','node_limit'];
    var displayStatus=(limitStatuses.indexOf(out.status)>=0)?'unknown':out.status;
    var displayStopReason=out.stopReason||((limitStatuses.indexOf(out.status)>=0)?out.status:null);
    var statusName={optimal:t('statOptimal'),feasible:t('statFeasible'),unknown:t('statUnknown'),
      infeasible:t('statInfeasible'),unbounded:t('tUnbounded'),numerical_failure:t('tNumerical')}[displayStatus]||displayStatus;
    var rows=[];
    rows.push([t('sdStatus'), statusName]);
    if(typeof out.elapsedMs==='number') rows.push([t('sdTime'), out.elapsedMs+' ms']);
    if(typeof out.nodesExplored==='number'&&out.nodesExplored!=null) rows.push([t('sdNodes'), String(out.nodesExplored)]);
    var typeNames={continuous:t('sdContinuous'),integer:t('sdInteger'),binary:t('sdBinary'),mixed:t('sdMixed')};
    var mt=out.modelType || ((model && model.wholeNumbers===true)?'integer':'continuous');
    rows.push([t('sdModelType'), typeNames[mt]||typeNames.continuous]);
    if(out.sense) rows.push([t('sdObjective'), out.sense==='min'?t('senseMin'):t('senseMax')]);
    if(displayStopReason){
      var sr={node_limit:t('srNode'),time_limit:t('srTime'),iteration_limit:t('srIteration'),numerical_failure:t('srNumerical')}[displayStopReason]||displayStopReason;
      rows.push([t('sdStopped'), sr]);
    }
    if(out.status==='feasible'||out.status==='optimal'){
      rows.push([t('sdProven'), out.optimalityProven?t('sdYes'):t('sdNo')]);
    }
    var body=rows.map(function(r){return '<div class="sd-row"><span class="sd-k">'+esc(r[0])+'</span><span class="sd-v">'+esc(r[1])+'</span></div>';}).join('');
    return '<details class="solve-details"><summary>'+esc(t('solveDetails'))+'</summary>'+body+'</details>';
  }