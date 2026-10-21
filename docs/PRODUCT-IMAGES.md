# Approved product imagery

Current selection: October 21, 2026, BP010 approved icons. Every product image
uses the same genuine compiled VST3 capture. No UI was repainted or invented.

## Source and evidence

`assets/products/nebula/bp010-approved-icons/compiled-original.jpg` preserves the
exact original bytes (1202 × 905, 133,049 bytes). `capture.json` records its
SHA-256, original engineering path, loaded module hash, build and evidence files.
The module matches the approved installed build
`BP010-0.1.0-Release-g9eda0638-sd2c7096d6719`.

The plugin client is x=1, y=24, 1200 × 880. Only native host chrome is removed.
The capture is silent because audio was disabled; the empty history and meters
are authentic. This is the largest complete capture found for the final icons.
Earlier 2400-pixel images show an older UI generation and are archived under
`assets/archive/bp009/`, outside the public build. Do not mix them back in or
claim that upscaling would add native detail. Engineering files were read only.

## Regenerate and replace

Run `python tools/prepare-product-images.py` with Pillow available. Python is
only needed for asset preparation; normal Node builds use committed derivatives.
The script checks the original hash before creating:

- Complete WebP images at 480, 768, 960 and 1200 pixels wide, quality 94.
- A 1200 × 880 lossless WebP for the enlarged viewer, checked pixel-for-pixel
  against the decoded original client rectangle.
- Four lossless control-detail crops, explicitly captioned as interface details.
- A 1200 × 630 JPEG sharing card with the complete interface and surrounding text.
- `src/product-images.json` for templates and `derivatives.json` for asset hashes.

For a future capture, preserve it in a new versioned folder; update the script's
source/output folder, capture metadata and crop geometry. Never overwrite the
original approved capture. Review the complete interface and all detail crops,
run the script, build, then inspect desktop/mobile and the full-size dialog.
Update this document and provenance. A renamed product also needs genuine newly
compiled imagery, updated social-card copy and the display fields in
`src/catalog.mjs`; stable `id: nebula` and the URL can stay unchanged.

Responsive `srcset` selects the complete image without cropping controls. Hero
images reserve intrinsic dimensions and use high fetch priority. Detail images
load lazily. The lossless full-size image has no `src` until the viewer opens.
At phone widths the dialog starts at native size with pan/scroll; a fit button
restores the complete view. There is no artificial high-resolution variant.

## Atmospheric artwork

Original approved cosmic WebPs are retained in `assets/atmosphere/`. Run
`python tools/prepare-atmosphere.py` to regenerate quality-88 desktop/mobile
derivatives. The composition, colors and existing lightweight motion remain;
no new animation loop was added. Mobile backgrounds total about 222 KB, versus
3.11 MB for the previous two files. Parent-brand logo assets are unchanged.

Product hero derivatives range from 34 KB to 146 KB, versus 674 KB/1.60 MB for
the old interface files. The optional lossless viewer is 524 KB. These are asset
byte counts, not measured page-speed scores or promises about network speed.

Only `public/` is copied into `dist/`. Original captures, evidence metadata,
historical images and future editorial manifests are not served.
