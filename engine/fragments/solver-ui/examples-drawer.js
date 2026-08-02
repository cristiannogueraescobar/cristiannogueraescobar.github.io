  // Examples drawer: build the grouped catalog, wire open/close.
  function renderExamplesDrawer(){
    var body=document.getElementById('exDrawerBody'); if(!body) return;
    var typeTag={continuous:t('typeContinuous'),integer:t('typeInteger'),binary:t('typeBinary'),mixed:t('sdMixed')};
    var html='';
    CATEGORY_ORDER.forEach(function(cat){
      var items=examplesInCategory(cat);
      if(!items.length) return;
      html+='<div class="drawer-section"><h4>'+esc(t('exCat_'+cat))+'</h4>';
      items.forEach(function(key){
        var mt=typeOf(key)||'continuous';
        var tags=[ (typeTag[mt]||mt).toUpperCase(),
                   (senseOf(key)==='min'?t('senseMin'):t('senseMax')).toUpperCase() ];
        html+='<button class="ex-card" data-ex="'+key+'">'+
                '<div class="ex-name">'+esc(t('exName_'+key))+'</div>'+
                '<div class="ex-desc">'+esc(t('exDesc_'+key))+'</div>'+
                '<div class="ex-tags">'+tags.join(' &middot; ')+'</div>'+
              '</button>';
      });
      html+='</div>';
    });
    body.innerHTML=html;
    body.querySelectorAll('[data-ex]').forEach(function(btn){
      btn.addEventListener('click',function(){ loadExample(btn.getAttribute('data-ex')); closeDrawer(); });
    });
  }
  // Elements to make inert (removed from the a11y tree and non-interactive)
  // while the drawer is open: everything at the top level except the drawer
  // and its backdrop.
  function backgroundEls(){
    var out=[];
    var kids=document.body.children;
    for(var i=0;i<kids.length;i++){
      var el=kids[i];
      if(el.id==='exDrawer'||el.id==='exDrawerBackdrop') continue;
      if(el.tagName==='SCRIPT') continue;
      out.push(el);
    }
    return out;
  }
  var __prevOverflow='';
  function openDrawer(){
    if(!EXAMPLES_OK) return;                 // examples disabled (metadata missing)
    var drawer=document.getElementById('exDrawer');
    if(!drawer || !drawer.hidden) return;   // already open: don't re-run (would clobber saved state)
    renderExamplesDrawer();
    drawer.hidden=false;
    document.getElementById('exDrawerBackdrop').hidden=false;
    __prevOverflow=document.body.style.overflow;              // save prior scroll state
    document.body.style.overflow='hidden';                    // lock background scroll
    // Save each background element's prior inert state, then set inert. On
    // close we restore exactly what was there, so this is safe even if an
    // element was already inert for another reason.
    backgroundEls().forEach(function(el){ el.__prevInert=el.inert; el.inert=true; });
    var openBtn=document.getElementById('openExamples'); if(openBtn) openBtn.setAttribute('aria-expanded','true');
    var closeBtn=document.getElementById('closeExamples');
    if(closeBtn){ closeBtn.setAttribute('aria-label', t('closeLabel')); closeBtn.focus(); }  // move focus in
  }
  function closeDrawer(){
    var drawer=document.getElementById('exDrawer');
    if(!drawer || drawer.hidden) return;
    drawer.hidden=true;
    document.getElementById('exDrawerBackdrop').hidden=true;
    document.body.style.overflow=__prevOverflow;              // restore prior scroll state
    backgroundEls().forEach(function(el){ el.inert=(el.__prevInert===true); delete el.__prevInert; });  // restore prior inert state
    var openBtn=document.getElementById('openExamples');
    if(openBtn){ openBtn.setAttribute('aria-expanded','false'); openBtn.focus(); }  // return focus
  }