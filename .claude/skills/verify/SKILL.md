---
name: verify
description: Build/launch/drive recipe for verifying changes to the Jur static Albanian-law PWA (serve + headless Edge over CDP).
---

# Verifying Jur (static PWA, no build needed locally)

## Serve
```powershell
cd <repo>; python -m http.server 8123   # background
```
`data/` (law-article JSON) only exists after CI runs `build.py`. For local tests that
need grounding/search, create a tiny fixture and DELETE it afterwards:
- `data/laws.json` → `[{"file":"kodi-penal.html","title":"Kodi Penal","ref":"fixture"}]`
- `data/kodi-penal.json` → `{"134":"…dënohet me burgim nga tre gjer në dhjetë vjet.", …}`
Keyword grounding matches exact word forms (≥4 chars) — make tool input words appear
verbatim in fixture article text.

## Drive (headless Edge + CDP, no deps)
```powershell
& "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new `
  --remote-debugging-port=9222 --user-data-dir="$env:TEMP\jur-edge" --no-first-run about:blank
```
Node ≥21 has a global `WebSocket` — connect to the page target's
`webSocketDebuggerUrl` from `http://localhost:9222/json/list` and send raw CDP
(`Network.enable`, `Page.navigate`, `Runtime.evaluate`, `Page.captureScreenshot`).
A working driver pattern lives in git history / previous session scratchpad
(`cdp-drive.js`); rebuild from that shape.

## Gotchas
- **Login gate**: cosmetic; bypass with
  `Page.addScriptToEvaluateOnNewDocument: sessionStorage.setItem('jur_auth','1')`.
- **Block AI providers** during tests (no quota burn; exercises failure/retry UI):
  `Network.setBlockedURLs` with `*api.groq.com*`, `*api.cerebras.ai*`,
  `*generativelanguage.googleapis.com*`. Real keys live in local `config.js` (gitignored).
- **innerText is UPPERCASED** for section labels / "Neni N" chips (CSS text-transform)
  — use case-insensitive assertions.
- Tool flows: parashkrim = set `#sol-type`/`#sol-date`, click `#sol-btn`, read
  `#tool-sections`; penalty = `#pen-sit` + `#pen-btn`; search = set `#law-search`
  value + dispatch `input` event, wait ~1.8s (200ms debounce + worker corpus load),
  read `#ft-list`.
- Pure date/range logic (`JurDate`, `JUR_LIMITS`, `checkLimitation`, `solCompute`,
  `extractSanctions`) can be extracted from `mjete-ai.js` by string-slicing between
  known markers and run in Node directly — good for exact-date assertions.
- Syntax check everything with `node --check`; `build.py` with `python -c "import ast; …"`.
