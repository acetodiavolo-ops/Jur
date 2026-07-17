// ligjet-search-worker.js — full-text law search off the main thread.
// Loads the article corpus (data/*.json, potentially several MB) and scans it here,
// so typing in the search box never janks the page. Text is diacritic-folded
// (ë→e, ç→c — length-preserving) so "vjedhje" matches "vjedhjë" and vice versa.
'use strict';

var corpus = null;   // [{file,title,num,text,folded}]
var loading = null;

function fold(s) {
  return String(s).toLowerCase()
    .replace(/ë/g, 'e').replace(/Ë/g, 'e')
    .replace(/ç/g, 'c').replace(/Ç/g, 'c');
}

function loadCorpus() {
  if (corpus) return Promise.resolve(corpus);
  if (loading) return loading;
  postMessage({ type: 'status', state: 'loading' });
  loading = fetch('data/laws.json')
    .then(function (r) { if (!r.ok) throw new Error('no-manifest'); return r.json(); })
    .then(function (laws) {
      return Promise.all((laws || []).map(function (l) {
        return fetch('data/' + l.file.replace(/\.html$/, '.json'))
          .then(function (r) { return r.ok ? r.json() : {}; })
          .catch(function () { return {}; })
          .then(function (data) { return { file: l.file, title: l.title, data: data || {} }; });
      }));
    })
    .then(function (rows) {
      var idx = [];
      rows.forEach(function (row) {
        Object.keys(row.data).forEach(function (num) {
          var txt = String(row.data[num] || '');
          if (txt) idx.push({ file: row.file, title: row.title, num: num, text: txt, folded: fold(txt) });
        });
      });
      corpus = idx;
      postMessage({ type: 'status', state: idx.length ? 'ready' : 'empty', articles: idx.length });
      return idx;
    })
    .catch(function () {
      corpus = [];
      postMessage({ type: 'status', state: 'empty', articles: 0 });
      return corpus;
    });
  return loading;
}

onmessage = function (e) {
  var msg = e.data || {};
  if (msg.type === 'load') { loadCorpus(); return; }
  if (msg.type !== 'search') return;
  loadCorpus().then(function (idx) {
    var terms = fold(msg.q || '').split(/\s+/).filter(function (w) { return w.length >= 2; });
    if (!terms.length) { postMessage({ type: 'results', id: msg.id, total: 0, hits: [] }); return; }
    var hits = [];
    for (var i = 0; i < idx.length; i++) {
      var a = idx[i], sc = 0;
      for (var j = 0; j < terms.length; j++) { if (a.folded.indexOf(terms[j]) !== -1) sc++; }
      if (sc > 0) hits.push({ a: a, sc: sc });
    }
    hits.sort(function (x, y) { return y.sc - x.sc || x.a.text.length - y.a.text.length; });
    var total = hits.length;
    postMessage({
      type: 'results', id: msg.id, total: total,
      hits: hits.slice(0, 60).map(function (h) { return { file: h.a.file, title: h.a.title, num: h.a.num, text: h.a.text }; })
    });
  });
};
