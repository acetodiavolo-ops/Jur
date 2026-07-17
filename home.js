// home.js — Law of the Day + Daily Tip for the homepage.
// The law is picked deterministically per calendar day (a real "law of the day",
// not a random pick per load), and the AI-generated blurb/tip are cached in
// localStorage per day — so the homepage makes at most one pair of AI calls per
// device per day, and only after first paint (idle), never on the critical path.
'use strict';

(function () {
  var LAWS = [
    { title: 'Kushtetuta e Republikës së Shqipërisë', file: 'kushtetuta.html' },
    { title: 'Kodi Civil',                            file: 'kodi-civil.html' },
    { title: 'Kodi Penal',                            file: 'kodi-penal.html' },
    { title: 'Kodi i Procedurës Civile',              file: 'kodi-procedure-civile.html' },
    { title: 'Kodi i Procedurës Penale',              file: 'kodi-procedure-penale.html' },
    { title: 'Kodi i Familjes',                       file: 'kodi-familjes.html' },
    { title: 'Kodi Rrugor',                           file: 'kodi-rrugor.html' },
    { title: 'Kodi Ajror',                            file: 'kodi-ajror.html' },
    { title: 'Kodi Doganor',                          file: 'kodi-doganor.html' },
    { title: 'Kodi i Drejtësisë Penale për të Mitur', file: 'drejtesia-penale-mitur.html' },
    { title: 'Dispozita Zbatuese të Kodit Doganor',   file: 'dispozita-zbatuese-kodi-doganor.html' },
    { title: 'Ligj për Tregtarët dhe Shoqëritë Tregtare', file: 'shoqerite-tregtare.html' },
    { title: 'Ligj për Falimentimin',                 file: 'falimentimi.html' },
    { title: 'Statusi i Gjyqtarëve dhe Prokurorëve',  file: 'statusi-gjyqtareve-prokuroreve.html' },
    { title: 'Organizimi i Pushtetit Gjyqësor',                 file: 'organizimi-pushtetit-gjyqesor.html' },
    { title: 'Organizimi i Pushtetit Gjyqësor (i përditësuar)', file: 'organizimi-pushtetit-gjyqesor-v2.html' },
    { title: 'Ligj për Noterinë',                     file: 'noteria.html' },
    { title: 'Shërbimi Përmbarimor Gjyqësor Privat',  file: 'sherbimi-permbarimor.html' }
  ];
  var TIP_TOPICS = [
    'kontratat gojore', 'lejet e ndërtimit', 'garancitë e produktit', 'pushimet vjetore',
    'qiraja e banesës', 'trashëgimia ligjore', 'martesa civile', 'divorci dhe kujdestaria',
    'aksidentet rrugore', 'të drejtat e konsumatorit', 'hapja e biznesit', 'faturimi dhe TVSH',
    'pronësia e tokës', 'kontratat e punës', 'pushimi nga puna', 'sigurimet shoqërore',
    'birësimi i fëmijëve', 'testamenti', 'borxhet dhe kreditë', 'denoncimet penale',
    'privatësia e të dhënave', 'pronësia intelektuale', 'falimentimi personal', 'noterizimi',
    'ankandi publik', 'lejet e drejtimit', 'regjistrat publik', 'kontratat elektronike',
    'arbitrazhi', 'ndërmjetësimi ligjor'
  ];

  var lotdText = document.querySelector('.lotd-text');
  var lotdLink = document.querySelector('.lotd-link');
  if (!lotdText) return;

  var now = new Date();
  function pad(x) { return (x < 10 ? '0' : '') + x; }
  var todayKey = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
  var dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
  var law = LAWS[dayOfYear % LAWS.length];
  var tipTopic = TIP_TOPICS[now.getDate() % TIP_TOPICS.length];

  // Paint immediately with what we know — no network needed for a useful hero.
  lotdText.textContent = law.title;
  if (lotdLink) { lotdLink.href = law.file; lotdLink.hidden = false; }

  var tipEl = document.createElement('p');
  tipEl.id = '_daily-tip';
  tipEl.style.cssText = 'font-size:0.78rem;color:#999;line-height:1.6;margin-top:10px;font-style:italic;';
  tipEl.hidden = true;
  if (lotdLink) lotdLink.insertAdjacentElement('beforebegin', tipEl);

  var CACHE_KEY = 'lotd-v1';
  function readCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch (e) { return null; }
  }
  function save(patch) {
    var cur = readCache();
    if (!cur || cur.date !== todayKey) cur = { date: todayKey, law: law.file };
    for (var k in patch) cur[k] = patch[k];
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(cur)); } catch (e) {}
  }

  var cached = readCache();
  if (cached && cached.date === todayKey && cached.law === law.file) {
    if (cached.text) lotdText.textContent = cached.text;
    if (cached.tip) { tipEl.textContent = cached.tip; tipEl.hidden = false; }
    return; // today's content already generated — zero AI calls
  }

  if (typeof aiReady !== 'function' || !aiReady()) return;

  function fetchDaily() {
    aiFetch({
      body: JSON.stringify({
        max_tokens: 120,
        messages: [
          { role: 'system', content: 'Jeni asistent ligjor shqiptar. Jepni informacion të shkurtër dhe interesant.' },
          { role: 'user',   content: 'Jep 2 fjali interesante ose praktike rreth: "' + law.title + '". Fillo drejtpërdrejt me informacionin, jo me "Ky ligj".' }
        ]
      })
    })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var txt = data.choices && data.choices[0] && data.choices[0].message.content;
      if (txt) { lotdText.textContent = txt; save({ text: txt }); }
    })
    .catch(function () {});

    aiFetch({
      body: JSON.stringify({
        max_tokens: 90,
        messages: [
          { role: 'system', content: 'Jeni këshilltar ligjor praktik për qytetarët shqiptarë.' },
          { role: 'user',   content: 'Jep një këshillë praktike juridike rreth "' + tipTopic + '" për qytetarët shqiptarë. Fillo me "Dini që:". Max 2 fjali.' }
        ]
      })
    })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var t = data.choices && data.choices[0] && data.choices[0].message.content;
      if (t) { tipEl.textContent = t; tipEl.hidden = false; save({ tip: t }); }
    })
    .catch(function () {});
  }

  // Never on the critical path: wait for idle (or shortly after load).
  if ('requestIdleCallback' in window) requestIdleCallback(fetchDaily, { timeout: 3000 });
  else setTimeout(fetchDaily, 200);
})();
