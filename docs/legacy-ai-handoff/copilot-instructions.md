# Copilot / Agent instructions — PalmTrace

This folder is an Arabic RTL offline-first PWA for date-palm farm operations.

Stack: vanilla JS, localStorage (`palmtrace_v5`), service worker `palmtrace-v33`.
Do not introduce React/Vue/Angular unless the user explicitly asks.
Do not add olive or multi-crop support unless explicitly asked. Labels: نخلة، فسيلة، تمر.

Coding rules:
- Edit the smallest region that implements the request.
- Keep event delegation (`data-go`, `data-act`).
- Palm codes: `{sector}-{plotNo}{part}-{F|N}{seq3}-{MMYY}` e.g. `03-12A-F045-0325`.
- Offshoot temp codes append `-OS{seq}-{MMYY}`.
- Bump `CACHE` in `sw.js` after changing cached assets.
- User-facing strings stay Arabic. Map pending→معلق, approved→معتمد.
- Demo logins: admin/engineer/worker/investor/nursery password `1234`.

Read `docs/02_معمارية_المشروع.md` and `docs/03_قواعد_التكويد_والمنطق.md` before large changes.
After edits run `node --check js/app.js`.
