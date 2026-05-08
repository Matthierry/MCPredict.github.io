(function(){
  function normalize(path){ return (path||'/').replace(/\/+$|\.html$/g,'') || '/'; }

  function initMenu(){
    const overlay=document.getElementById('menuOverlay');
    const open=document.getElementById('openMenu');
    const close=document.getElementById('closeMenu');
    if(!overlay||!open||!close) return;
    const openMenu=()=>{overlay.classList.add('open');overlay.setAttribute('aria-hidden','false');};
    const closeMenu=()=>{overlay.classList.remove('open');overlay.setAttribute('aria-hidden','true');};
    open.addEventListener('click',openMenu);close.addEventListener('click',closeMenu);
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
    document.querySelectorAll('.menu-links a[href]').forEach((item)=>{
      const target=normalize(item.getAttribute('href'));
      item.classList.toggle('active', current===target);
    });

    const trigger=document.getElementById('bottomMenuTrigger');
    const panel=document.getElementById('bottomMenuPanel');
    const backdrop=document.getElementById('bottomMenuBackdrop');
    if(!trigger||!panel||!backdrop) return;

    const closeBottomMenu=()=>{
      panel.hidden=true;
      backdrop.hidden=true;
      trigger.setAttribute('aria-expanded','false');
      trigger.classList.remove('mobile-bottom-nav__item--active');
    };
    const openBottomMenu=()=>{
      panel.hidden=false;
      backdrop.hidden=false;
      trigger.setAttribute('aria-expanded','true');
      trigger.classList.add('mobile-bottom-nav__item--active');
    };

    trigger.addEventListener('click',()=>{
      if(panel.hidden) openBottomMenu();
      else closeBottomMenu();
    });
    backdrop.addEventListener('click',closeBottomMenu);
    panel.addEventListener('click',(event)=>{
      if(event.target.closest('a.mobile-bottom-menu__item')) closeBottomMenu();
    });
    document.addEventListener('keydown',(event)=>{
      if(event.key==='Escape' && !panel.hidden) closeBottomMenu();
    });
  }

  document.addEventListener('DOMContentLoaded',()=>{initMenu();initBottomNav();});
})();
