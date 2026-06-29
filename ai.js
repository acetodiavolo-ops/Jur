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
  function add(key, url, model) {
    if (key && String(key).indexOf('YOUR_') !== 0) AI_PROVIDERS.push({ url: url, key: key, model: model });
  }
  add(typeof GROQ_KEY       !== 'undefined' ? GROQ_KEY       : '', 'https://api.groq.com/openai/v1/chat/completions',   'llama-3.3-70b-versatile');
  add(typeof CEREBRAS_KEY   !== 'undefined' ? CEREBRAS_KEY   : '', 'https://api.cerebras.ai/v1/chat/completions',       'llama-3.3-70b');
  add(typeof SAMBANOVA_KEY  !== 'undefined' ? SAMBANOVA_KEY  : '', 'https://api.sambanova.ai/v1/chat/completions',        'Meta-Llama-3.3-70B-Instruct');
})();

function aiReady() { return AI_PROVIDERS.length > 0; }

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
