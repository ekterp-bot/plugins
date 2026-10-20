# Website launch — October 19, 2026

The reviewed Hex the Engineer storefront is published at
[hextheengineer.com](https://hextheengineer.com), redirecting to
[www.hextheengineer.com](https://www.hextheengineer.com/). The owner explicitly
approved publication. This is a website launch; Project Nebula remains a
working name and private beta.

## Release and repository

- Website implementation: `d2548bf4f60716512bcb46f6aa8d41802191a547`.
- GitHub: [ekterp-bot/plugins](https://github.com/ekterp-bot/plugins), renamed
  from `hex-solutions` with unchanged repository ID `1260333340` and full history.
- Same Vercel team/project: `ekterp-bots-projects` / `hex-solutions`.
  No project recreation, Git disconnection, DNS edit or credential change.
- Tested preview: `EcNytwm1sdK1KfuShSTb1jUXA3ca`, Ready, five-second build.
- Initial production release: `ExpdzihSkyiPm2toQymSXWhowQWN`, Ready and Current,
  six-second build, production branch `main`.
- [Production deployment](https://hex-solutions-bfgnekw9q-ekterp-bots-projects.vercel.app)
  built at `2026-10-20T04:09:23Z` (October 19, 21:09 PDT).
- This documentation follow-up changes no website source or runtime behavior.

The repository rename was verified by a subsequent preview and production build,
not only by the displayed repository name. The live project now links to the
renamed repository. Both local website worktrees share the updated remote.
The original checkout and independent baseline bundle remain preserved.
See [deployment and rollback](DEPLOYMENT-ROLLBACK.md) for the prior deployment.

## Verification

- Local build succeeded; 12 tests passed, including production/preview indexing
  and disabled support handling. The complete local verifier passed 91 checks.
- Authenticated Chrome inspection of the hosted preview covered all six routes
  and the deployed API responses before the production push.
- Public production HTTP verification passed **29 checks**: six routes,
  apex-to-www redirect, custom 404, canonical/indexing metadata, security headers,
  sitemap, manifest, source-file exclusions, API method gates and public assets.
- All deployed public assets matched the reviewed local files or their exact
  committed Git blobs. One licence text file differs from the Windows checkout
  only because Git normalizes CRLF; its deployed bytes match the committed blob.
- `GET /api/support` returned 405 with `sent:false`; the retired
  `GET /api/intake` returned 410 with `sent:false`. No live message submission
  or email delivery test was performed.
- The live homepage and product page were rendered at desktop 1440px and mobile
  390px widths in Chromium. No horizontal overflow was observed. Mobile menu,
  product navigation, audio-example selection and A/B placeholder states worked.
  The play action correctly explains that approved audio is unavailable.
- No browser warnings or errors appeared during these live checks. Runtime log
  auditing and real-user performance monitoring were not performed; analytics
  and Speed Insights were not enabled.
- This is browser viewport testing, not physical-device, Safari or Firefox
  qualification. Earlier local motion/accessibility checks are documented in
  [the implementation report](IMPLEMENTATION-REPORT.md).

Local evidence is intentionally excluded from Git and the website output:

- `artifacts/deployment/production-http-checks.json`
- `artifacts/deployment/preview-browser-checks.json`
- `artifacts/deployment/production-ready.txt`
- `artifacts/screenshots/published-home-desktop.jpg`
- `artifacts/screenshots/published-home-desktop-full.jpg`
- `artifacts/screenshots/published-home-mobile-full.jpg`
- `artifacts/screenshots/published-nebula-desktop-full.jpg`
- `artifacts/screenshots/published-nebula-mobile-full.jpg`

## Published behavior and remaining product work

The public ribbon now says **PRODUCT PREVIEW**. Production builds allow search
indexing and include canonical/Open Graph metadata and a six-route sitemap.
Local and hosted preview builds remain excluded from indexing; 404 pages always
remain excluded.

Pricing, trial availability, engineer feedback and audio demonstrations remain
honest placeholders. Checkout, installer downloads, licensing, subscriptions,
uploads and support email transport are inactive. The support page offers the
existing contact address and accurately identifies its form as a preview.
No private binaries or engineering source were included in the deployment.

The website stays in its isolated marketing worktree. The C++/JUCE engineering
project was not modified by this launch.
