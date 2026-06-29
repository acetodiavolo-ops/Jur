/* site.js — shared login gate + top-bar/hamburger nav for the 3-page split. */

'use strict';

    // ── Login gate ──────────────────────────────
    (function(){
      if(sessionStorage.getItem('jur_auth')==='1'){
        var ov=document.getElementById('login-overlay');
        if(ov) ov.hidden=true;
        return;
      }
      var ov=document.getElementById('login-overlay');
      if(!ov) return;
      document.body.style.overflow='hidden';
      document.getElementById('login-form').addEventListener('submit',function(e){
        e.preventDefault();
        var u=document.getElementById('login-user').value.trim();
        var p=document.getElementById('login-pass').value;
        var ok=(
          (typeof LOGIN_USER!=='undefined'&&u===LOGIN_USER&&p===String(LOGIN_PASS))||
          (typeof LOGIN_USER2!=='undefined'&&u===LOGIN_USER2&&p===String(LOGIN_PASS2))||
          (typeof LOGIN_USER3!=='undefined'&&u===LOGIN_USER3&&p===String(LOGIN_PASS3))
        );
        if(ok){
          sessionStorage.setItem('jur_auth','1');
          ov.style.opacity='0';
          setTimeout(function(){ov.hidden=true;document.body.style.overflow='';},260);
        } else {
          document.getElementById('login-error').hidden=false;
          var card=document.getElementById('login-card');
          card.classList.add('login-shake');
          setTimeout(function(){card.classList.remove('login-shake');},360);
        }
      });
    })();

// ── Top-bar nav: active-link highlight + hamburger drawer ──
(function(){
  var here = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  document.querySelectorAll('.site-links a[href], .site-nav-drawer a[href]').forEach(function(a){
    var href = (a.getAttribute('href') || '').toLowerCase();
    if(href === here || ((here === '' ) && href === 'index.html')) a.classList.add('active');
  });
  var btn = document.getElementById('site-nav-toggle');
  var drawer = document.getElementById('site-nav-drawer');
  if(!btn || !drawer) return;
  function set(open){ drawer.hidden = !open; btn.setAttribute('aria-expanded', String(open)); }
  btn.addEventListener('click', function(e){ e.stopPropagation(); set(drawer.hidden); });
  document.addEventListener('click', function(e){
    if(!drawer.hidden && !drawer.contains(e.target) && e.target !== btn) set(false);
  });
  document.addEventListener('keydown', function(e){
    var modal = document.getElementById('opinion-modal');
    if(e.key === 'Escape' && !drawer.hidden && (!modal || modal.hidden)) set(false);
  });
})();
