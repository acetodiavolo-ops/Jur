// ligjet-search.js — card filter + full-text search UI for ligjet.html.
// The heavy part (corpus load + scan) runs in ligjet-search-worker.js; this file
// only renders results. Extracted from the old inline script for caching + defer.
'use strict';

(function () {
  var pills  = document.querySelectorAll('.pill');
  var rows   = document.querySelectorAll('.law-row');
  var secs   = document.querySelectorAll('.domain-section');
  var input  = document.getElementById('law-search');
  var domain = 'all';
  var query  = '';

  function apply() {
    rows.forEach(function (row) {
      var domainOk = domain === 'all' || row.dataset.domain === domain;
      var textOk   = query === '' || row.dataset.title.includes(query) || row.dataset.domain.includes(query);
      row.hidden = !(domainOk && textOk);
    });
    secs.forEach(function (sec) {
      var any = Array.from(sec.querySelectorAll('.law-row')).some(function (r) { return !r.hidden; });
      sec.hidden = !any;
    });
  }

  pills.forEach(function (pill) {
    pill.addEventListener('click', function () {
      pills.forEach(function (p) { p.classList.remove('active'); });
      pill.classList.add('active');
      domain = pill.dataset.domain;
      apply();
    });
  });

  // ── Full-text search across all article texts, via Web Worker ──
  var box = document.getElementById('ft-results'),
      list = document.getElementById('ft-list'),
      countEl = document.getElementById('ft-count'),
      statusEl = document.getElementById('ft-status');

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function rx(w) { return w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function fold(s) { return String(s).toLowerCase().replace(/ë/g, 'e').replace(/ç/g, 'c'); }
  // Regex for a folded term that also matches the diacritic originals (e→e|ë, c→c|ç).
  function termRe(w) { return rx(w).replace(/e/g, '[eë]').replace(/c/g, '[cç]'); }

  var worker = null, workerDead = false;
  function getWorker() {
    if (worker || workerDead) return worker;
    try {
      worker = new Worker('ligjet-search-worker.js');
      worker.onmessage = onWorkerMsg;
      worker.onerror = function () { workerDead = true; statusEl.textContent = 'Kërkimi në tekst nuk është i disponueshëm.'; };
    } catch (e) {
      workerDead = true;
      statusEl.textContent = 'Kërkimi në tekst nuk është i disponueshëm.';
    }
    return worker;
  }

  var reqId = 0, corpusState = '';
  function onWorkerMsg(e) {
    var msg = e.data || {};
    if (msg.type === 'status') {
      corpusState = msg.state;
      if (msg.state === 'loading') statusEl.textContent = 'Duke ngarkuar tekstin e ligjeve…';
      else if (msg.state === 'empty') statusEl.textContent = 'Kërkimi në tekst nuk është i disponueshëm — të dhënat e teksteve mungojnë.';
      else statusEl.textContent = '';
      return;
    }
    if (msg.type !== 'results' || msg.id !== reqId) return; // stale response
    var terms = fold(input.value.trim()).split(/\s+/).filter(function (w) { return w.length >= 2; });
    var total = msg.total, hits = msg.hits || [];
    if (corpusState !== 'empty') statusEl.textContent = total ? '' : 'Asnjë nen nuk përmban këto fjalë.';
    countEl.textContent = total ? ('(' + total + (total > 60 ? '+' : '') + ')') : '';
    list.innerHTML = hits.map(function (a) {
      return '<li class="ft-item"><a href="' + a.file + '#neni-' + String(a.num).replace(/\//g, '-') + '">' +
        '<span class="ft-law">' + esc(a.title) + '</span>' +
        '<span class="ft-neni">Neni ' + esc(a.num) + '</span>' +
        '<span class="ft-snip">' + snippet(a.text, terms) + '</span></a></li>';
    }).join('');
  }

  function snippet(text, terms) {
    // fold() is length-preserving, so positions in the folded text map 1:1 to the original.
    var tf = fold(text), pos = -1;
    terms.forEach(function (w) { var p = tf.indexOf(w); if (p !== -1 && (pos < 0 || p < pos)) pos = p; });
    if (pos < 0) pos = 0;
    var start = Math.max(0, pos - 55), end = Math.min(text.length, pos + 150);
    var frag = esc((start > 0 ? '…' : '') + text.slice(start, end).replace(/\s+/g, ' ') + (end < text.length ? '…' : ''));
    terms.forEach(function (w) { frag = frag.replace(new RegExp('(' + termRe(w) + ')', 'gi'), '<mark>$1</mark>'); });
    return frag;
  }

  function fullText(raw) {
    var q = (raw || '').trim();
    if (q.length < 3) { box.hidden = true; list.innerHTML = ''; countEl.textContent = ''; statusEl.textContent = ''; return; }
    var w = getWorker();
    if (!w) { box.hidden = false; return; }
    box.hidden = false;
    w.postMessage({ type: 'search', q: q, id: ++reqId });
  }

  var t;
  input.addEventListener('input', function () {
    clearTimeout(t);
    t = setTimeout(function () { var v = input.value.trim(); query = v.toLowerCase(); apply(); fullText(v); }, 200);
  });
}());
