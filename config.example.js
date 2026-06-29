// Copy this file to config.js and fill in your keys. config.js is gitignored.
// On deploy, GitHub Actions regenerates config.js from the repo's Secrets.
//
// The app tries the AI providers in order (Groq -> Cerebras -> OpenRouter) and
// automatically falls back to the next one whose key is set when a key expires or
// is rate-limited. Leave a key as its 'YOUR_..._HERE' placeholder (or '') to skip it.
//
// Primary  - Groq (free):      https://console.groq.com/keys
const GROQ_KEY = 'YOUR_GROQ_KEY_HERE';
// Fallback 1 - Cerebras (free, same Llama 3.3 70B): https://cloud.cerebras.ai  (API Keys)
const CEREBRAS_KEY = 'YOUR_CEREBRAS_KEY_HERE';
// Fallback 2 - Google Gemini (free, browser-CORS OK): https://aistudio.google.com/apikey
const GEMINI_KEY = 'YOUR_GEMINI_KEY_HERE';

// Login credentials (any of the three pairs grants access):
const LOGIN_USER = 'user1';  const LOGIN_PASS = 'pass1';
const LOGIN_USER2 = 'user2'; const LOGIN_PASS2 = 'pass2';
const LOGIN_USER3 = 'user3'; const LOGIN_PASS3 = 'pass3';
