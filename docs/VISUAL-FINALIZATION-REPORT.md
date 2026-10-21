# Storefront visual finalization — October 21, 2026

**Published following explicit owner approval.** Live:
[hextheengineer.com](https://www.hextheengineer.com/). Local preview:
[localhost:4175](http://localhost:4175/), with the
[product page](http://localhost:4175/plugins/project-nebula).

Work remains in `C:\Users\ekter\.codex\worktrees\hex-plugins-website`, branch
`codex/hex-plugin-storefront`. The starting tree was clean at `5b7203d`.
The initial pass stayed local. The owner's follow-up authorized publication;
visual commit `0e335e6fb35e3afb8e7efde4c38899e937398e31` was pushed to the
marketing branch and `main`. Vercel production deployment
`C1rdFTgn2y6KeaSHBah7zCy9JhMi` succeeded on the existing project. No repository
rename, deployment-configuration change or engineering modification was made.

## Implemented

- Homepage hero, product hero, catalog and four detail crops use the final
  approved compiled BP010 capture. The continuous PROJECTNEBULA lockup and
  Intelligent Mix Finishing category now agree with the product.
- Removed the outdated customer-facing EarWax support reference. Earlier
  screenshot files are preserved outside the served directory.
- Complete responsive images at four widths, native dimensions to reserve
  layout, high-priority hero loading, lazy detail loading and an on-demand
  lossless viewer. Mobile has native-size pan/scroll and a fit-view option.
- Larger stacked mobile detail cards, consistent cyan/violet/blue/gold accents,
  straight catalog framing and complete product controls without perspective
  distortion. Existing parent logo, cinematic layout and motion remain.
- Repeatable image preparation, immutable source/hash records, lighter responsive
  atmosphere assets and a new product social card using the complete actual UI.

The source's native client is 1200 × 880. No higher-resolution capture of these
final icons was available. It has not been falsely upscaled or mixed with older
2400-pixel UI artwork. Silent meters/history in the source remain authentic.

## Targeted verification

- After publication, all 23 live checks passed: six routes, ten product asset
  hashes, three script/style hashes, production manifest, apex redirect and
  endpoint method/retirement gates. Desktop hero and mobile control details
  were visually inspected on the public domain. Local evidence is saved in
  `artifacts/deployment/published-visual-finalization.json`.
- Website build passed. Existing Node tests: 12 passed. Existing static/loopback
  verifier: 99 checks passed (routes, references, release gates and endpoints).
- Browser inspection of homepage/product at 1440 desktop and 390 phone widths;
  tablet appearance at 768. Layout geometry also checked at 1920, 1280 and 320.
  No horizontal overflow was measured at these widths.
- Inspected loaded control details, catalog framing, mobile menu navigation,
  full-size/fit viewer, Escape dismissal, and retained support email link.
  The early viewer binding defect was corrected and interaction rechecked.
  Final preview browser log inspection found no new JavaScript errors.
- Independent read-only image review confirmed original bytes, full-view pixels,
  all four crop pixels, ten derivative hashes/dimensions and CSS asset paths.
- API files, Vercel configuration, email address and delivery behavior are unchanged.
  The form remains a labeled no-send preview. No actual emails or purchases tested.

Reduced-motion and offscreen animation handling were retained in source; no new
animation was added. This was a targeted Chromium preview review, not physical
device, Safari/Firefox, accessibility certification or plugin/DAW validation.

## Browser screenshots

Actual captures, outside the public build:

- [Homepage desktop](../artifacts/screenshots/visual-finalization/home-desktop-full.jpg)
- [Homepage mobile](../artifacts/screenshots/visual-finalization/home-mobile-full.jpg)
- [Product desktop](../artifacts/screenshots/visual-finalization/product-desktop-full.jpg)
- [Product mobile](../artifacts/screenshots/visual-finalization/product-mobile-full.jpg)
- [Hero detail](../artifacts/screenshots/visual-finalization/home-hero-desktop.jpg)
- [Published desktop hero](../artifacts/screenshots/visual-finalization/published-home-hero-desktop.jpg)
- [Published mobile controls](../artifacts/screenshots/visual-finalization/published-product-mobile.jpg)

## Prepared for subsequent passes

[Image maintenance](PRODUCT-IMAGES.md) · [Audio content and playback plan](AUDIO-DEMO-PLAN.md)
· [Private beta and permanent grants](BETA-DISTRIBUTION-PLAN.md)
· [Future-build roadmap](FUTURE-BUILD-ROADMAP.md).

The audio schema and empty example are in `content/`; no tracks, settings or
approvals were invented. They parse and their references resolve, but no schema
validator or publication pipeline is integrated yet. Neither is served publicly.
Playback, invites, accounts, protected downloads, complimentary-license grants,
discounts and checkout remain future implementation work.

The preview server is running on loopback port 4175. For a fresh session use
`npm run dev` (default 4174), or set `PORT=4175` first. Rebuild after source edits;
the server is deliberately not a watcher. The reviewed visual changes are now
published; the planned functionality above remains inactive.
