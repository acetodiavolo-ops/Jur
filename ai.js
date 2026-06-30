// ai.js — multi-provider fallback for the AI calls.
//
// Tries each provider whose key is configured, in order, so the app keeps working when
// one key expires or is rate-limited. All providers below use the OpenAI-compatible
// chat-completions API, so the exact same request/response code works across them.
//
// To add or swap a provider: add its key in config.js (and deploy.yml secrets), then add
// one add(...) line below with the provider's endpoint URL and model id. Order = priority.
'use strict';

var AI_PROVIDERS = [];
(function () {
  function add(key, url, model, strong) {
    if (key && String(key).indexOf('YOUR_') !== 0) AI_PROVIDERS.push({ url: url, key: key, model: model, strong: !!strong });
  }
  // Fast default chain (used for the bulk of calls):
  add(typeof GROQ_KEY       !== 'undefined' ? GROQ_KEY       : '', 'https://api.groq.com/openai/v1/chat/completions',   'llama-3.3-70b-versatile');
  add(typeof CEREBRAS_KEY   !== 'undefined' ? CEREBRAS_KEY   : '', 'https://api.cerebras.ai/v1/chat/completions',       'gpt-oss-120b');
  add(typeof GEMINI_KEY     !== 'undefined' ? GEMINI_KEY     : '', 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', 'gemini-2.5-flash');
  // Stronger reasoners for the critical calls — reuse the EXISTING free Groq/Cerebras keys (no new key, CORS-OK).
  // If a model id is ever retired, the call just falls back to the fast chain. To swap, edit the model id here.
  add(typeof GROQ_KEY       !== 'undefined' ? GROQ_KEY       : '', 'https://api.groq.com/openai/v1/chat/completions',   'moonshotai/kimi-k2-instruct',     true);
  add(typeof CEREBRAS_KEY   !== 'undefined' ? CEREBRAS_KEY   : '', 'https://api.cerebras.ai/v1/chat/completions',       'qwen-3-235b-a22b-instruct-2507',  true);
})();

function aiReady() { return AI_PROVIDERS.length > 0; }
// Provider order for a given call: when `strong`, try the strong reasoners first, then the fast chain.
function aiChain(strong) {
  if (!strong) return AI_PROVIDERS;
  var s = AI_PROVIDERS.filter(function (p) { return p.strong; });
  return s.length ? s.concat(AI_PROVIDERS.filter(function (p) { return !p.strong; })) : AI_PROVIDERS;
}

// Drop-in replacement for fetch() to the chat endpoint. Accepts the same options object
// the call sites already build; it ignores the url/headers/model in there and instead
// tries each provider in order, returning the first OK Response (caller still does r.json()).
function aiFetch(opts) {
  var payload = {};
  try { payload = JSON.parse((opts && opts.body) || '{}'); } catch (e) { payload = {}; }
  delete payload.model;
  var signal = opts && opts.signal;
  if (!AI_PROVIDERS.length) return Promise.reject(new Error('No AI provider key configured'));
  function tryP(i) {
    var p = AI_PROVIDERS[i];
    var body = JSON.stringify(Object.assign({ model: p.model }, payload));
    return fetch(p.url, {
      method: 'POST', signal: signal,
      headers: { 'Authorization': 'Bearer ' + p.key, 'Content-Type': 'application/json' },
      body: body
    }).then(function (res) {
      if (res.ok) return res;                                   // success
      if (i + 1 < AI_PROVIDERS.length) return tryP(i + 1);      // bad key / rate-limit -> next provider
      return res;                                               // last one: let caller read the error
    }).catch(function (err) {
      if (err && err.name === 'AbortError') throw err;
      if (i + 1 < AI_PROVIDERS.length) return tryP(i + 1);      // network error -> next provider
      throw err;
    });
  }
  return tryP(0);
}

// Batch embeddings via Gemini (gemini-embedding-001) over the OpenAI-compatible endpoint.
// Returns Promise<number[][]> aligned to `texts`. Used for semantic citation ranking; the
// caller treats any rejection as "skip semantic, keep keyword grounding".
function aiEmbed(texts) {
  var k = (typeof GEMINI_KEY !== 'undefined') ? GEMINI_KEY : '';
  if (!k || String(k).indexOf('YOUR_') === 0) return Promise.reject(new Error('no embed key'));
  return fetch('https://generativelanguage.googleapis.com/v1beta/openai/embeddings', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + k, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gemini-embedding-001', input: texts })
  }).then(function (r) {
    if (!r.ok) throw new Error('embed HTTP ' + r.status);
    return r.json();
  }).then(function (d) {
    return (d.data || []).slice().sort(function (a, b) { return (a.index || 0) - (b.index || 0); })
      .map(function (x) { return x.embedding; });
  });
}

// Web-grounded answer via Gemini's native Google-Search tool: returns { text, sources:[{title,uri}] }.
// Uses the existing Gemini key; rejects (gracefully) when no key / quota / HTTP error.
function aiGroundedSearch(query, signal) {
  var k = (typeof GEMINI_KEY !== 'undefined') ? GEMINI_KEY : '';
  if (!k || String(k).indexOf('YOUR_') === 0) return Promise.reject(new Error('no gemini key'));
  return fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + encodeURIComponent(k), {
    method: 'POST', signal: signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: String(query || '') }] }],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 700 }
    })
  }).then(function (r) { if (!r.ok) throw new Error('ground HTTP ' + r.status); return r.json(); })
    .then(function (d) {
      var cand = d && d.candidates && d.candidates[0];
      var text = ((cand && cand.content && cand.content.parts) || []).map(function (p) { return p.text || ''; }).join(' ').replace(/\s+/g, ' ').trim();
      var sources = [], seen = {};
      var chunks = (cand && cand.groundingMetadata && cand.groundingMetadata.groundingChunks) || [];
      chunks.forEach(function (c) {
        if (c && c.web && c.web.uri && !seen[c.web.uri]) { seen[c.web.uri] = 1; sources.push({ title: c.web.title || c.web.uri, uri: c.web.uri }); }
      });
      return { text: text, sources: sources };
    });
}
