# Hex the Engineer website — asset provenance

Recorded October 19, 2026, America/Los_Angeles. All work described here is confined
to the isolated `codex/hex-plugin-storefront` website worktree. The EarWax VST3
engineering checkout and previous Nebula prototype were read only.

## Served product captures

The current image source is the newest BP009 compiled Release editor-harness
capture available at selection time. It includes the continuous PROJECTNEBULA
wordmark and four distinct vector icons. The engineering report
`C:\Users\ekter\Documents\ChatGPT\EarWax\docs\BP009-VISUAL-VALIDATION.md`
records review of all eight image sizes and passing diagnostic editor checks.
It explicitly identifies this as a **dirty development build**, not a sealed
release, installed VST3 observation, DAW qualification or human listening result.

| Served path | Dimensions | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| `/assets/plugin-interface.webp` | 2400 × 1760 | 1604958 | `012159D2C786963C3DC9B6230C8C56253F6D5FA31EA63EB80A19F7F15F0BDBF9` |
| `/assets/plugin-interface-small.webp` | 1200 × 880 | 673552 | `EC4146152EDD3BE5E278F4E3D40D7952A83D2D836D2EB879AA493A296AE744A6` |

Original sources, retained unchanged in the engineering checkout:

- `C:\Users\ekter\Documents\ChatGPT\EarWax\artifacts\BP009\diagnostic-editor-Release\EarWax-1200x880-200pct.png`
  — 2476059 bytes, SHA-256
  `07B949A96E936AE791E559E74E2CE0A175A84CF865593ED40D7C3700BE5974C5`.
  Timestamp: `2026-10-20T03:41:18.3760859Z`.
- `C:\Users\ekter\Documents\ChatGPT\EarWax\artifacts\BP009\diagnostic-editor-Release\EarWax-1200x880.png`
  — 1043214 bytes, SHA-256
  `1D0BF163B0445DAB3BC9D06AE1574D0BC7F212B32AFE87CBD9A7DE3BE44DF4E5`.
  Timestamp: `2026-10-20T03:41:12.5374479Z`.

The smaller file is a separate native-size render, not a resized hero image.
The upper panel shows sampled level/reduction history, not a frequency spectrum.
Meters are driven by synthetic test audio. The galaxy is decorative. Website
ambient motion, if present, is separate from these static component captures.

The latest sealed and installed engineering checkpoint remains private-beta
BP008 `BP008-0.1.0-Release-g743c73a9-s98a1f880e64c` at inspection. BP009 is ongoing;
the visual preview does not authorize a download or imply release readiness.

## Original cosmic artwork

| Served path | Dimensions | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| `/assets/cosmic-field.webp` | 1536 × 1024 | 1635462 | `958D978F8A227D3D3CA2F30F782ED6F635DDB5D4E2E428B09B9A6091EE5E352D` |
| `/assets/galaxy-cloud.webp` | 1983 × 793 | 1473152 | `1EF19268073E1F5A5E34901BAE44F0E36BE5514CE7072046B96AB219B13B827D` |

Source PNGs were reused from the previous isolated prototype:

- `C:\Users\ekter\.codex\worktrees\earwax-commercial-research\EarWax\website\nebula-prototype\dist\assets\cosmic-field.png`
  — 2314226 bytes, SHA-256
  `24B41E009AD2F391E591B40D210FDB304DD02F52ECF339B74F79DB1BA9C0C88E`.
- `C:\Users\ekter\.codex\worktrees\earwax-commercial-research\EarWax\website\nebula-prototype\dist\assets\galaxy-cloud.png`
  — 2069969 bytes, SHA-256
  `2D1D11666CFBF4B05ED627F2748246409D2C31D79FA50D8063F142C7883CAB79`.

Those source bytes match the original engineering assets
`C:\Users\ekter\Documents\ChatGPT\EarWax\assets\nebula\cosmic_field.png`
and `galaxy_cloud.png`. Their original provenance in that directory records
creation October 17, 2026 through OpenAI's built-in image-generation tool for this
product. Original generation prompts remain there. No stock photo was introduced
for this website pass. This is provenance, not an assertion of exclusive rights.

## Lossless encoding and preservation

All four PNGs were encoded with bundled Pillow's WebP encoder using
`lossless=True, quality=100, method=6, exact=True`. Every decoded RGBA pixel,
including RGB values under transparent pixels, was compared byte-for-byte with
the corresponding original and **all four comparisons passed**. Dimensions and
alpha were preserved. There was no cropping, resizing, compositing, recoloring,
generative edit or interface reconstruction.

Only the optimized WebP files are served to avoid redundant public PNG payloads.
Original PNGs remain at the preserved source paths above; no original was moved
or deleted. The four WebPs total 5387124 bytes, versus 7903468 source PNG bytes.

## Original SVG marks

- `/assets/hex-mark.svg` is original vector artwork created for this prototype:
  a white geometric H inside a fine cyan hexagon, with restrained pale edge
  accents. It is 367 bytes, `viewBox="0 0 64 64"`, SHA-256
  `317CDA1FF0C8A000C83D31A63EC5C9B0F369736DF0392627FD38C55038AF06EF`.
- `/assets/nebula-mark.svg` is reused byte-for-byte from
  `C:\Users\ekter\.codex\worktrees\earwax-commercial-research\EarWax\website\nebula-prototype\dist\assets\nebula-mark.svg`.
  It is the earlier website's original three-orbit mark, 501 bytes,
  `viewBox="0 0 64 64"`, SHA-256
  `190A9D01FF357288603B89E58784BDF0C21387DAA3351A571FE2A77C441E89FB`.
  It is website vector artwork, not an extracted raster screenshot region.

Neither mark nor working name is an assertion of trademark clearance. Keep
company and product identity independently replaceable. A future approved
product name also requires a replacement compiled interface capture because
the current product wordmark is present in the actual screenshot pixels.

## Self-hosted fonts and notices

Fonts and complete OFL licences are reused byte-for-byte from the previous
prototype's `dist/assets/fonts`. All destination bytes were compared with the
previous prototype and matched. The original download was October 18, 2026 from
the official `google/fonts` repository. No fonts were modified or subsetted.

| Local path under `/assets/fonts/` | Bytes | SHA-256 |
| --- | ---: | --- |
| `Manrope-Variable.ttf` | 164700 | `3AE11C49DB0455A3CC33E37D380F20FDB8C7F8B41DC07625C177E3D87A9D6AE6` |
| `Manrope-OFL.txt` | 4387 | `58172E0C0FAC2CDA8A37B348164BB55E44B0E69051E557E92B1D3F6910141F7B` |
| `SpaceGrotesk-Variable.ttf` | 136676 | `ACAD6DE1FC93436F5C0F1F4137751EF04F1AEA3063E7036535970FFCFBD79F72` |
| `SpaceGrotesk-OFL.txt` | 4495 | `564CE565C371C5E5BBF286006565A7C9AA55A9F56E7CA58D56E05D649DD61A72` |

Official original URLs:

- https://raw.githubusercontent.com/google/fonts/main/ofl/manrope/Manrope%5Bwght%5D.ttf
- https://raw.githubusercontent.com/google/fonts/main/ofl/manrope/OFL.txt
- https://raw.githubusercontent.com/google/fonts/main/ofl/spacegrotesk/SpaceGrotesk%5Bwght%5D.ttf
- https://raw.githubusercontent.com/google/fonts/main/ofl/spacegrotesk/OFL.txt

Manrope: Copyright 2018 The Manrope Project Authors. Space Grotesk: Copyright
2020 The Space Grotesk Project Authors. Both are under SIL Open Font License 1.1;
their full unmodified notices remain beside the font files. Font use requires no
remote runtime service.
