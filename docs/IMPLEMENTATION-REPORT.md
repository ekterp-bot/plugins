# Hex the Engineer — local storefront implementation

October 19, 2026. Historical local-review checkpoint. The subsequently approved
publication and final live verification are recorded in [the launch report](LAUNCH-REPORT.md).

## Delivered

Six static routes built from the existing website repository: homepage, plugin catalog, Project Nebula product page, downloads/release status, support, and about. The parent brand and product data live separately in `src/catalog.mjs`. A Node build generates real HTML routes; the site does not depend on a client-side router or a frontend framework.

The visual system retains the original Nebula concept: deep space, cyan/violet/blue/gold accents, local Manrope/Space Grotesk fonts, genuine compiled plugin imagery, dimensional control details and restrained CSS animation. The homepage introduces Hex as the company and Nebula as its first product. The product page makes premaster finishing the flagship use while also describing buses and selected tracks.

The listening console supports source selection and A/B visual states, with explicit no-audio notices. It does not play synthetic audio, claim measured waveforms, or perform loudness matching. The documented future demo workflow uses aligned, pre-matched approved renders and preserved play position. Pricing, trial, engineer feedback, license and public installer details remain honest placeholders.

The support form validates locally and never transmits its contents. Its submit button starts disabled until JavaScript installs interception. The separate support API validates requests and always returns an explicit no-send response. The legacy agency endpoint is retired with HTTP 410 in this branch; its prior implementation remains in Git. No provider secrets were pulled or modified.

## Workspace and preservation

- Repository: `ekterp-bot/hex-solutions` (rename to `plugins` prepared; see migration status below).
- Isolated branch: `codex/hex-plugin-storefront`.
- Worktree: `C:\Users\ekter\.codex\worktrees\hex-plugins-website`.
- Original `main` and its checkout are retained; old agency assets remain in the repository and are excluded from generated output. Old root HTML/CSS/JS remain recoverable in Git history.
- Verified complete-history backup: `C:\Users\ekter\.codex\worktrees\hex-solutions-pre-migration.bundle`.
- Project Nebula C++/JUCE engineering source, builds, Git state and installations were not modified by this website pass.

## Verification evidence

| Check | Result |
| --- | --- |
| Configured deployment build (`npm run build`) | Six routes plus a real 404; passed locally on Node 24.14.0 |
| Support handler tests | 7 passing, including malformed/oversized input and no-network enforcement |
| Static/HTTP verification | 91 checks passing: links, assets, IDs, accessible references, routes, headers, API states and source exclusion |
| Desktop and mobile browser review | All six routes rendered in the Codex in-app Chromium browser; full-page captures saved |
| Responsive layout | 1440 and 390 viewport captures; additional 768 and 320 checks. No horizontal overflow after a small-screen decorative-orbit fix |
| Chrome compatibility | Real Chrome homepage rendering and product navigation/source/A-B interactions passed; no observed console errors/warnings |
| Interface dialog | Opens; Escape closes and restores focus to the opener |
| Mobile navigation | Opens, navigates, closes; Escape restores focus to Menu |
| Listening preview | Source titles/cues update from catalog data; A/B labels update; Play announces that audio is unavailable |
| Support preview | Synthetic inputs show “not sent or saved”; frontend performs no network submission |
| Motion | Manual pause persisted across navigation. Reduced-motion CSS and media-query handling inspected; OS preference emulation was not available |

The in-app browser initially rejected the `127.0.0.1` alias. `http://localhost:4174` loaded successfully and was used for browser review. HTTP verification also succeeded directly against `127.0.0.1:4174`.

Evidence is under `artifacts/verification/` and `artifacts/screenshots/` (local, Git-ignored). Screenshots are unedited browser captures. Main deliverables:

- `home-desktop-full.jpg` / `home-mobile-full.jpg`
- `nebula-desktop-full.jpg` / `nebula-mobile-full.jpg`
- `catalog`, `downloads`, `support`, `about` desktop/mobile full-page captures

Limits: browser tests cover Chromium-based environments, not Safari/Firefox or physical mobile devices. No screen-reader audit or OS reduced-motion emulation was performed. No real audio comparison, inbox delivery, cloud build, deployed function, checkout, download or licensing flow is claimed as tested.

## Infrastructure and migration status

The corrected domain is **hextheengineer.com**. Apex redirects to `www`; Vercel serves the site. The deployed HTML/CSS/JS match the clean website source at `24f0574` after newline normalization. Hostinger is configured for inbound mail and `dns-parking.com` nameservers are present. These records do not establish the registrar account or billing state.

GitHub history is backed up and exact rename/rollback commands are documented. The already-authorized rename is pending authenticated verification of Vercel’s Git binding and repair path. The connector still requested reauthentication at the latest check. No repository, remote, live DNS, hosting setting or production content was changed. See [infrastructure evidence](INFRASTRUCTURE-AUDIT.md) and [migration/rollback procedure](DEPLOYMENT-ROLLBACK.md).

## Before publication

Review and approve the site. Restore authenticated Vercel inspection to finish the repository rename and confirm the existing build/function configuration. Approve final product naming and claims; approved release/installer/compatibility documentation must govern any download link. Approve audio and attributed feedback before replacing their placeholders.

Choose and approve the commerce/refund/update/trial model, establish the required business and product terms, and verify the support sender and abuse protection before enabling those flows. The recommended initial commerce direction is hosted merchant-of-record checkout with hosted fulfillment; see [commercial plan](COMMERCIAL-PLAN.md). No provider was activated.

An eventual publishing pass must verify Vercel’s generated output and API packaging, apply reviewed canonical/SEO settings, remove local-preview/noindex treatment only as approved, and confirm rollback eligibility. Pushing this local branch may trigger a public preview; no push was made.
