# Hex the Engineer — plugin storefront

A website for an independent audio-plugin brand, introducing
Project Nebula as a finishing tool for mixing engineers. Project Nebula remains
a working name and private beta. Pricing, trials, downloads, audio comparisons
and testimonials are explicitly unfinished; no checkout or public installer is
connected.

Development is isolated on `codex/hex-plugin-storefront` in
`C:\Users\ekter\.codex\worktrees\hex-plugins-website`. The preserved baseline and
original checkout remain available for recovery.

## Published — October 19, 2026

The owner-approved website is live at
[hextheengineer.com](https://hextheengineer.com), which redirects to `www`.
Source commit `d2548bf4f60716512bcb46f6aa8d41802191a547` was pushed to the tested
preview branch and `main`. Vercel reported production deployment success, and
the public domain renders the new storefront.

- GitHub repository rename completed: **`ekterp-bot/plugins`**, unchanged
  repository ID `1260333340`. The shared local `origin` is now
  `https://github.com/ekterp-bot/plugins.git`.
- Authenticated Vercel dashboard inspection verified team
  `ekterp-bots-projects`, existing project `hex-solutions`, and production branch
  `main`. The connected repository name has updated to `ekterp-bot/plugins`.
  The production overview now links to the renamed repository; the connection
  has not been disconnected or recreated.
- The renamed repository's Git integration produced Ready preview
  `EcNytwm1sdK1KfuShSTb1jUXA3ca` and production
  `ExpdzihSkyiPm2toQymSXWhowQWN`. The earlier baseline deployment is preserved
  for recovery. See [the launch report](docs/LAUNCH-REPORT.md) and
  [deployment and rollback record](docs/DEPLOYMENT-ROLLBACK.md).

This authorization covers website publication. Checkout, public plugin downloads
and email delivery remain inactive.

## Run locally

Use **Node.js 22 or newer** with npm. There are no package dependencies to
install and no API keys, `.env` file or external service is needed.

```powershell
cd C:\Users\ekter\.codex\worktrees\hex-plugins-website
npm run dev
```

Open [localhost:4174](http://localhost:4174/); this is the preferred URL for the
in-app browser. The server binds only to loopback and also accepts
`http://127.0.0.1:4174`. Stop it with Ctrl+C.

`npm run dev` builds once and starts the server; it is not a file watcher.
After edits, run `npm run build` in a second terminal and refresh the page.
`npm run preview` serves an existing build without rebuilding.

## Build and check

```powershell
npm run build
npm test
node tools/verify-site.mjs --static-only
```

With the local server running, check generated routes, assets and local endpoint
behavior as well:

```powershell
node tools/verify-site.mjs --base=http://localhost:4174
```

The verifier is restricted to loopback URLs. Browser/layout checks are separate
from these automated checks. `dist/` is generated and ignored by Git; edit source,
not its generated HTML. The build replaces only this checkout's `dist` directory.

## Routes and source

The site includes `/`, `/plugins`, `/plugins/project-nebula`, `/downloads`,
`/support`, `/about`, and a 404 page.

| Location | Purpose |
| --- | --- |
| `src/catalog.mjs` | Brand metadata, product entries, release status, controls and placeholder offers/demos |
| `src/components.mjs` | Shared layout, navigation, interface display and reusable sections |
| `src/pages.mjs` | Page composition and product-specific copy |
| `public/` | Served images, original marks, fonts, CSS and browser JavaScript |
| `tools/build.mjs` | Generate static routes, public catalog and build manifest in `dist/` |
| `tools/server.mjs` | Loopback-only preview server and disabled API behavior |
| `api/support.js` | Validated but deliberately unavailable support endpoint |
| `api/intake.js` | Retired service-intake endpoint in this branch |
| `tests/` | Local endpoint tests; no live email sending |

The catalog generates product listings and routes from data. The current product
template still contains Nebula-specific finishing copy, four-control visuals and
compatibility details. A different plugin requires appropriate template and
asset changes; see [the catalog guide](docs/CATALOG-GUIDE.md).

## Preview behavior

- The listening room switches example labels and A/B presentation only. No audio
  plays; the waveform is illustrative. Approved audio and a synchronized player
  remain future work.
- The support form checks required browser fields and displays an unsent preview.
  It never transmits or saves form content. Without browser JavaScript, its submit
  button remains disabled.
- Direct valid JSON requests to `/api/support` return **503** with `sent: false`;
  the endpoint has no provider transport. Legacy `/api/intake` returns **410** in
  the published storefront. Deployed GET method/status checks were observed
  without sending a support message.
- The actual compiled plugin capture is an image, not an interactive plugin.
  Decorative atmosphere can be paused and respects reduced-motion preferences.
- Production pages permit indexing and expose a six-page sitemap as part of the
  approved launch. Local/preview builds remain `noindex`; the 404 page always
  remains `noindex`. The visible ribbon identifies this as a **PRODUCT PREVIEW**.
  Sales, downloads and support delivery remain inactive.

## Documentation and review images

- [Catalog, naming and product maintenance](docs/CATALOG-GUIDE.md)
- [Production launch and verification](docs/LAUNCH-REPORT.md)
- [Verified infrastructure and source fingerprints](docs/INFRASTRUCTURE-AUDIT.md)
- [Repository rename, deployment boundaries and rollback](docs/DEPLOYMENT-ROLLBACK.md)
- [Support endpoint and future email integration](docs/EMAIL-INTEGRATION.md)
- [Assets, source captures and font notices](docs/ASSET-PROVENANCE.md)
- [Commercial plan and release decisions](docs/COMMERCIAL-PLAN.md)

Local review captures are stored under `artifacts/screenshots/`, including
`home-desktop-full.jpg`, `home-mobile-full.jpg`, `nebula-desktop-full.jpg`,
`nebula-mobile-full.jpg` and `catalog-mobile-full.jpg`. These artifacts are
ignored by Git. Additional page captures and the final review report are recorded
as the review pass completes.

The repository rename and deployment integration are verified by the successful
preview and production builds. The earlier preparation checkpoints remain in the
deployment record as history; do not rerun their rename commands. Existing DNS
and mail configuration were retained.
