  // Number formatting follows the active interface locale, so the spoken
  // announcement and the visible receipt both read naturally in that language
  // (grouping and decimal separators vary by locale, e.g. 12.345 vs 12 345).
  function activeLocale(){
    return {en:'en-GB',es:'es-ES',pt:'pt-PT',de:'de-DE',fr:'fr-FR'}[LANG] || 'en-GB';
  }
  function fmt(n){if(n==null||isNaN(n))return '—';return Number(n).toLocaleString(activeLocale(),{maximumFractionDigits:4});}

  // Respect the user's reduced-motion preference for programmatic scrolling:
  // scrollIntoView's own 'smooth' bypasses the CSS scroll-behavior override, so
  // we choose the behavior explicitly.
  function scrollBehavior(){
    return (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) ? 'auto' : 'smooth';
  }

  // Announce a CONCISE one-line outcome to the dedicated live region. The full
  // receipt is rendered into #result (not a live region), so a screen reader
  // hears a short summary ("Optimal solution found. Total: 1760") instead of
  // the entire receipt read aloud. We clear the region first, then set the
  // message on a short timer: if two solves produce the identical string, some
  // screen readers won't re-announce an unchanged live region — the empty-then-
  // set cycle guarantees a fresh announcement each time.
  var announceTimer=null;
  function announce(msg){
    var el=document.getElementById('solveAnnounce');
    if(!el) return;
    clearTimeout(announceTimer);
    el.textContent='';
    announceTimer=setTimeout(function(){ el.textContent=msg||''; }, 20);
  }

  // --- Web Worker: run the solve off the main thread ------------------------
  // The engine is inline in this page (single source of truth, shared with the
  // add-on). To run it in a worker without duplicating it, we extract the
  // engine source between the ENGINE_START/END markers from this page's own
  // scripts, wrap it with a small message handler, and spin up a Blob worker.
  // If anything here is unsupported, solve() falls back to the main thread.
  var engineWorker=null, workerBusy=false, workerToken=0;

  function engineSource(){
    var scripts=document.getElementsByTagName('script');
    for(var i=0;i<scripts.length;i++){
      var txt=scripts[i].textContent||'';
      var a=txt.indexOf('/* ENGINE_START */'), b=txt.indexOf('/* ENGINE_END */');
      if(a!==-1&&b!==-1&&b>a) return txt.slice(a,b);
    }
    return null;
  }

  function buildWorker(){
    if(engineWorker!==null) return engineWorker;   // already built (or false)
    try{
      if(typeof Worker==='undefined'||typeof Blob==='undefined'||typeof URL==='undefined'||!URL.createObjectURL)
        throw new Error('no worker support');
      var src=engineSource();
      if(!src) throw new Error('engine source not found');
      // The worker rebuilds the sheet wrapper from the raw grid arrays, then
      // runs detect + solve — the whole heavy path off the main thread.
      var glue=[
        'self.onmessage=function(e){',
        '  var d=e.data;',
        '  function mkSheet(formulas,values){',
        '    return {getDataRange:function(){return{',
        '      getRow:function(){return 1;},getColumn:function(){return 1;},',
        '      getFormulas:function(){return formulas;},getValues:function(){return values;}',
        '    };}};',
        '  }',
        '  try{',
        '    var sheet=mkSheet(d.formulas,d.values);',
        '    var model;',
        '    try{ model=detectModel_(sheet, d.localeMode); }',
        '    catch(rerr){ rerr.__phase="read"; throw rerr; }',
        '    model.wholeNumbers=d.wholeNumbers===true;',
        '    if(d.domains) model.domains=d.domains;',
        '    if(d.sense==="max"||d.sense==="min") model.objective.sense=d.sense;',
        '    var out=solveModel_(sheet,model, d.localeMode);',
        '    self.postMessage({token:d.token,ok:true,out:out,wholeNumbers:model.wholeNumbers});',
        '  }catch(err){',
        '    self.postMessage({token:d.token,ok:false,phase:(err&&err.__phase)||"solve",error:String(err&&err.message||err)});',
        '  }',
        '};'
      ].join('\n');
      var blob=new Blob([src+'\n'+glue],{type:'application/javascript'});
      var workerUrl=URL.createObjectURL(blob);
      engineWorker=new Worker(workerUrl);
      URL.revokeObjectURL(workerUrl);   // the Worker has loaded its code; free the URL
    }catch(err){
      engineWorker=false;   // mark as unavailable; use the main-thread fallback
    }
    return engineWorker;
  }