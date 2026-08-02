  // Resolve a public slug (or a short internal key) to the internal key.
  var EXAMPLE_BY_SLUG={};
  Object.keys(EXAMPLES).forEach(function(key){ EXAMPLE_BY_SLUG[key]=key; });
  EXAMPLE_META.forEach(function(m){ if(EXAMPLES[m.key] && m.slug) EXAMPLE_BY_SLUG[m.slug]=m.key; });

  function loadExample(name){
    modelChanged();
    resetVarPanel();   // full model replacement: old variable settings are void
    clearUndo();   // loading/clearing replaces the whole grid; old undo is void
    var ex=EXAMPLES[name];
    if(name!=='blank' && ex){
      var grid=ex.grid;
      // Grow the grid to fit the example (never shrink below the defaults).
      var needRows=Math.max(12, grid.length);
      var needCols=Math.max(6, grid.reduce(function(m,row){return Math.max(m,row.length);},0));
      ROWS=Math.min(MAX_ROWS, needRows);
      COLS=Math.min(MAX_COLS, needCols);
      blank();
      for(var r=0;r<grid.length;r++)for(var c=0;c<grid[r].length;c++)data[r][c]=String(grid[r][c]);
    } else {
      ROWS=12; COLS=6; blank();
    }
    render();
    document.getElementById('result').classList.remove('show');
    // Whole-numbers toggle reflects the example (false for Blank), so a new
    // model started from Blank is never silently integer.
    var wholeBox=document.getElementById('whole');
    if(wholeBox) wholeBox.checked=!!(ex && ex.whole);
    if(name!=='blank' && ex){
      // Confirm the objective direction for this curated model, from the
      // example's own sense (not a re-detection), then remember the signature.
      var sel=document.getElementById('senseSel');
      var exSense=senseOf(name);
      if(sel){ sel.value=exSense||'auto'; }
      var sig=objectiveSignature();
      if(sig){ if(sel && (exSense==='max'||exSense==='min')) sig.detected=exSense; confirmedObjectiveSig=sig; }
      // Load per-variable domains into the panel, if the example defines them.
      // The panel opens only when the example asks for it (openVarSettings).
      if(ex.domains){
        detectForPanel({ open: ex.openVarSettings===true });
        Object.keys(ex.domains).forEach(function(cell){
          var d=ex.domains[cell];
          var s=settingsFor(cell);
          s.type=d.type; s.min=(d.min==null?null:d.min); s.max=(d.max==null?null:d.max);
          if(d.type==='binary'){ s.min=0; s.max=1; }
        });
        panelStale=false;
        renderVarPanel();
      }
    }
    updateSenseHint();
    updateExampleUrl(ex ? (slugOf(name)||name) : null);
  }
  // Keep ?ex= in the URL in sync with the loaded example, so a reload or a
  // copied link preserves the choice. Blank clears it.
  function updateExampleUrl(slug){
    try{
      var params=new URLSearchParams(location.search);
      if(slug && slug!=='blank') params.set('ex', slug); else params.delete('ex');
      history.replaceState(null, '', location.pathname +
        (params.toString()?'?'+params.toString():'') + location.hash);
    }catch(e){}
  }