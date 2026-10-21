# Next storefront passes

October 21, 2026. Visual finalization is local and awaiting review. No push or
production deployment is part of this pass. Existing Vercel project
`hex-solutions` builds `dist/` with `npm run build`; production tracks `main`.
A branch push can also trigger a remote preview, so keep this commit local.

| Capability | Current implementation | Next step |
| --- | --- | --- |
| Product presentation | Real BP010 imagery, responsive variants, image viewer, six pages | Review local desktop/mobile presentation, then separately approve publication |
| Audio comparisons | Existing clearly labeled visual placeholder; no playback | Hex supplies permissioned genre examples and exact settings; implement [audio plan](AUDIO-DEMO-PLAN.md) |
| Support | Existing contact email link works; form validates locally only, API fails closed without delivery | Verify existing sender infrastructure, then authorize a real support/feedback transport |
| Private beta | Architecture only; no auth, codes, grants or installer links | Implement verified sign-in → invite → permanent complimentary grant → approved private installer → feedback |
| Commercial sales | No checkout, prices, discounts, activation or purchasing | Evaluate provider in test mode after beta access works; verify free/discounted purchases and durable fulfillment |
| Public trials / downloads | Placeholder status only | Define trial behavior, qualification and approved signed release before distribution |

The [beta distribution plan](BETA-DISTRIBUTION-PLAN.md) describes permanent tester
coverage, secure invitations, protected delivery, future promotion types and
provider/environment requirements. No account or credentials are needed to run
today's preview. Do not add future secrets to `.env.example` as though an
integration already exists.

The first follow-up can implement the static audio content/player when approved
material is ready. In parallel, prepare the beta provider decision and approved
installer requirements. Beta entitlements must remain permanent regardless of
code or download-link expiration. Plugin activation is a separate engineering
decision; this website does not implement or claim it.

Preserve the current domain, Vercel Git connection, contact address, mailto links,
support validation and retired intake endpoint. Reuse `api/` for future small
server endpoints; keep this static storefront and avoid an unnecessary rewrite.
The earlier launch and implementation reports remain historical records.
