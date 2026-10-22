# Hex the Engineer — plugin storefront

A website for an independent audio-plugin brand, introducing
ProjectNebula as a finishing tool for mixing engineers. ProjectNebula remains
a working name and private beta. STORE-001 adds a private customer-account,
complimentary-entitlement and authorized-download foundation on this branch.
Checkout, trials, public installers, audio comparisons and testimonials remain
unavailable. The live production site does not include STORE-001 yet.

Development is isolated on `codex/hex-plugin-storefront` in
`C:\Users\ekter\.codex\worktrees\hex-plugins-website`. The preserved baseline and
original checkout remain available for recovery.

## STORE-001 private preview

See [implementation and setup](docs/STORE-001-IMPLEMENTATION.md),
[database contract](docs/STORE-001-DATABASE.md), and
[commerce and activation plan](docs/STORE-001-COMMERCE-AND-ACTIVATION.md).
The customer portal is `/account`; owner management is `/admin`.
Use `npm ci`, configure the ignored `.env.store` from `.env.example`, then run
`npm run store:dev` and open `http://localhost:4176/account`.
The preview uses its dedicated Supabase project and a clearly labeled text
artifact. Actual installers require a separately approved, verified release.

## Current published version — October 21, 2026

The approved BP010 interface now supplies the hero, product details and sharing
card. Following explicit owner approval, visual commit `0e335e6` was published
to [hextheengineer.com](https://www.hextheengineer.com/). Production deployment
`C1rdFTgn2y6KeaSHBah7zCy9JhMi` succeeded; all 23 live checks passed, followed by
desktop and mobile browser inspection. See [implementation report](docs/VISUAL-FINALIZATION-REPORT.md),
[image replacement guide](docs/PRODUCT-IMAGES.md), and
[future-build roadmap](docs/FUTURE-BUILD-ROADMAP.md).

## Published baseline — October 19, 2026

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

Use **Node.js 22 or newer** with npm and run `npm ci` first. The marketing pages
work without API credentials. Account functionality requires the private
STORE-001 setup described above.

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
`/support`, `/about`, `/account`, `/admin`, and a 404 page. Account and admin
routes have `noindex` metadata and are excluded from the sitemap.

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
