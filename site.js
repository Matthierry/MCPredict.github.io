(function(){
  function normalize(path){
    const cleaned=((path||'/').split('?')[0].split('#')[0]||'/').replace(/\.html$/,'');
    if(cleaned==='/'||cleaned==='/index'||cleaned==='/index.html') return '/';
    if(cleaned==='') return '/';
    return cleaned.replace(/\/+$/g,'') || '/';
  }
  function sanitize(value){ return (value || '').trim(); }

  function csvToRows(text){
    return text.trim().split('\n').map((row)=>row.split(','));
  }

  function edgeBand(value){
    const cleaned = sanitize(value);
    const n = Number.parseFloat(cleaned);
    if (Number.isNaN(n)) return { label: cleaned || 'Small', cls: 'prediction-edge-small' };
    if (n >= 10) return { label: 'Strong', cls: 'prediction-edge-strong' };
    if (n >= 6) return { label: 'Medium', cls: 'prediction-edge-medium' };
    return { label: 'Small', cls: 'prediction-edge-small' };
  }

  function getColumnIndex(headerRow, aliases, fallback){
    const normalized = (headerRow || []).map((cell)=>sanitize(cell).toLowerCase());
    const idx = normalized.findIndex((cell)=>aliases.some((alias)=>cell.includes(alias)));
    return idx >= 0 ? idx : fallback;
  }

  function extractRowData(headerRow, row){
    const dayIndex = getColumnIndex(headerRow, ['day'], 0);
    const leagueIndex = getColumnIndex(headerRow, ['league'], 1);
    const homeIndex = getColumnIndex(headerRow, ['home'], 2);
    const awayIndex = getColumnIndex(headerRow, ['away'], 3);
    const predictionIndex = getColumnIndex(headerRow, ['prediction', 'result', 'pick'], 5);
    const awayRaw = sanitize(row[awayIndex]);
    const awayTeam = awayRaw.toLowerCase() === 'v' ? sanitize(row[awayIndex + 1]) : awayRaw;
    const bookmakerIndex = getColumnIndex(headerRow, ['bookmaker'], 6);
    const modelIndex = getColumnIndex(headerRow, ['model'], 7);
    const edgeIndex = getColumnIndex(headerRow, ['edge', 'value'], 8);

    return {
      day: sanitize(row[dayIndex]),
      league: sanitize(row[leagueIndex]),
      homeTeam: sanitize(row[homeIndex]),
      awayTeam,
      prediction: sanitize(row[predictionIndex]),
      bookmakerPrice: sanitize(row[bookmakerIndex]),
      modelPrice: sanitize(row[modelIndex]),
      edge: sanitize(row[edgeIndex])
    };
  }

  function renderPredictionCard(rowData){
    const edge = edgeBand(rowData.edge);
    return `<article class='prediction-card'><div class='prediction-card__meta'><span class='prediction-card__day'>${rowData.day}</span><span class='prediction-card__league'>${rowData.league}</span></div><div class='prediction-card__pick-row'><span class='prediction-card__pick-label'>Prediction</span><span class='prediction-badge'>${rowData.prediction}</span></div><div class='prediction-card__fixture'><span class='prediction-card__team prediction-card__team--home'>${rowData.homeTeam}</span><span class='prediction-card__versus'>v</span><span class='prediction-card__team prediction-card__team--away'>${rowData.awayTeam}</span></div><div class='prediction-card__odds'><div class='odds-cell'><span>Bookmaker Price</span><strong>${rowData.bookmakerPrice}</strong></div><div class='odds-cell'><span>Model Price</span><strong>${rowData.modelPrice}</strong></div></div><div class='prediction-card__edge'><span>Value / Edge Strength</span><strong class='${edge.cls}'>${edge.label}</strong></div></article>`;
  }

  function renderPredictionTable(rows, headerRow){
    const headers = ['League', 'Fixture', 'Result / Prediction', 'Bookie Price', 'Model Price', 'Value'];
    let table = "<div class='prediction-table-wrap'><table class='prediction-table'><thead><tr>";
    table += headers.map((cell, index)=>`<th class='prediction-col-${index + 1}'>${cell}</th>`).join("");
    table += "</tr></thead><tbody>";
    rows.forEach((row)=>{
      const rowData = extractRowData(headerRow, row);
      const fixture = `${rowData.homeTeam} v ${rowData.awayTeam}`.trim();
      table += `<tr data-day="${rowData.day}">`
        + `<td class='prediction-col-1'>${rowData.league}</td>`
        + `<td class='prediction-col-2'>${fixture}</td>`
        + `<td class='prediction-col-3'>${rowData.prediction}</td>`
        + `<td class='prediction-col-4'>${rowData.bookmakerPrice}</td>`
        + `<td class='prediction-col-5'>${rowData.modelPrice}</td>`
        + `<td class='prediction-col-6'>${rowData.edge}</td>`
        + "</tr>";
    });
    table += "</tbody></table></div>";
    return table;
  }

  

  function isActivePath(current, target){
    if(target==='/wc26/') return current==='/wc26' || current.startsWith('/wc26/');
    return current===normalize(target);
  }

  function getMenuRoots(){
    const roots=[...document.querySelectorAll('.menu-links, .nav-menu-links, [data-menu-links]')];
    if(roots.length) return roots;
    const panel=document.querySelector('.menu-panel, .menu-content, .nav-menu, .menu-overlay');
    if(!panel) return [];
    const nav=document.createElement('nav');
    nav.className='menu-links';
    nav.setAttribute('aria-label','Primary');
    panel.appendChild(nav);
    return [nav];
  }

  function renderGlobalMenu(){
    const items=Array.isArray(window.MCP_NAV_ITEMS)?window.MCP_NAV_ITEMS:[];
    if(!items.length){
      console.warn('MCP_NAV_ITEMS is missing or empty. Burger menu cannot render.');
      return;
    }
    const menuRoots=getMenuRoots();
    if(!menuRoots.length){
      console.warn('Burger menu container not found.');
      return;
    }
    const current=normalize(window.location.pathname);
    menuRoots.forEach((root)=>{
      root.innerHTML='';
      items.forEach((item)=>{
        const link=document.createElement('a');
        link.href=item.href;
        link.textContent=item.label;
        if(isActivePath(current, item.href)){
          link.classList.add('active');
          link.setAttribute('aria-current','page');
        }
        root.appendChild(link);
      });
    });
  }

  function initMenu(){/* unchanged */
    const overlay=document.getElementById('menuOverlay');
    const open=document.getElementById('openMenu');
    const close=document.getElementById('closeMenu');
    if(!overlay||!open||!close) return;
    const openMenu=()=>{overlay.classList.add('open');overlay.setAttribute('aria-hidden','false');};
    const closeMenu=()=>{overlay.classList.remove('open');overlay.setAttribute('aria-hidden','true');};
    open.addEventListener('click',openMenu);close.addEventListener('click',closeMenu);
    overlay.addEventListener('click',(e)=>{ if(e.target.closest('.menu-links a')) closeMenu(); });
    overlay.addEventListener('click',(e)=>{if(e.target===overlay) closeMenu();});
    document.addEventListener('keydown',(e)=>{if(e.key==='Escape'&&overlay.classList.contains('open')) closeMenu();});
  }

  function initBottomNav(){
    const current=normalize(window.location.pathname);
    document.querySelectorAll('.mobile-bottom-nav__item[data-nav-path]').forEach((item)=>{
      const target=normalize(item.dataset.navPath||item.getAttribute('href'));
      item.classList.toggle('mobile-bottom-nav__item--active', current===target);
    });
    document.querySelectorAll('.mobile-bottom-menu__item[data-nav-path]').forEach((item)=>{
      const target=normalize(item.dataset.navPath||item.getAttribute('href'));
      item.classList.toggle('mobile-bottom-menu__item--active', current===target);
    });

    const trigger=document.getElementById('bottomMenuTrigger');
    const panel=document.getElementById('bottomMenuPanel');
    const backdrop=document.getElementById('bottomMenuBackdrop');
    if(!trigger||!panel||!backdrop) return;

    const closeBottomMenu=()=>{panel.hidden=true;backdrop.hidden=true;trigger.setAttribute('aria-expanded','false');trigger.classList.remove('mobile-bottom-nav__item--active');};
    const openBottomMenu=()=>{panel.hidden=false;backdrop.hidden=false;trigger.setAttribute('aria-expanded','true');trigger.classList.add('mobile-bottom-nav__item--active');};
    trigger.addEventListener('click',()=>{if(panel.hidden) openBottomMenu(); else closeBottomMenu();});
    backdrop.addEventListener('click',closeBottomMenu);
    panel.addEventListener('click',(event)=>{if(event.target.closest('a.mobile-bottom-menu__item')) closeBottomMenu();});
    document.addEventListener('keydown',(event)=>{if(event.key==='Escape' && !panel.hidden) closeBottomMenu();});
  }

  window.MCPredictPrediction = { csvToRows, extractRowData, renderPredictionCard, renderPredictionTable, sanitize };
  document.addEventListener('DOMContentLoaded',()=>{renderGlobalMenu();initMenu();initBottomNav();});
})();
