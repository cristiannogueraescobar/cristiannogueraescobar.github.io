  function render(){
    var t=document.getElementById('grid');
    t.setAttribute('aria-label', Plumline.i18n.t(LANG,'solver','gridLabel'));
    var html='<tr><th class="corner"></th>';
    for(var c=0;c<COLS;c++)html+='<th scope="col">'+colLetter(c+1)+'</th>';
    html+='</tr>';
    for(var r=0;r<ROWS;r++){
      html+='<tr><th scope="row" class="rownum">'+(r+1)+'</th>';
      for(var c=0;c<COLS;c++){
        var v=(data[r]&&data[r][c])||'';
        var cellRef=colLetter(c+1)+(r+1);
        var cellName=Plumline.i18n.t(LANG,'solver','cellLabel').replace('{ref}', cellRef);
        html+='<td><input aria-label="'+cellName.replace(/"/g,'&quot;')+'" data-r="'+r+'" data-c="'+c+'" value="'+v.replace(/"/g,'&quot;')+'"></td>';
      }
      html+='</tr>';
    }
    t.innerHTML=html;
    var inputs=t.querySelectorAll('input');
    for(var i=0;i<inputs.length;i++){
      inputs[i].addEventListener('input',function(e){
        data[+e.target.getAttribute('data-r')][+e.target.getAttribute('data-c')]=e.target.value;
        modelChanged();   // an in-flight solve is now stale
        clearUndo();   // a manual edit invalidates the previous paste/delete undo
      });
      inputs[i].addEventListener('paste',function(e){
        var cd=e.clipboardData||window.clipboardData;
        if(!cd) return;   // very old browser: let the default paste happen
        var text=cd.getData('text/plain')||cd.getData('text')||'';
        var block=parseClipboard(text);
        // Only intercept a genuine multi-cell block; a single value pastes
        // normally so the user can still edit one cell by hand.
        var multi=block.length>1||(block.length===1&&block[0].length>1);
        if(!multi){ modelChanged(); clearUndo(); return; }   // single-cell paste is a new edit
        e.preventDefault();
        modelChanged();
        var startR=+e.target.getAttribute('data-r');
        var startC=+e.target.getAttribute('data-c');
        saveUndo();   // enable undo of this whole paste
        var res=pasteBlock(block,startR,startC);
        render();
        updateSenseHint();   // the pasted block may have changed the objective
        if(res.clipped) showTrouble(t('tPasteClipped'), t('tPasteClippedBody'));
      });
    }
    syncGridTools();
  }

  // Dynamic grid: grow or shrink the sheet, keeping existing data in place and
  // staying within bounds that keep the in-browser solver responsive.
  function ensureShape(){
    // Guarantee data has exactly ROWS x COLS cells, preserving what's there.
    for(var r=0;r<ROWS;r++){
      if(!data[r]) data[r]=[];
      for(var c=0;c<COLS;c++) if(data[r][c]==null) data[r][c]='';
      data[r].length=COLS;
    }
    data.length=ROWS;
  }
  function addRow(){ if(ROWS>=MAX_ROWS) return; modelChanged(); clearUndo(); ROWS++; ensureShape(); render(); }
  function addCol(){ if(COLS>=MAX_COLS) return; modelChanged(); clearUndo(); COLS++; ensureShape(); render(); }

  // Does the last row / last column hold any non-empty cell? Used to warn
  // before a delete would discard real data.
  function lastRowHasData(){
    var r=ROWS-1; if(!data[r]) return false;
    for(var c=0;c<COLS;c++) if(data[r][c]!=null&&String(data[r][c]).trim()!=='') return true;
    return false;
  }
  function lastColHasData(){
    var c=COLS-1;
    for(var r=0;r<ROWS;r++) if(data[r]&&data[r][c]!=null&&String(data[r][c]).trim()!=='') return true;
    return false;
  }

  function delRow(){
    if(ROWS<=MIN_ROWS) return;
    // Warn before discarding a row that still holds data. The delete is also
    // undoable, so this is a light confirm, not a hard block.
    if(lastRowHasData() && !confirm(t('confirmDelRow'))) return;
    modelChanged();
    saveUndo();
    ROWS--; ensureShape(); render();
  }
  function delCol(){
    if(COLS<=MIN_COLS) return;
    if(lastColHasData() && !confirm(t('confirmDelCol'))) return;
    modelChanged();
    saveUndo();
    COLS--; ensureShape(); render();
  }

  // Disable a button when its limit is reached, so the bounds are visible.
  function syncGridTools(){
    var set=function(id,disabled){var b=document.getElementById(id); if(b) b.disabled=disabled;};
    set('addRow', ROWS>=MAX_ROWS); set('delRow', ROWS<=MIN_ROWS);
    set('addCol', COLS>=MAX_COLS); set('delCol', COLS<=MIN_COLS);
    var gs=document.getElementById('gridsize');
    if(gs) gs.textContent=t('gridSize').replace('{rows}',ROWS).replace('{cols}',COLS);
  }

  // --- Smart tabular paste (from Excel / Google Sheets) ---------------------
  // Parse clipboard text into a 2D block: tabs split columns, newlines split
  // rows. Everything else (formulas starting with '=', decimals, text with
  // spaces, zeros, empty cells) is kept verbatim as a string.
  function parseClipboard(text){
    if(text==null) return [];
    // Normalise newlines; drop a single trailing newline (common when copying).
    var t=String(text).replace(/\r\n/g,'\n').replace(/\r/g,'\n');
    if(t.charAt(t.length-1)==='\n') t=t.slice(0,-1);
    if(t==='') return [];
    var rows=t.split('\n');
    return rows.map(function(line){ return line.split('\t'); });
  }

  // Remember the last destructive operation (paste or delete) so it can be
  // undone in one step.
  var lastUndo=null;   // { data, ROWS, COLS, varSettings, detectedVars, panelStale }

  function snapshot(){
    var sel=document.getElementById('senseSel');
    var loc=document.getElementById('localeSel');
    return {
      data:data.map(function(row){return row.slice();}), ROWS:ROWS, COLS:COLS,
      // Deep-copy the panel state so undo restores variable types/bounds too.
      varSettings:JSON.parse(JSON.stringify(varSettings)),
      detectedVars:detectedVars.slice(),
      panelStale:panelStale,
      // Capture the objective-direction confirmation, so undo doesn't force a
      // re-confirm of a direction the user had already set.
      senseValue:sel?sel.value:'auto',
      localeValue:loc?loc.value:'auto',
      confirmedObjectiveSig:confirmedObjectiveSig?JSON.parse(JSON.stringify(confirmedObjectiveSig)):null
    };
  }
  function restore(snap){
    ROWS=snap.ROWS; COLS=snap.COLS;
    data=snap.data.map(function(row){return row.slice();});
    // Restore the panel state if the snapshot carried it (older snapshots may not).
    if(snap.varSettings){ varSettings=JSON.parse(JSON.stringify(snap.varSettings)); }
    if(snap.detectedVars){ detectedVars=snap.detectedVars.slice(); }
    if(typeof snap.panelStale==='boolean'){ panelStale=snap.panelStale; }
    // Restore the objective-direction confirmation.
    if('senseValue' in snap){ var sel=document.getElementById('senseSel'); if(sel) sel.value=snap.senseValue; }
    if('localeValue' in snap){ var loc=document.getElementById('localeSel'); if(loc) loc.value=snap.localeValue; }
    if('confirmedObjectiveSig' in snap){ confirmedObjectiveSig=snap.confirmedObjectiveSig; }
    render();
    // Reflect the restored panel state in the UI.
    var panel=document.getElementById('varSettings');
    if(detectedVars.length){ if(panel){ panel.style.display=''; } renderVarPanel(); setDetectLabel(panelStale); }
    else if(panel){ panel.style.display='none'; setDetectLabel(false); }
    updateSenseHint();
  }
  // Capture the current state as the undo point and reveal the Undo button.
  function saveUndo(){
    lastUndo=snapshot();
    var u=document.getElementById('undoGrid'); if(u) u.style.display='';
  }

  // Paste a parsed block with its top-left at (startR, startC). Grows the grid
  // to fit (never past MAX), keeps everything outside the pasted area, and
  // returns { clipped:bool } so the caller can warn if the block didn't fit.
  function pasteBlock(block, startR, startC){
    if(!block.length) return { clipped:false };
    var needRows=startR+block.length;
    var needCols=startC+block.reduce(function(m,r){return Math.max(m,r.length);},0);
    var clipped=false;
    if(needRows>MAX_ROWS){ needRows=MAX_ROWS; clipped=true; }
    if(needCols>MAX_COLS){ needCols=MAX_COLS; clipped=true; }
    // Grow (never shrink) to fit the block.
    if(needRows>ROWS) ROWS=needRows;
    if(needCols>COLS) COLS=needCols;
    ensureShape();
    // Write the block, skipping cells that fall outside the (capped) grid.
    for(var i=0;i<block.length;i++){
      var rr=startR+i; if(rr>=ROWS) break;
      for(var j=0;j<block[i].length;j++){
        var cc=startC+j; if(cc>=COLS) continue;
        data[rr][cc]=block[i][j];
      }
    }
    return { clipped:clipped };
  }

  function doUndo(){
    if(!lastUndo) return;
    modelChanged();   // undo changes the model too: invalidate any solve/result
    restore(lastUndo);
    lastUndo=null;
    var u=document.getElementById('undoGrid'); if(u) u.style.display='none';
  }

  // --- CSV import -----------------------------------------------------------
  // A correct CSV parser: fields may be quoted, and a quoted field can contain
  // commas, newlines, and escaped quotes (""). Unquoted fields split on commas
  // and rows split on newlines. Returns a 2D array of strings.
  function parseCSV(text){
    var t=String(text).replace(/\r\n/g,'\n').replace(/\r/g,'\n');
    var rows=[], row=[], field='', inQuotes=false;
    for(var i=0;i<t.length;i++){
      var ch=t.charAt(i);
      if(inQuotes){
        if(ch==='"'){
          if(t.charAt(i+1)==='"'){ field+='"'; i++; }   // escaped quote
          else inQuotes=false;                           // closing quote
        } else field+=ch;
      } else {
        if(ch==='"') inQuotes=true;
        else if(ch===','){ row.push(field); field=''; }
        else if(ch==='\n'){ row.push(field); rows.push(row); row=[]; field=''; }
        else field+=ch;
      }
    }
    // flush the final field/row unless the text ended on a clean newline
    if(field!==''||row.length){ row.push(field); rows.push(row); }
    // drop a single trailing empty row (file ending in a newline)
    if(rows.length && rows[rows.length-1].length===1 && rows[rows.length-1][0]==='') rows.pop();
    return rows;
  }

  function importCSVText(text){
    var block=parseCSV(text);
    if(!block.length){ showTrouble(t('tCsvEmpty'), t('tCsvEmptyBody')); return; }
    // Replace the grid with the CSV, sized to fit (capped at MAX), from A1.
    modelChanged();
    saveUndo();        // capture the OLD grid + panel first, so undo restores them
    resetVarPanel();   // full model replacement: old variable settings are void
    var needRows=Math.min(MAX_ROWS, Math.max(MIN_ROWS, block.length));
    var needCols=Math.min(MAX_COLS, Math.max(MIN_COLS, block.reduce(function(m,r){return Math.max(m,r.length);},0)));
    var clipped=(block.length>MAX_ROWS)||block.some(function(r){return r.length>MAX_COLS;});
    ROWS=needRows; COLS=needCols; blank();
    for(var r=0;r<block.length&&r<ROWS;r++)
      for(var c=0;c<block[r].length&&c<COLS;c++)
        data[r][c]=block[r][c];
    render();
    document.getElementById('result').classList.remove('show');
    if(clipped) showTrouble(t('tPasteClipped'), t('tPasteClippedBody'));
  }

  function importCSVFile(file){
    if(!file) return;
    var reader=new FileReader();
    reader.onload=function(e){ importCSVText(String(e.target.result||'')); };
    reader.onerror=function(){ showTrouble(t('tCsvError'), t('tCsvErrorBody')); };
    reader.readAsText(file);
  }
  // Invalidate a stale undo point. Called after any NEW action that changes the
  // grid (editing a cell, adding/removing rows or columns, loading an example,
  // clearing), so Ctrl+Z can never jump back past those later changes. NOT
  // called on Solve, which doesn't modify the grid.
  function clearUndo(){
    lastUndo=null;
    var u=document.getElementById('undoGrid'); if(u) u.style.display='none';
  }

  // Build the sheet object the engine expects from the current grid.
  function sheetFromGrid(){
    var formulas=[],values=[];
    for(var r=0;r<ROWS;r++){
      var fr=[],vr=[];
      for(var c=0;c<COLS;c++){
        var raw=(data[r]&&data[r][c]!=null)?String(data[r][c]):'';
        var cell=classifyGridCell_(raw);   // single source of truth
        fr.push(cell.formula); vr.push(cell.value);
      }
      formulas.push(fr);values.push(vr);
    }
    return {getDataRange:function(){return{
      getRow:function(){return 1;},getColumn:function(){return 1;},
      getFormulas:function(){return formulas;},getValues:function(){return values;}
    };}};
  }