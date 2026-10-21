# Storefront visual finalization — October 21, 2026

**Ready for local review. Not published.** Preview:
[localhost:4175](http://localhost:4175/), with the
[product page](http://localhost:4175/plugins/project-nebula).

Work remains in `C:\Users\ekter\.codex\worktrees\hex-plugins-website`, branch
`codex/hex-plugin-storefront`. The starting tree was clean at `5b7203d`. No push,
Vercel action, repository rename or engineering modification was made. Current
deployment configuration still builds `dist/` on the existing Vercel project;
production tracks `main`. The report is included in the local implementation commit.

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
the server is deliberately not a watcher. Review first; publishing needs a new
explicit approval for this pass.
