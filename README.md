# Hex the Engineer — plugin storefront

A local website prototype for an independent audio-plugin brand, introducing
Project Nebula as a finishing tool for mixing engineers. Project Nebula remains
a working name and private beta. Pricing, trials, downloads, audio comparisons
and testimonials are explicitly unfinished; no checkout or public installer is
connected.

Development is isolated on `codex/hex-plugin-storefront` in
`C:\Users\ekter\.codex\worktrees\hex-plugins-website`. The existing live site and
original `main` checkout remain intact. **Do not push or deploy this branch
without publication approval:** the existing Git integration can create hosted
previews from branch pushes.

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
  this branch. Production intake has not been retired by this local work.
- The actual compiled plugin capture is an image, not an interactive plugin.
  Decorative atmosphere can be paused and respects reduced-motion preferences.
- Search indexing is disabled in the prototype. Enabling sales, downloads,
  support delivery or public indexing requires completed release work and
  publication approval.

## Documentation and review images

- [Catalog, naming and product maintenance](docs/CATALOG-GUIDE.md)
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

The GitHub rename to `ekterp-bot/plugins` is authorized but not performed:
Vercel connection access is needed to verify the existing Git binding and repair
path first. This is separate from publishing the new site. Existing DNS, hosting,
mail configuration and live customer data have not been changed.
