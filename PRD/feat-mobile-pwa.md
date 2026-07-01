## Progress Update as of [June 30, 2026 — 8:25 PM Pacific]

### Summary of changes since last update
First entry on this branch. Made Pixel Parents an installable PWA with a
landing-page install prompt (Next 16 Metadata/viewport API). Added a web app
manifest, a privacy-safe service worker + a production-guarded registration
client, an on-theme mobile install banner (Android beforeinstallprompt + iOS
Safari manual-steps fallback) with a pure, unit-tested eligibility helper, and
tightened the landing page for 375–430px viewports. Verified the start_url/auth
behavior (finding below). tsc, eslint, and the full vitest suite (63 files /
736 tests, incl. 13 new) all pass.

### Detail of changes made:
- `public/manifest.webmanifest`: name/short_name "Pixel Parents", description,
  `start_url:"/dashboard"`, `scope:"/"`, `display:"standalone"`,
  background/theme `#0A0A0B`, icons (icon-192 any, icon-512 any, maskable-512
  maskable, apple-touch-icon).
- `public/icons/*`: amber-"P"-on-ink icons staged (generated for this task).
- `public/sw.js`: minimal SW. Network-first for an explicit static allowlist
  (`/manifest.webmanifest` + `/icons/*`) only; everything else (all HTML, all
  `/api/*`) is a bare passthrough — never caches authed HTML or API responses,
  so no stale/private data can be served. skipWaiting + clients.claim + old-cache
  cleanup on activate.
- `components/sw-register.tsx`: `"use client"`; registers `/sw.js` on load, guarded
  to `NODE_ENV==="production"` + `window.isSecureContext` (https/localhost).
  Rendered once in `app/layout.tsx`.
- `app/layout.tsx`: added `metadata.manifest`, `metadata.appleWebApp`
  (capable/title/black-translucent), `metadata.icons.apple`; extended `viewport`
  with themeColor `#0A0A0B` + width `device-width` + initialScale 1 (kept
  viewportFit cover). Existing metadata left intact. Mounted `<ServiceWorkerRegister/>`.
- `components/install-prompt.tsx`: `"use client"`. Exports a PURE
  `decideInstallPrompt(env)` + `isIosSafari(ua)` helper (no React/side effects)
  plus the `InstallPrompt` component. Shows ONLY when mobile/touch, NOT standalone
  (`matchMedia('(display-mode: standalone)')` / `navigator.standalone`), and not
  dismissed (`localStorage['pp-install-dismissed']`). Android/Chromium: captures
  `beforeinstallprompt` (preventDefault + stash) and an Install button fires the
  stashed prompt. iOS Safari: detects it + shows "Tap Share, then Add to Home
  Screen". X writes the dismissed flag. On-theme black/amber, safe-area padding,
  reduced-motion respected (`.pp-install` animation in globals.css).
- `app/page.tsx`: renders `<InstallPrompt/>`; tightened landing padding
  (`px-4 py-10 sm:px-6 sm:py-12`), headline `text-3xl sm:text-6xl`, subhead
  `text-base` + `text-pretty` so 375–430px fits with no horizontal scroll
  (`overflow-hidden` already on `<main>`). "Sign up free" CTA is a large tappable
  pill.
- `app/globals.css`: added `pp-install` slide-up keyframe + reduced-motion opt-out.
- `app/install-eligibility.test.ts`: 13 vitest cases over the pure helper
  (iOS-Safari detection incl. CriOS/desktop/empty-UA, and every show/hide branch).
  Colocated under `app/**` because that is the only vitest `include` glob (besides
  `lib/**`) and this is the landing-page feature.

### start_url / auth finding
Visiting `/dashboard` while signed OUT does NOT hard-redirect to /sign-in.
`proxy.ts` intentionally only protects `/admin` + `/account`; `/dashboard` renders
the grayed `DashboardShell` with a `SignedOutPanel` ("Sign in to access your
dashboard" + sign-in CTA) and returns BEFORE any DB/PII read. So the installed
PWA opening to `start_url:/dashboard` lands on a sign-in prompt when logged out
and the real dashboard when logged in — the intended behavior. Auth is NOT
weakened and nothing was changed here.

### Potential concerns to address:
- Cannot run `next build`/`next dev` in this worktree: Turbopack rejects the
  cross-filesystem `node_modules` symlink (documented in PRD/feat-w4-mobile.md).
  Verified via tsc + eslint + vitest only; SW install / beforeinstallprompt need a
  real https build to exercise end-to-end.
- `app/apple-icon.png` (file convention) already emits an apple-touch-icon link;
  the new `metadata.icons.apple` (180x180 PWA tile) adds another. Harmless — both
  are valid — but could be de-duped later if desired.
- Theme color is `#0A0A0B` (per spec) vs the previous `#09090b`; visually identical.
