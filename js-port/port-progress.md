# FuncScript JS Port Progress

- [ ] Documentation Hosting
  - [x] Serve MkDocs build via root Vercel project + funcscript.org aliasing (2025-11-13)
  - [x] Bundle FuncScript Studio assets (from `funcscript-vscode`) into `/fsstudio` for the docs site (2025-11-13)
- [ ] FuncScript Studio
  - [x] Enable Vercel preview deployments by adding SPA-friendly `vercel.json` routing (2024-11-24)
  - [x] Provide a reusable build script (within `funcscript-vscode`) for publishing the `/fsstudio` endpoint (2025-11-13)
  - [x] Add tester controls for clearing and deleting variables (2025-11-16)
  - [x] Surface parse error details inside FuncScript Studio (2025-11-16)
- [ ] Text Helpers
  - [x] Port upper/lower/regex helpers to the JS runtime and expose them via the `text` collection (2025-11-15)
