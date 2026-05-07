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
    document.querySelectorAll('.mobile-bottom-nav__item').forEach((item)=>{
      const target=normalize(item.dataset.navPath||item.getAttribute('href'));
      item.classList.toggle('mobile-bottom-nav__item--active', current===target);
    });
  }
  document.addEventListener('DOMContentLoaded',()=>{initMenu();initBottomNav();});
})();
