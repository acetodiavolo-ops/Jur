'use strict';

// ── Reading progress bar ─────────────────────────
const progressBar = document.getElementById('progress-bar');

function updateProgress() {
  const scrolled = window.scrollY;
  const total = document.documentElement.scrollHeight - window.innerHeight;
  progressBar.style.width = total > 0 ? (scrolled / total * 100) + '%' : '0%';
}
window.addEventListener('scroll', updateProgress, { passive: true });
updateProgress();

// ── TOC: build from headings ──────────────────────
const tocList = document.querySelector('.toc-list');
const content = document.getElementById('content');

if (tocList && content) {
  const headings = content.querySelectorAll('h2, h3, h4');

  headings.forEach((h, i) => {
    if (!h.id) h.id = 'sec-' + i;

    const level = parseInt(h.tagName[1]);
    const li = document.createElement('li');
    li.className = 'toc-item level-' + level;
    li.dataset.target = h.id;

    const a = document.createElement('a');
    a.href = '#' + h.id;
    // Strip leading article number from TOC label for cleanliness
    let label = h.textContent.replace(/^\s*Neni\s+(\d+)\s*/, 'Neni $1 – ').trim();
    if (label.length > 48) label = label.slice(0, 46) + '…';
    a.textContent = label;
    a.title = h.textContent.trim();

    a.addEventListener('click', e => {
      e.preventDefault();
      h.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.replaceState(null, '', '#' + h.id);
    });

    li.appendChild(a);
    tocList.appendChild(li);
  });

  // ── Active section via Intersection Observer ────
  let currentActive = null;

  const io = new IntersectionObserver(entries => {
    // Find the topmost intersecting heading
    const visible = entries
      .filter(e => e.isIntersecting)
      .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

    if (visible.length === 0) return;

    const id = visible[0].target.id;
    const item = tocList.querySelector(`[data-target="${id}"]`);
    if (!item || item === currentActive) return;

    if (currentActive) currentActive.classList.remove('active');
    currentActive = item;
    currentActive.classList.add('active');
    // Scroll TOC so active item stays visible
    currentActive.scrollIntoView({ block: 'nearest' });
  }, {
    rootMargin: '-8% 0px -78% 0px',
    threshold: 0
  });

  headings.forEach(h => io.observe(h));
}

// ── Mobile TOC drawer ─────────────────────────────
(function () {
  var sidebar = document.querySelector('.sidebar');
  var topbarLeft = document.querySelector('.topbar-left');
  if (!sidebar || !topbarLeft) return;

  var btn = document.createElement('button');
  btn.id = '_toc-toggle';
  btn.innerHTML = '§ Tabela';
  btn.setAttribute('aria-label', 'Tabela e Përmbajtjes');
  topbarLeft.appendChild(btn);

  var backdrop = document.createElement('div');
  backdrop.id = '_sidebar-backdrop';
  document.body.appendChild(backdrop);

  function openDrawer()  { sidebar.classList.add('open');    backdrop.classList.add('visible'); }
  function closeDrawer() { sidebar.classList.remove('open'); backdrop.classList.remove('visible'); }

  btn.addEventListener('click', openDrawer);
  backdrop.addEventListener('click', closeDrawer);

  sidebar.querySelectorAll('.toc-item a').forEach(function (a) {
    a.addEventListener('click', closeDrawer);
  });
})();

// ── In-page search ────────────────────────────────
const searchInput  = document.getElementById('search-input');
const searchCount  = document.getElementById('search-count');
const searchClear  = document.getElementById('search-clear');
const searchPrev   = document.getElementById('search-prev');
const searchNext   = document.getElementById('search-next');

let marks = [];
let cursor = -1;

function escRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function clearMarks() {
  // Replace all <mark> nodes with their text content
  marks.forEach(m => {
    if (m.parentNode) {
      m.outerHTML = m.textContent;
    }
  });
  // After innerHTML replacement, collect remaining orphan marks
  content && content.querySelectorAll('mark').forEach(m => {
    m.outerHTML = m.textContent;
  });
  marks = [];
  cursor = -1;
}

function doSearch(query) {
  clearMarks();

  const show = query.length >= 2;
  [searchClear, searchPrev, searchNext].forEach(el => {
    el.classList.toggle('visible', show && query.length > 0);
  });

  if (!show) {
    searchCount.textContent = '';
    return;
  }

  const re = new RegExp(escRe(query), 'gi');
  const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT, {
    acceptNode: node => {
      const tag = node.parentElement && node.parentElement.tagName;
      return (tag === 'SCRIPT' || tag === 'STYLE') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    }
  });

  const nodes = [];
  let n;
  while ((n = walker.nextNode())) nodes.push(n);

  nodes.forEach(node => {
    const txt = node.textContent;
    if (!re.test(txt)) return;
    re.lastIndex = 0;

    const frag = document.createDocumentFragment();
    let last = 0, m;
    while ((m = re.exec(txt)) !== null) {
      if (m.index > last) frag.appendChild(document.createTextNode(txt.slice(last, m.index)));
      const mark = document.createElement('mark');
      mark.textContent = m[0];
      frag.appendChild(mark);
      marks.push(mark);
      last = m.index + m[0].length;
    }
    if (last < txt.length) frag.appendChild(document.createTextNode(txt.slice(last)));
    node.parentNode.replaceChild(frag, node);
  });

  if (marks.length > 0) {
    jumpTo(0);
  } else {
    searchCount.textContent = 'Asnjë rezultat';
  }
}

function jumpTo(index) {
  if (marks.length === 0) return;
  if (cursor >= 0 && cursor < marks.length) marks[cursor].classList.remove('current');
  cursor = ((index % marks.length) + marks.length) % marks.length;
  marks[cursor].classList.add('current');
  marks[cursor].scrollIntoView({ behavior: 'smooth', block: 'center' });
  searchCount.textContent = (cursor + 1) + ' / ' + marks.length + ' rezultate';
}

let debounce;
searchInput && searchInput.addEventListener('input', () => {
  clearTimeout(debounce);
  debounce = setTimeout(() => doSearch(searchInput.value.trim()), 220);
});

searchInput && searchInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); jumpTo(e.shiftKey ? cursor - 1 : cursor + 1); }
  if (e.key === 'Escape') { searchInput.value = ''; clearMarks(); searchCount.textContent = ''; [searchClear, searchPrev, searchNext].forEach(el => el.classList.remove('visible')); }
});

searchNext  && searchNext.addEventListener('click',  () => jumpTo(cursor + 1));
searchPrev  && searchPrev.addEventListener('click',  () => jumpTo(cursor - 1));
searchClear && searchClear.addEventListener('click', () => {
  searchInput.value = '';
  clearMarks();
  searchCount.textContent = '';
  [searchClear, searchPrev, searchNext].forEach(el => el.classList.remove('visible'));
  searchInput.focus();
});

// Keyboard shortcuts: Ctrl+F → search, ? → AI panel
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'f' && searchInput) {
    e.preventDefault();
    searchInput.focus();
    searchInput.select();
  }
  if (e.key === '?' && !e.ctrlKey && !e.metaKey &&
      document.activeElement.tagName !== 'INPUT' &&
      document.activeElement.tagName !== 'TEXTAREA') {
    e.preventDefault();
    _aiPanel.hidden = false;
    _input.focus();
  }
});

// ── GROQ AI assistant ─────────────────────────────
// GROQ_KEY is loaded from config.js (not committed to git)

const _lawTitle = (document.querySelector('.law-header h1') || {}).textContent || document.title;
const _lawRef   = (document.querySelector('.law-ref') || {}).textContent || '';
const _lawText  = content ? content.innerText.slice(0, 3000) : '';

// ── Panel DOM ─────────────────────────────────────
const _aiBtn = document.createElement('button');
_aiBtn.id = '_ai-btn';
_aiBtn.textContent = 'AI';
_aiBtn.title = 'Pyet për këtë ligj';
document.body.appendChild(_aiBtn);

const _aiPanel = document.createElement('div');
_aiPanel.id = '_ai-panel';
_aiPanel.hidden = true;
_aiPanel.innerHTML =
  '<div class="_ai-head"><span>Asistent Ligjor</span><button id="_ai-close">&#215;</button></div>' +
  '<div id="_ai-chips">' +
    '<button class="_chip" data-chip="eli5">ELI5</button>' +
    '<button class="_chip" data-chip="quiz">Kuiz</button>' +
    '<button class="_chip" data-chip="faq">FAQ</button>' +
    '<button class="_chip" data-chip="vocab">Fjalor</button>' +
    '<button class="_chip" data-chip="history">Historia</button>' +
    '<button class="_chip" data-chip="hard">Të vështirat</button>' +
    '<button class="_chip" data-chip="obligimet">Obligimet</button>' +
    '<button class="_chip" data-chip="lidhjet">Lidhjet</button>' +
    '<button class="_chip" data-chip="risk">Rreziku</button>' +
    '<button class="_chip" data-chip="args">Pro/Kundër</button>' +
    '<button class="_chip" data-chip="procedura">Procedura</button>' +
    '<button class="_chip" data-chip="shkelje">Shkelje</button>' +
    '<button class="_chip" data-chip="jurisprudence">Jurisprudencë</button>' +
    '<button class="_chip" data-chip="kushtet">Kushtet</button>' +
    '<button class="_chip" data-chip="ndrysho">Ndryshimet</button>' +
    '<button class="_chip" data-chip="eu">EU Krahasim</button>' +
  '</div>' +
  '<div id="_ai-msgs"></div>' +
  '<div class="_ai-foot"><input id="_ai-input" type="text" placeholder="Shkruaj pyetjen…" autocomplete="off"><button id="_ai-send">&#8594;</button></div>';
document.body.appendChild(_aiPanel);

const _msgs  = document.getElementById('_ai-msgs');
const _input = document.getElementById('_ai-input');
const _send  = document.getElementById('_ai-send');

_aiBtn.addEventListener('click', () => {
  _aiPanel.hidden = !_aiPanel.hidden;
  if (!_aiPanel.hidden) _input.focus();
});
document.getElementById('_ai-close').addEventListener('click', () => { _aiPanel.hidden = true; });

// ── Core helpers ──────────────────────────────────
function _addMsg(text, cls) {
  const d = document.createElement('div');
  d.className = '_ai-msg ' + cls;
  d.appendChild(document.createTextNode(text));

  if (cls.includes('b') && !cls.includes('load')) {
    const cpBtn = document.createElement('button');
    cpBtn.className = '_copy-btn';
    cpBtn.title = 'Kopjo';
    cpBtn.textContent = '⎘';
    cpBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(text).then(() => {
        cpBtn.textContent = '✓';
        setTimeout(() => { cpBtn.textContent = '⎘'; }, 1400);
      }).catch(() => {
        cpBtn.textContent = '✗';
        setTimeout(() => { cpBtn.textContent = '⎘'; }, 1400);
      });
    });
    d.appendChild(cpBtn);
  }

  _msgs.appendChild(d);
  _msgs.scrollTop = _msgs.scrollHeight;
  return d;
}

const _SYS = 'Jeni asistent ligjor i specializuar. Ligji aktual: "' + _lawTitle + '" (' + _lawRef + ').\n\nEkstrakt:\n' + _lawText + '\n\nPërgjigjuni me saktësi. Nëse pyetja është shqip, përgjigjuni shqip. Nëse është anglisht, përgjigjuni anglisht.';

function _ask(overridePrompt) {
  const q = (overridePrompt !== undefined) ? overridePrompt : _input.value.trim();
  if (!q) return;
  if (overridePrompt === undefined) _input.value = '';

  _addMsg(q, 'u');
  const loader = _addMsg('Duke menduar…', 'b load');

  fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + GROQ_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 600,
      messages: [
        { role: 'system', content: _SYS },
        { role: 'user',   content: q }
      ]
    })
  })
  .then(r => r.json())
  .then(data => {
    loader.remove();
    _addMsg((data.choices && data.choices[0] && data.choices[0].message.content) || 'Gabim.', 'b');
  })
  .catch(() => { loader.remove(); _addMsg('Gabim rrjeti.', 'b'); });
}

function _openWithPrompt(prompt) {
  _aiPanel.hidden = false;
  _ask(prompt);
}

_send.addEventListener('click', () => _ask());
_input.addEventListener('keydown', e => { if (e.key === 'Enter') _ask(); });

// ── Quick-action chips ────────────────────────────
const _chipPrompts = {
  eli5:    'Shpjego këtë ligj sikur t\'i flisje dikujt pa arsim juridik. Gjuhë e thjeshtë, shembuj praktikë.',
  quiz:    'Gjenero 5 pyetje me shumë zgjedhje (A/B/C/D) rreth këtij ligji me përgjigjet e sakta.',
  faq:     'Cilat janë 8 pyetjet më të shpeshta rreth këtij ligji? Jep edhe përgjigjet.',
  vocab:   'Listo 10 termat juridikë kryesorë nga ky ligj dhe shpjegoji me fjalë të thjeshta.',
  history: 'Pse u miratua ky ligj? Çfarë problemi zgjidhi historikisht dhe kur hyri në fuqi?',
  hard:       'Cilat janë 5 nenet më të vështira ose më të debatueshme të këtij ligji dhe pse?',
  obligimet:  'Për ligjin "' + _lawTitle + '", listo të gjitha detyrimet ligjore si matricë.\nForma: "• [Kush]: [çfarë] - [kur/si]"\nGrupo sipas subjektit: shteti, individi, biznesi, gjykata. Bëhu konkret dhe i plotë.',
  lidhjet:    'Ligji aktual është "' + _lawTitle + '". Nga ky koleksion ligjesh shqiptare: Kushtetuta, Kodi Civil, Kodi Penal, Kodi i Procedurës Civile, Kodi i Procedurës Penale, Kodi i Familjes, Kodi Rrugor, Kodi Ajror, Kodi Doganor, Kodi i Drejtësisë Penale për të Mitur, Dispozita Zbatuese të Kodit Doganor, Ligji për Shoqëritë Tregtare, Ligji për Falimentimin, Statusi i Gjyqtarëve dhe Prokurorëve, Organizimi i Pushtetit Gjyqësor, Ligji për Noterinë, Shërbimi Përmbarimor Gjyqësor Privat - cilat kanë lidhje me ligjin aktual dhe pse? Listo 3-5 me emër të plotë dhe 1 fjali shpjeguese secili.',
  risk:       'Për ligjin "' + _lawTitle + '", cilat janë 5 dispozitat me sanksionet më të rënda ose detyrimet më strikte? Listoja kështu:\n"Neni X - [veprimi ose detyrimi] - [sanksioni konkret]"\nRenditi nga sanksioni më i rëndë te ai më i lehtë.',
  args:       'Për ligjin "' + _lawTitle + '", gjej 3 çështje juridike kryesore ku palë të ndryshme kanë pozicione kontradiktore. Për secilën:\n"Çështja X: [titulli]\nPRO: [argumentet ligjore që mbrojnë palën e favorshme]\nKUNDËR: [argumentet ligjore të palës tjetër]\nNenet: [lista e neneve konkrete]"',
  procedura:    'Për ligjin "' + _lawTitle + '", shpjego procedurën zyrtare hap pas hapi: kush e inicijon, çfarë afatesh ka, cilat organe janë kompetente, dhe çfarë dokumentesh lëvizen. Bëhu konkret dhe praktik.',
  shkelje:      'Jep 4-5 shembuj konkretë dhe realë të si shkelet ligji "' + _lawTitle + '" në praktikë. Për secilin: situata, kush shkel, pasoja ligjore (gjobë / burg / pezullim).',
  jurisprudence:'Si e kanë interpretuar gjykatat shqiptare dhe GJEDNJ-ja ligjin "' + _lawTitle + '"? Trego parimet kryesore jurisprudenciale, mënyrën e zbatimit praktik, dhe debatet kryesore ligjore.',
  kushtet:  'Për ligjin "' + _lawTitle + '", cilat janë kushtet e detyrueshme (elementët paraprakë) që duhet të ekzistojnë që ky ligj të zbatohet? Listo si matricë: "• Kushti X: [çfarë duhet të jetë e vërtetë]". Përqendrohu vetëm te parakushtet - jo te pasojat.',
  ndrysho:  'Çfarë ndryshimesh dhe amendamentesh janë bërë ligjit "' + _lawTitle + '" pas miratimit origjinal? Trego çfarë u ndryshua, kur (nëse dihet), dhe pse. Nëse nuk ke të dhëna specifike, trego tendencën e reformave ligjore shqiptare në këtë fushë.',
  eu:       'Krahaso ligjin "' + _lawTitle + '" me standardet dhe direktivat e BE-së në të njëjtën fushë. Trego: çfarë kërkon BE-ja, çfarë parashikon ligji shqiptar, ku janë boshllëqet kryesore, dhe çfarë reformash nevojiten për afrimin europian.'
};

document.getElementById('_ai-chips').addEventListener('click', e => {
  const btn = e.target.closest('._chip');
  if (!btn || !_chipPrompts[btn.dataset.chip]) return;
  _openWithPrompt(_chipPrompts[btn.dataset.chip]);
});

// ── Per-article & chapter AI buttons ─────────────
function _getArticleText(h4) {
  let text = '';
  h4.childNodes.forEach(node => {
    if (!node.classList || !node.classList.contains('art-ai-trigger')) {
      text += node.textContent;
    }
  });
  let sib = h4.nextElementSibling;
  while (sib && !['H2', 'H3', 'H4'].includes(sib.tagName)) {
    if (!sib.classList.contains('art-ai-menu')) text += ' ' + sib.textContent;
    sib = sib.nextElementSibling;
  }
  return text.trim().slice(0, 480);
}

function _getChapterText(heading, maxChars) {
  const level = parseInt(heading.tagName[1]);
  let text = heading.textContent.trim() + '\n';
  let sib = heading.nextElementSibling;
  while (sib && text.length < maxChars) {
    const sibLvl = parseInt(sib.tagName[1]);
    if (!isNaN(sibLvl) && sibLvl <= level) break;
    if (!sib.classList.contains('ch-ai-btn') && !sib.classList.contains('art-ai-menu')) {
      text += sib.textContent + ' ';
    }
    sib = sib.nextElementSibling;
  }
  return text.slice(0, maxChars);
}

if (content) {
  content.querySelectorAll('h2, h3, h4').forEach(h => {
    if (h.tagName === 'H4') {
      // Trigger button inside h4
      const trigger = document.createElement('button');
      trigger.className = 'art-ai-trigger';
      trigger.title = 'Veprime AI';
      trigger.textContent = '···';
      h.appendChild(trigger);

      // Action menu after h4
      const menu = document.createElement('div');
      menu.className = 'art-ai-menu';
      menu.hidden = true;

      [
        { label: 'Shpjego',  fn: t => 'Shpjego në gjuhë të thjeshtë këtë nen: "' + t + '"' },
        { label: 'Shembull', fn: t => 'Jep një shembull praktik ku zbatohet ky nen: "' + t + '"' },
        { label: 'Lista',    fn: t => 'Kthe këtë nen në listë kontrolli hap-pas-hapi: "' + t + '"' },
        { label: 'Anglisht', fn: t => 'Translate this article to English: "' + t + '"' },
        { label: 'Citatë',   fn: t => 'Format as Albanian legal citation - ' + _lawTitle + ', ' + _lawRef + '. Text: "' + t.slice(0, 120) + '"' },
        { label: 'Detyrime', fn: t => 'Çfarë detyrimesh ligjore krijon ky nen dhe për cilat subjekte: "' + t + '"' },
        { label: 'Afate',    fn: t => 'Cilat afate kohore ose afate parashkrimi përcakton ky nen: "' + t + '"' },
        { label: 'Klauzolë', fn: t => 'Shkruaj një klauzolë kontraktuale profesionale shqipe që zbaton kërkesat e këtij neni: "' + t + '". Klauzola të jetë e plotë, juridikisht e saktë dhe e gatshme për t\'u përdorur.' }
      ].forEach(({ label, fn }) => {
        const btn = document.createElement('button');
        btn.textContent = label;
        btn.addEventListener('click', () => {
          menu.hidden = true;
          _openWithPrompt(fn(_getArticleText(h)));
        });
        menu.appendChild(btn);
      });

      h.after(menu);

      trigger.addEventListener('click', e => {
        e.stopPropagation();
        content.querySelectorAll('.art-ai-menu:not([hidden])').forEach(m => { if (m !== menu) m.hidden = true; });
        menu.hidden = !menu.hidden;
      });

    } else {
      // Chapter summary button after h2/h3
      const chBtn = document.createElement('button');
      chBtn.className = 'ch-ai-btn';
      chBtn.textContent = 'Përmbledhje AI →';
      h.after(chBtn);

      chBtn.addEventListener('click', () => {
        _openWithPrompt('Bëj një përmbledhje të shkurtër (3-4 fjali) të kreut "' + h.textContent.trim() + '": ' + _getChapterText(h, 1800));
      });
    }
  });

  document.addEventListener('click', () => {
    content.querySelectorAll('.art-ai-menu:not([hidden])').forEach(m => { m.hidden = true; });
  });
}

// ── Selection toolbar ─────────────────────────────
const _selToolbar = document.createElement('div');
_selToolbar.id = '_sel-toolbar';
_selToolbar.hidden = true;
_selToolbar.innerHTML =
  '<button data-sel="explain">Shpjego</button>' +
  '<button data-sel="translate">Anglisht</button>' +
  '<button data-sel="define">Përkufizo</button>';
document.body.appendChild(_selToolbar);

document.addEventListener('mouseup', e => {
  if (_selToolbar.contains(e.target)) return;
  if (!content || !content.contains(e.target)) { _selToolbar.hidden = true; return; }

  setTimeout(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) { _selToolbar.hidden = true; return; }
    const text = sel.toString().trim();
    if (!text || text.length < 3) { _selToolbar.hidden = true; return; }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    _selToolbar.style.left = (rect.left + window.scrollX + rect.width / 2) + 'px';
    _selToolbar.style.top  = (rect.top  + window.scrollY - 46) + 'px';
    _selToolbar.hidden = false;
    _selToolbar.dataset.seltext = text;
  }, 10);
});

_selToolbar.addEventListener('click', e => {
  const btn = e.target.closest('[data-sel]');
  if (!btn) return;
  const text = _selToolbar.dataset.seltext || '';
  _selToolbar.hidden = true;
  window.getSelection().removeAllRanges();
  const prompts = {
    explain:   'Shpjego kuptimin ligjor të kësaj fjalie në kontekstin e ligjit shqiptar: "' + text + '"',
    translate: 'Translate this legal text to English: "' + text + '"',
    define:    'Përkufizo këtë term ose koncept juridik në kontekstin e legjislacionit shqiptar: "' + text + '"'
  };
  _openWithPrompt(prompts[btn.dataset.sel]);
});

window.addEventListener('scroll', () => { _selToolbar.hidden = true; }, { passive: true });

// ── Plain-language toggle ─────────────────────────
if (content) {
  const _plBtn = document.createElement('button');
  _plBtn.className = 'plain-lang-btn';
  _plBtn.textContent = 'Thjesht ↕';
  _plBtn.title = 'Rishkruaj me gjuhë të thjeshtë';

  const _lawHeaderEl = document.querySelector('.law-header');
  if (_lawHeaderEl) _lawHeaderEl.appendChild(_plBtn);

  let _plOverlay = null;
  let _plMode    = false;
  let _plLoading = false;
  let _plCache   = null;

  function _showPlain(text) {
    if (!_plOverlay) {
      _plOverlay = document.createElement('div');
      _plOverlay.id = '_pl-overlay';
      content.parentNode.insertBefore(_plOverlay, content);
    }
    const notice = '<div class="ai-rewrite-notice">Tekst i thjeshtuar nga AI. Jo tekst zyrtar ligjor.</div>';
    const body = text.split('\n').filter(l => l.trim()).map(l => {
      const safe = l.trim().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      return '<p>' + safe + '</p>';
    }).join('\n');
    _plOverlay.innerHTML = notice + body;
    _plOverlay.hidden = false;
    content.hidden = true;
    _plMode = true;
    _plBtn.textContent = 'Origjinal ↕';
  }

  function _showOriginal() {
    if (_plOverlay) _plOverlay.hidden = true;
    content.hidden = false;
    _plMode = false;
    _plBtn.textContent = 'Thjesht ↕';
  }

  _plBtn.addEventListener('click', () => {
    if (_plLoading) return;
    if (_plMode) { _showOriginal(); return; }
    if (_plCache) { _showPlain(_plCache); return; }

    const lawText = content.innerText.slice(0, 2800);
    _plLoading = true;
    _plBtn.textContent = 'Duke rishkruar…';
    _plBtn.disabled = true;

    fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + GROQ_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 1500,
        messages: [
          { role: 'system', content: 'Rishkruaj tekstin ligjor me gjuhë të thjeshtë shqipe. Ruaj numrat e neneve (Neni 1, Neni 2, etj.). Kthe vetëm tekstin e rishkruar, pa komente shtesë.' },
          { role: 'user',   content: lawText }
        ]
      })
    })
    .then(r => r.json())
    .then(data => {
      const text = (data.choices && data.choices[0] && data.choices[0].message.content) || '';
      if (text) { _plCache = text; _showPlain(text); }
    })
    .catch(() => {})
    .finally(() => {
      _plLoading = false;
      _plBtn.disabled = false;
      if (!_plMode) _plBtn.textContent = 'Thjesht ↕';
    });
  });
}

// ── Situation Checker ─────────────────────────────
const _sitLawHeader = document.querySelector('.law-header');
if (_sitLawHeader && content) {
  const _sitForm = document.createElement('div');
  _sitForm.className = 'situation-form';
  _sitForm.innerHTML =
    '<span class="situation-label">Kontrollo situatën tënde</span>' +
    '<div class="situation-input-row">' +
      '<input class="situation-input" type="text" placeholder="p.sh. Punëdhënësi nuk më ka paguar 3 muaj…" autocomplete="off">' +
      '<button class="situation-btn">Gjej nenet →</button>' +
    '</div>' +
    '<div class="situation-result" hidden></div>';

  _sitLawHeader.after(_sitForm);

  const _sitInput  = _sitForm.querySelector('.situation-input');
  const _sitBtn    = _sitForm.querySelector('.situation-btn');
  const _sitResult = _sitForm.querySelector('.situation-result');

  function _runSituation() {
    const q = _sitInput.value.trim();
    if (!q) return;
    _sitBtn.disabled = true;
    _sitBtn.textContent = 'Duke kërkuar…';
    _sitResult.hidden = false;
    _sitResult.textContent = 'Duke analizuar situatën…';

    fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + GROQ_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 500,
        messages: [
          { role: 'system', content: 'Jeni asistent ligjor. Ligji: "' + _lawTitle + '". Tekst: ' + content.innerText.slice(0, 4000) },
          { role: 'user',   content: 'Bazuar në këtë ligj, cilat nene zbatohen për këtë situatë: "' + q + '"? Listo nenet konkrete (Neni X, Neni Y) dhe shpjego shkurt çfarë thotë secili.' }
        ]
      })
    })
    .then(r => r.json())
    .then(data => {
      _sitResult.textContent = (data.choices && data.choices[0] && data.choices[0].message.content) || 'Nuk u gjet asgjë.';
    })
    .catch(() => { _sitResult.textContent = 'Gabim rrjeti.'; })
    .finally(() => { _sitBtn.disabled = false; _sitBtn.textContent = 'Gjej nenet →'; });
  }

  _sitBtn.addEventListener('click', _runSituation);
  _sitInput.addEventListener('keydown', e => { if (e.key === 'Enter') _runSituation(); });
}

// ── Legal Memo Generator ──────────────────────────
const _memoLawHeader = document.querySelector('.law-header');
if (_memoLawHeader) {
  const _memoBtn = document.createElement('button');
  _memoBtn.className = 'memo-btn';
  _memoBtn.textContent = 'Memo';
  _memoBtn.title = 'Gjenero memorandum ligjor';
  _memoLawHeader.appendChild(_memoBtn);

  const _memoModal = document.createElement('div');
  _memoModal.id = '_memo-modal';
  _memoModal.hidden = true;
  _memoModal.innerHTML =
    '<div class="_memo-inner">' +
      '<div class="print-cover" aria-hidden="true"><div class="pc-emblem">&#9878;</div><h1 class="pc-title">programi i Henri Sila</h1><div class="pc-rule"></div><p class="pc-sub">Jurist</p><div class="pc-foot">Legjislacioni Shqiptar</div></div>' +
      '<div class="_memo-head">' +
        '<span class="_memo-title">Memorandum Ligjor: ' + _lawTitle + '</span>' +
        '<div class="_memo-actions">' +
          '<button id="_memo-print">Printo</button>' +
          '<button id="_memo-close">&#215; Mbyll</button>' +
        '</div>' +
      '</div>' +
      '<div id="_memo-body">Duke gjeneruar…</div>' +
    '</div>';
  document.body.appendChild(_memoModal);

  document.getElementById('_memo-print').addEventListener('click', () => window.print());
  document.getElementById('_memo-close').addEventListener('click', () => { _memoModal.hidden = true; });

  _memoBtn.addEventListener('click', () => {
    _memoModal.hidden = false;
    const body = document.getElementById('_memo-body');
    body.textContent = 'Duke gjeneruar memorandumin…';

    fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + GROQ_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 900,
        messages: [
          { role: 'system', content: 'Shkruaj memorandume ligjore profesionale në gjuhën shqipe.' },
          { role: 'user',   content: 'Shkruaj një memorandum ligjor 1-faqësh për ligjin "' + _lawTitle + '" (' + _lawRef + ').\n\nStruktura:\n1. Qëllimi dhe objektivat e ligjit\n2. Fushat kryesore të rregullimit\n3. Detyrimet kryesore\n4. Sanksionet dhe masat\n5. Vërejtje praktike\n\nTeksti i ligjit:\n' + (content ? content.innerText.slice(0, 5000) : '') }
        ]
      })
    })
    .then(r => r.json())
    .then(data => { body.textContent = (data.choices && data.choices[0] && data.choices[0].message.content) || 'Gabim.'; })
    .catch(() => { body.textContent = 'Gabim rrjeti.'; });
  });
}

// ── AI Reading Recap Toast ────────────────────────
if (content && !sessionStorage.getItem('_recap')) {
  const _toast = document.createElement('div');
  _toast.id = '_ai-toast';
  _toast.hidden = true;
  _toast.innerHTML =
    '<span>Ke lexuar gjysmën. Dëshiron një përmbledhje?</span>' +
    '<button id="_toast-yes">Po →</button>' +
    '<button id="_toast-no">&#215;</button>';
  document.body.appendChild(_toast);

  let _toastFired = false;
  const _recapScroll = () => {
    if (_toastFired) return;
    const pct = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight;
    if (pct >= 0.52) {
      _toastFired = true;
      _toast.hidden = false;
      sessionStorage.setItem('_recap', '1');
      window.removeEventListener('scroll', _recapScroll);
    }
  };
  window.addEventListener('scroll', _recapScroll, { passive: true });

  document.getElementById('_toast-yes').addEventListener('click', () => {
    _toast.hidden = true;
    _openWithPrompt('Bëj një përmbledhje të shkurtër (4 fjali) të asaj që kam lexuar deri tani nga ligji "' + _lawTitle + '": ' + content.innerText.slice(0, 2000));
  });
  document.getElementById('_toast-no').addEventListener('click', () => { _toast.hidden = true; });
}

// ── All-Law Deadline Table ────────────────────────
const _afateLh = document.querySelector('.law-header');
if (_afateLh && content) {
  const _afateBtn = document.createElement('button');
  _afateBtn.className = 'hdr-action-btn';
  _afateBtn.textContent = 'Afate';
  _afateBtn.title = 'Të gjitha afatet kohore të ligjit';
  _afateLh.appendChild(_afateBtn);

  const _afatePanel = document.createElement('div');
  _afatePanel.id = '_afate-panel';
  _afatePanel.hidden = true;
  _afatePanel.innerHTML =
    '<div class="_afate-head">' +
      '<span>Afatet Kohore: ' + _lawTitle + '</span>' +
      '<button id="_afate-close">&#215; Mbyll</button>' +
    '</div>' +
    '<pre id="_afate-body">Duke analizuar…</pre>';
  _afateLh.insertAdjacentElement('afterend', _afatePanel);

  document.getElementById('_afate-close').addEventListener('click', () => { _afatePanel.hidden = true; });

  let _afateCached = null;
  _afateBtn.addEventListener('click', () => {
    _afatePanel.hidden = false;
    if (_afateCached) { document.getElementById('_afate-body').textContent = _afateCached; return; }
    const body = document.getElementById('_afate-body');
    body.textContent = 'Duke analizuar ligjin për afate…';

    fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + GROQ_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 700,
        messages: [
          { role: 'system', content: 'Jepni lista të strukturuara afatesh ligjore në shqip.' },
          { role: 'user',   content: 'Ekstrakt nga teksti i ligjit "' + _lawTitle + '" të gjitha afatet kohore, afatet e parashkrimit dhe detyrimet me afat specifik.\nFormato si listë: "Neni X - [kush] - [çfarë] - [sa kohë]".\nNëse nuk ka afate, thuaj: "Nuk ka afate të përcaktuara."\n\nTeksti:\n' + content.innerText.slice(0, 6000) }
        ]
      })
    })
    .then(r => r.json())
    .then(data => {
      _afateCached = (data.choices && data.choices[0] && data.choices[0].message.content) || 'Gabim.';
      body.textContent = _afateCached;
    })
    .catch(() => { body.textContent = 'Gabim rrjeti.'; });
  });
}

// ── Smart TOC Annotation ─────────────────────────
const _tocLabelEl = document.querySelector('.toc-label');
const _tocListEl  = document.querySelector('.toc-list');
if (_tocLabelEl && _tocListEl) {
  const _tocAnnBtn = document.createElement('button');
  _tocAnnBtn.className = 'toc-annotate-btn';
  _tocAnnBtn.textContent = 'Shëno';
  _tocLabelEl.appendChild(_tocAnnBtn);

  _tocAnnBtn.addEventListener('click', () => {
    _tocAnnBtn.textContent = '…';
    _tocAnnBtn.disabled = true;

    const items  = Array.from(_tocListEl.querySelectorAll('.toc-item.level-2, .toc-item.level-3'));
    const labels = items.map(li => { const a = li.querySelector('a'); return a ? a.textContent.trim() : ''; }).filter(Boolean);

    if (!labels.length) { _tocAnnBtn.remove(); return; }

    fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + GROQ_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 600,
        messages: [
          { role: 'system', content: 'Jepni përshkrime të shkurtra seksionesh ligjore.' },
          { role: 'user',   content: 'Për secilin kreu/seksion të ligjit "' + _lawTitle + '", shkruaj 1 fjali (max 10 fjalë).\nFormato: "TITULLI EKZAKT|përshkrimi" - një rresht për titull:\n\n' + labels.join('\n') }
        ]
      })
    })
    .then(r => r.json())
    .then(data => {
      const raw = (data.choices && data.choices[0] && data.choices[0].message.content) || '';
      const map = Object.create(null);
      raw.split('\n').forEach(line => {
        const idx = line.indexOf('|');
        if (idx > -1) { const k = line.slice(0, idx).trim(); const v = line.slice(idx + 1).trim(); if (k && v) map[k] = v; }
      });
      items.forEach(li => {
        const a = li.querySelector('a');
        if (!a) return;
        const ann = map[a.textContent.trim()];
        if (ann) { const s = document.createElement('small'); s.className = 'toc-ann'; s.textContent = ann; li.appendChild(s); }
      });
      _tocAnnBtn.disabled = true; _tocAnnBtn.textContent = '✓ Shënuar';
    })
    .catch(() => { _tocAnnBtn.textContent = 'Shëno'; _tocAnnBtn.disabled = false; });
  });
}

// ── Bookmark + AI Note ───────────────────────────
function _escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const _BM_KEY = 'jur_bookmarks';
function _getBM() { try { return JSON.parse(localStorage.getItem(_BM_KEY) || '[]'); } catch (e) { return []; } }
function _saveBM(arr) { localStorage.setItem(_BM_KEY, JSON.stringify(arr)); }

const _bmLh = document.querySelector('.law-header');
if (_bmLh) {
  const _bmShowBtn = document.createElement('button');
  _bmShowBtn.className = 'hdr-action-btn';
  _bmShowBtn.id = '_bm-show';
  _bmShowBtn.textContent = 'Shënime';
  _bmShowBtn.title = 'Shiko shënimet e ruajtura';
  _bmLh.appendChild(_bmShowBtn);

  const _bmModal = document.createElement('div');
  _bmModal.id = '_bm-modal';
  _bmModal.hidden = true;
  _bmModal.innerHTML =
    '<div class="_bm-inner">' +
      '<div class="_bm-head">' +
        '<span>Shënimet e Ruajtura</span>' +
        '<button id="_bm-close">&#215; Mbyll</button>' +
      '</div>' +
      '<div id="_bm-list"></div>' +
    '</div>';
  document.body.appendChild(_bmModal);

  document.getElementById('_bm-close').addEventListener('click', () => { _bmModal.hidden = true; });

  function _renderBmList() {
    const list = document.getElementById('_bm-list');
    const bms  = _getBM();
    if (!bms.length) { list.innerHTML = '<p style="padding:20px;color:#999;font-size:0.85rem;">Nuk keni shënime të ruajtura.</p>'; return; }
    list.innerHTML = bms.map((b, i) =>
      '<div class="_bm-entry">' +
        '<div class="_bm-et"><a href="' + _escHtml(b.file || '#') + '#' + _escHtml(b.articleId || '') + '">' + _escHtml(b.lawTitle) + '</a> · <span>' + _escHtml((b.articleId || '').replace(/-/g, ' ')) + '</span></div>' +
        (b.annotation ? '<div class="_bm-en">' + _escHtml(b.annotation) + '</div>' : '') +
        '<button class="_bm-del" data-idx="' + i + '">&#215; Hiq</button>' +
      '</div>'
    ).join('');
    list.querySelectorAll('._bm-del').forEach(btn => {
      btn.addEventListener('click', () => { const arr = _getBM(); arr.splice(+btn.dataset.idx, 1); _saveBM(arr); _renderBmList(); });
    });
  }
  _bmShowBtn.addEventListener('click', () => { _bmModal.hidden = false; _renderBmList(); });
}

if (content) {
  const _bmFile = location.pathname.split('/').pop() || document.title;
  content.querySelectorAll('h4').forEach(h => {
    const artNum = h.querySelector('.art-num');
    if (!artNum) return;
    const articleId = artNum.textContent.trim().replace(/\s+/g, '-').toLowerCase();

    const bmBtn = document.createElement('button');
    bmBtn.className = 'bm-btn';
    bmBtn.title = 'Shëno / hiq shënimin';
    bmBtn.textContent = '🔖';
    h.appendChild(bmBtn);

    const existing = _getBM().find(b => b.articleId === articleId && b.file === _bmFile);
    if (existing) {
      bmBtn.classList.add('bm-active');
      if (existing.annotation) {
        const note = document.createElement('small');
        note.className = 'bm-note';
        note.textContent = existing.annotation;
        h.insertAdjacentElement('afterend', note);
      }
    }

    bmBtn.addEventListener('click', () => {
      const arr = _getBM();
      const idx = arr.findIndex(b => b.articleId === articleId && b.file === _bmFile);
      if (idx > -1) {
        arr.splice(idx, 1);
        _saveBM(arr);
        bmBtn.classList.remove('bm-active');
        const note = h.nextElementSibling;
        if (note && note.classList.contains('bm-note')) note.remove();
      } else {
        const articleText = artNum.textContent.trim().slice(0, 120);
        arr.push({ lawTitle: _lawTitle, file: _bmFile, articleId, articleText, annotation: '' });
        _saveBM(arr);
        bmBtn.classList.add('bm-active');
        fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + GROQ_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            max_tokens: 50,
            messages: [
              { role: 'system', content: 'Jep shpjegime shumë të shkurtra ligjore.' },
              { role: 'user',   content: 'Pse është i rëndësishëm ky nen juridikisht (1 fjali, max 12 fjalë)? Neni: "' + articleText + '" nga "' + _lawTitle + '".' }
            ]
          })
        })
        .then(r => r.json())
        .then(data => {
          const ann = (data.choices && data.choices[0] && data.choices[0].message.content) || '';
          const arr2 = _getBM();
          const idx2 = arr2.findIndex(b => b.articleId === articleId && b.file === _bmFile);
          if (idx2 > -1) { arr2[idx2].annotation = ann; _saveBM(arr2); }
          if (ann) {
            const note = document.createElement('small');
            note.className = 'bm-note';
            note.textContent = ann;
            h.insertAdjacentElement('afterend', note);
          }
        })
        .catch(() => {});
      }
    });
  });
}

// ── Cross-Law Q&A ─────────────────────────────
const _LAW_LIST = [
  ['Kushtetuta e Republikës së Shqipërisë',          'kushtetuta.html'],
  ['Kodi Civil',                                      'kodi-civil.html'],
  ['Kodi Penal',                                      'kodi-penal.html'],
  ['Kodi i Procedurës Civile',                        'kodi-procedure-civile.html'],
  ['Kodi i Procedurës Penale',                        'kodi-procedure-penale.html'],
  ['Kodi i Familjes',                                 'kodi-familjes.html'],
  ['Kodi Rrugor',                                     'kodi-rrugor.html'],
  ['Kodi Ajror',                                      'kodi-ajror.html'],
  ['Kodi Doganor',                                    'kodi-doganor.html'],
  ['Kodi i Drejtësisë Penale për të Mitur',           'drejtesia-penale-mitur.html'],
  ['Dispozita Zbatuese të Kodit Doganor',             'dispozita-zbatuese-kodi-doganor.html'],
  ['Ligj për Tregtarët dhe Shoqëritë Tregtare',       'shoqerite-tregtare.html'],
  ['Ligj për Falimentimin',                           'falimentimi.html'],
  ['Statusi i Gjyqtarëve dhe Prokurorëve',            'statusi-gjyqtareve-prokuroreve.html'],
  ['Organizimi i Pushtetit Gjyqësor',                 'organizimi-pushtetit-gjyqesor.html'],
  ['Organizimi i Pushtetit Gjyqësor (i përditësuar)', 'organizimi-pushtetit-gjyqesor-v2.html'],
  ['Ligj për Noterinë',                               'noteria.html'],
  ['Shërbimi Përmbarimor Gjyqësor Privat',            'sherbimi-permbarimor.html'],
];

const _xlLh = document.querySelector('.law-header');
if (_xlLh && content) {
  const _xlBtn = document.createElement('button');
  _xlBtn.className = 'hdr-action-btn';
  _xlBtn.textContent = 'Krahaso';
  _xlBtn.title = 'Krahaso me një ligj tjetër';
  _xlLh.appendChild(_xlBtn);

  const _xlPanel = document.createElement('div');
  _xlPanel.id = '_xl-panel';
  _xlPanel.hidden = true;

  const _xlCurrentFile = location.pathname.split('/').pop() || '';
  const _xlOpts = _LAW_LIST
    .filter(([, f]) => f !== _xlCurrentFile)
    .map(([label]) => '<option value="' + label + '">' + label + '</option>')
    .join('');

  _xlPanel.innerHTML =
    '<div class="_xl-head">' +
      '<span>Krahaso me ligj tjetër · ' + _lawTitle + '</span>' +
      '<button id="_xl-close">&#215; Mbyll</button>' +
    '</div>' +
    '<div class="_xl-form">' +
      '<select id="_xl-law"><option value="">Zgjidhni ligjin tjetër…</option>' + _xlOpts + '</select>' +
      '<textarea id="_xl-q" placeholder="Çfarë doni të krahasoni? (opsionale)"></textarea>' +
      '<button id="_xl-go">Pyet &#8594;</button>' +
    '</div>' +
    '<pre id="_xl-body"></pre>';

  _xlLh.insertAdjacentElement('afterend', _xlPanel);

  document.getElementById('_xl-close').addEventListener('click', () => { _xlPanel.hidden = true; });
  _xlBtn.addEventListener('click', () => { _xlPanel.hidden = false; });

  document.getElementById('_xl-go').addEventListener('click', () => {
    const law2  = document.getElementById('_xl-law').value;
    if (!law2) return;
    const q     = document.getElementById('_xl-q').value.trim();
    const body  = document.getElementById('_xl-body');
    const goBtn = document.getElementById('_xl-go');
    body.textContent = 'Duke analizuar…';
    goBtn.disabled = true;

    const prompt = q
      ? 'Ligji i parë: "' + _lawTitle + '". Ligji i dytë: "' + law2 + '".\nPyetja: ' + q + '\nShpjego si ndërveprojnë këto dy ligje. Cito nene konkrete nga të dyja. Trego mbivendosjet, dallimet dhe rendin e zbatimit.'
      : 'Krahaso ligjin "' + _lawTitle + '" me ligjin "' + law2 + '". Trego: fushat e rregullimit, mbivendosjet, kur zbatohet secili dhe çfarë dallon ndërmjet tyre. Cito nene konkrete.';

    fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + GROQ_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 600,
        messages: [
          { role: 'system', content: 'Jeni ekspert i legjislacionit shqiptar. Krahasoni ligje me saktësi dhe citoni nene konkrete.' },
          { role: 'user',   content: prompt }
        ]
      })
    })
    .then(r => r.json())
    .then(data => { body.textContent = (data.choices && data.choices[0] && data.choices[0].message.content) || 'Gabim.'; })
    .catch(() => { body.textContent = 'Gabim rrjeti.'; })
    .finally(() => { goBtn.disabled = false; });
  });
}

// ── Personal Highlights & Notes ───────────────
(function () {
  var _HL_KEY  = 'jur_highlights';
  var _hlFile  = location.pathname.split('/').pop() || document.title;
  var _hlPanel = null;

  function _hlLoad() {
    try { return JSON.parse(localStorage.getItem(_HL_KEY) || '[]'); } catch (e) { return []; }
  }
  function _hlSave(hls) {
    try { localStorage.setItem(_HL_KEY, JSON.stringify(hls)); } catch (e) {}
  }

  // ── Restore highlights on page load ───────────
  function _hlFindAndWrap(root, h) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var node;
    while ((node = walker.nextNode())) {
      var idx = node.textContent.indexOf(h.text);
      if (idx === -1) continue;
      var mark = document.createElement('mark');
      mark.className = 'user-hl';
      mark.dataset.hlId = h.id;
      mark.title = h.note || '';
      mark.textContent = h.text;
      var after = node.splitText(idx);
      after.textContent = after.textContent.slice(h.text.length);
      node.parentNode.insertBefore(mark, after);
      return true;
    }
    return false;
  }

  function _hlRestore() {
    var content = document.getElementById('content');
    if (!content) return;
    var hls = _hlLoad().filter(function (h) { return h.file === _hlFile; });
    hls.forEach(function (h) { _hlFindAndWrap(content, h); });
  }
  _hlRestore();

  // ── Add highlight button to selection toolbar ─
  var _selTb = document.getElementById('_sel-toolbar');
  if (_selTb) {
    var _hlSelBtn = document.createElement('button');
    _hlSelBtn.id    = '_hl-sel-btn';
    _hlSelBtn.title = 'Thekso tekstin';
    _hlSelBtn.textContent = '📌';
    _selTb.appendChild(_hlSelBtn);

    _hlSelBtn.addEventListener('mousedown', function (e) {
      e.preventDefault();
      var sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      var text = sel.toString().trim().slice(0, 500);
      if (!text) return;

      var note = window.prompt('Shënim opsional (lëre bosh nëse nuk dëshiron):', '') || '';
      var id   = Date.now() + '_' + Math.random().toString(36).slice(2, 7);

      var range = sel.getRangeAt(0);
      var mark  = document.createElement('mark');
      mark.className  = 'user-hl';
      mark.dataset.hlId = id;
      mark.title = note;

      try {
        range.surroundContents(mark);
      } catch (ex) {
        var frag = range.extractContents();
        mark.appendChild(frag);
        range.insertNode(mark);
      }
      sel.removeAllRanges();

      var hls = _hlLoad();
      hls.push({ id: id, file: _hlFile, text: text, note: note, timestamp: new Date().toISOString() });
      _hlSave(hls);

      _selTb.hidden = true;
    });
  }

  // ── Highlights panel ──────────────────────────
  var _lh = document.querySelector('.law-header');
  if (!_lh) return;

  var _hlBtn = document.createElement('button');
  _hlBtn.className   = 'hdr-action-btn';
  _hlBtn.textContent = 'Theksime';
  _lh.appendChild(_hlBtn);

  function _buildPanel() {
    _hlPanel = document.createElement('div');
    _hlPanel.id = '_hl-panel';
    _hlPanel.hidden = true;

    var head = document.createElement('div');
    head.className = '_hl-head';
    head.innerHTML = '<span>Theksime të ruajtura</span>';

    var closeBtn = document.createElement('button');
    closeBtn.id = '_hl-close';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', function () { _hlPanel.hidden = true; });
    head.appendChild(closeBtn);

    var list = document.createElement('div');
    list.id = '_hl-list';

    _hlPanel.appendChild(head);
    _hlPanel.appendChild(list);
    _lh.insertAdjacentElement('afterend', _hlPanel);
  }
  _buildPanel();

  function _renderHlList() {
    var list = document.getElementById('_hl-list');
    list.innerHTML = '';
    var hls = _hlLoad().filter(function (h) { return h.file === _hlFile; });

    if (hls.length === 0) {
      list.innerHTML = '<p style="font-size:0.83rem;color:var(--muted);padding:12px 0">Nuk ka theksime të ruajtura.</p>';
      return;
    }

    hls.forEach(function (h) {
      var item = document.createElement('div');
      item.className = '_hl-item';

      var body = document.createElement('div');
      body.className = '_hl-body';

      var textEl = document.createElement('div');
      textEl.className = '_hl-text';
      textEl.textContent = h.text.length > 80 ? h.text.slice(0, 80) + '…' : h.text;

      body.appendChild(textEl);

      if (h.note) {
        var noteEl = document.createElement('div');
        noteEl.className = '_hl-note';
        noteEl.textContent = h.note;
        body.appendChild(noteEl);
      }

      var delBtn = document.createElement('button');
      delBtn.className = '_hl-del';
      delBtn.textContent = '✕';
      delBtn.addEventListener('click', function () {
        var all = _hlLoad().filter(function (x) { return x.id !== h.id; });
        _hlSave(all);
        var markEl = document.querySelector('mark.user-hl[data-hl-id="' + h.id + '"]');
        if (markEl) {
          var parent = markEl.parentNode;
          while (markEl.firstChild) parent.insertBefore(markEl.firstChild, markEl);
          parent.removeChild(markEl);
          parent.normalize();
        }
        _renderHlList();
      });

      item.appendChild(body);
      item.appendChild(delBtn);
      list.appendChild(item);
    });
  }

  _hlBtn.addEventListener('click', function () {
    _hlPanel.hidden = !_hlPanel.hidden;
    if (!_hlPanel.hidden) _renderHlList();
  });
}());

// ── Draft Complaint / Petition ────────────────
const _compLh = document.querySelector('.law-header');
if (_compLh) {
  const _compBtn = document.createElement('button');
  _compBtn.className = 'hdr-action-btn';
  _compBtn.textContent = 'Ankesë';
  _compBtn.title = 'Gjenero ankesë ose kërkesë ligjore';
  _compLh.appendChild(_compBtn);

  const _compModal = document.createElement('div');
  _compModal.id = '_comp-modal';
  _compModal.hidden = true;
  _compModal.innerHTML =
    '<div class="_comp-inner">' +
      '<div class="print-cover" aria-hidden="true"><div class="pc-emblem">&#9878;</div><h1 class="pc-title">programi i Henri Sila</h1><div class="pc-rule"></div><p class="pc-sub">Jurist</p><div class="pc-foot">Legjislacioni Shqiptar</div></div>' +
      '<div class="_comp-head">' +
        '<span class="_comp-title">Ankesë / Kërkesë Ligjore: ' + _lawTitle + '</span>' +
        '<div class="_comp-actions">' +
          '<button id="_comp-print">Printo</button>' +
          '<button id="_comp-close">&#215; Mbyll</button>' +
        '</div>' +
      '</div>' +
      '<div class="_comp-form">' +
        '<select id="_comp-type">' +
          '<option>Ankesë civile</option>' +
          '<option>Ankesë penale</option>' +
          '<option>Ankesë administrative</option>' +
          '<option>Kërkesë gjyqësore</option>' +
          '<option>Kundërshtim vendimi</option>' +
        '</select>' +
        '<textarea id="_comp-sit" placeholder="Përshkruani situatën tuaj (palët, çfarë ndodhi, çfarë kërkoni)…"></textarea>' +
        '<button id="_comp-gen">Gjenero &#8594;</button>' +
      '</div>' +
      '<pre id="_comp-body">Plotësoni formularin dhe shtypni "Gjenero →" për të hartuar ankesën.</pre>' +
    '</div>';
  document.body.appendChild(_compModal);

  document.getElementById('_comp-print').addEventListener('click', () => window.print());
  document.getElementById('_comp-close').addEventListener('click', () => { _compModal.hidden = true; });
  _compBtn.addEventListener('click', () => { _compModal.hidden = false; });

  document.getElementById('_comp-gen').addEventListener('click', () => {
    const type   = document.getElementById('_comp-type').value;
    const sit    = document.getElementById('_comp-sit').value.trim();
    if (!sit) return;
    const body   = document.getElementById('_comp-body');
    const genBtn = document.getElementById('_comp-gen');
    body.textContent = 'Duke hartuar ' + type.toLowerCase() + '…';
    genBtn.disabled = true;

    fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + GROQ_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 900,
        messages: [
          { role: 'system', content: 'Hartoni dokumente ligjore formale shqipe me strukturë të saktë juridike.' },
          { role: 'user',   content: 'Shkruaj ' + type + ' formale shqipe bazuar në ligjin "' + _lawTitle + '" (' + _lawRef + ').\nSituata: ' + sit + '\nStruktura:\n1. Të dhënat e palëve (emra shembull)\n2. Baza ligjore (nene konkrete nga ligji)\n3. Kërkesat / pretendimi\n4. Nënshkrimi dhe data\nDokumenti të jetë i plotë, profesional, gati për t\'u paraqitur.' }
        ]
      })
    })
    .then(r => r.json())
    .then(data => { body.textContent = (data.choices && data.choices[0] && data.choices[0].message.content) || 'Gabim.'; })
    .catch(() => { body.textContent = 'Gabim rrjeti.'; })
    .finally(() => { genBtn.disabled = false; });
  });
}
