# ProjectNebula beta distribution plan

**Status: architecture only, October 21, 2026.** No accounts, invitations, checkout, activation, installer delivery or feedback backend are implemented by this pass. No provider was provisioned and no production configuration changed.

## Permanent tester promise

Every personally invited tester receives a **permanently complimentary ProjectNebula entitlement**: no license expiration, commercial 1.0 and included maintenance updates, later retrieval of eligible releases, and no purchase requirement after beta. This covers ProjectNebula only; it does not grant unrelated products. Future major-upgrade coverage must be stated separately, without reducing this promise.

Use the stable catalogue ID `nebula`, independent of the working product name, URL slug and installer filename. Persist `grant_type=complimentary_beta`, `expires_at=null`, grant provenance and a versioned coverage policy. Keep grants exportable and backed up independently of any checkout provider.

| Item | What can expire | Effect on an existing entitlement |
| --- | --- | --- |
| Invitation | Redemption window; unused code can be disabled; single-use or explicit cap | None |
| Login / email-verification link | Session or verification-token lifetime | Sign in again; grant remains |
| Installer download URL | Short access window, initially five minutes | Request another eligible download |
| Complimentary product entitlement | No time-based expiration | Survives beta closure and campaign expiry |

**Website entitlement is not plugin activation.** It records the complimentary product grant and controls downloads. It cannot prevent redistribution of an already downloaded installer. Provider-generated license keys would require a separate, expressly authorized plugin-engineering integration; this plan adds no activation or online checks to the VST3.

## Reuse the current website

Keep the static storefront and the existing Vercel project. The [launch report](LAUNCH-REPORT.md) records the deployed `ekterp-bot/plugins` repository and `hex-solutions` Vercel project; older pending-rename notes are historical. Extend `api/` with small request/response functions in a future pass. Use one managed authentication service, one transactional database and private object storage; no microservices or job system are needed for the first beta.

Current source has no account, entitlement database or checkout integration. `src/catalog.mjs` keeps commerce disabled. `api/support.js` validates requests but returns 503 for valid submissions without sending or saving; `api/intake.js` is retired with 410. Preserve the existing contact address and mailto links. Do not reuse these endpoints as an invitation service or claim current email delivery works. The [email integration notes](EMAIL-INTEGRATION.md) are a starting point for checking existing sender infrastructure, not proof of a working transport.

## First beta workflow

1. An authenticated admin creates a random invite for `nebula`, normally single-use and bound to the intended email. Store only its keyed hash; show the code once for Hex to send personally. An optional campaign has its own redemption cap and deadline.
2. The tester signs in through managed authentication and verifies their email. The server checks the trusted verified-email claim; typing an address or receiving a checkout receipt alone is insufficient. Changed email addresses require verification again; grants follow the stable account ID.
3. Redeem through a server endpoint. In one database transaction, check status, expiry, email restriction and remaining uses; record the redemption and permanent entitlement. Uniqueness constraints and atomic counters prevent races. Retrying the same successful redemption returns the existing grant without consuming another use.
4. The account page shows “Complimentary ProjectNebula license — no expiration,” its coverage, approved releases and release notes. The tester can return after beta to retrieve eligible updates.
5. A download request verifies the session, entitlement, release eligibility and package approval, then issues a short-lived link to the private object. Show version, platform, checksum and installation guidance before download.
6. The tester submits private feedback associated with the exact release. The admin can review it alongside invitation, entitlement and download records.

Suggested future routes: `/beta/redeem`, `/account/downloads`, `/account/feedback` and protected `/admin/beta`. Corresponding APIs handle redemption, entitlement/release listing, download authorization and feedback. These are planned routes, not links to expose today.

## Minimum durable records

| Record | Required data / invariant |
| --- | --- |
| Account | Stable auth subject, verified email, verification timestamp; no application-managed passwords |
| Invitation | Code hash, product ID, optional intended email, campaign, expiry, maximum uses, used count, status, creator |
| Redemption | Invite, account, time; unique account/invite pair |
| Entitlement grant | Account, product, source, coverage-policy version, grant time, null expiry; preserve beta and purchase grants separately |
| Release | Product, version/build ID, channel, Windows/DAW requirements, immutable object key, size, SHA-256, signing verification, release notes, approval actor/time, availability |
| Download event | Account, release, authorization result and link issue/expiry times; separately record storage transfer evidence if available |
| Feedback | Account, release, Windows/DAW versions, sample rate/buffer, category, severity, steps, expected/actual behavior, review status |
| Admin / provider events | Actor, action, timestamp, reason and affected IDs; provider event ID unique for idempotency |

Issuing a link does not prove a completed download, installation or DAW test. Feedback starts with text fields; no song uploads, crash dumps or DAW projects by default. Provide scoped admin views, account recovery and an audited way to correct account associations. Back up grants and release metadata and test recovery before inviting testers.

## Installer protection and abuse controls

- Store approved installers in a private bucket, outside Git, `public/` and `dist/`. Immutable version-and-hash object keys preserve release history. Verify the package hash and Windows signing result against the engineering release record; explicit release approval is required. Unsigned or unapproved packages remain unavailable.
- An authenticated API checks access on every new link request. Serve the file directly from storage with a short-lived signed GET; keep authorization responses uncached. S3 is one concrete storage option. Its presigned links are bearer credentials, reusable until expiry, not inherently single-use or account-bound after issuance. Do not log or expose them in analytics. [AWS signed-link behavior](https://docs.aws.amazon.com/prescriptive-guidance/latest/presigned-url-best-practices/faq.html).
- Use cryptographically random invitation tokens with at least 128 bits of entropy; hash with a server-held pepper. Redact tokens, sessions, email-verification links and credentials from logs. Use generic redemption errors and shared rate limits for redemption, verification, download issuance and feedback.
- Require server-side authorization for every account/admin operation, secure HttpOnly session cookies, CSRF protection and MFA for admins. Apply least-privilege storage and database access. Validate input and limit request sizes.
- An admin can disable unused invites, inspect redemption counts, approve/withdraw a release and triage feedback. Withdrawing an unsafe build does not remove the product entitlement. Do not add an automatic license-expiry or “beta ended” revocation job.

## Checkout and promotional codes

Keep invitations separate from commercial discounts. Invited testers redeem directly without checkout or card details. A future 100% complimentary purchase is a different entry path that can create an equivalent permanent grant for the explicitly covered product.

Official documentation reviewed October 21, 2026:

| Candidate | Fit for this Windows plugin | Remaining work |
| --- | --- | --- |
| **Shopify — recommended catalogue baseline to evaluate first** | Established catalogue checkout; percentage/fixed discounts with product eligibility, total/per-customer limits and dates. Its Digital Products app delivers files after purchase. | Verify zero-total order behavior, software terms and costs. The app's delivery links do not by themselves establish this plan's account/entitlement and short-lived-download model. No host migration is needed. [Discounts](https://help.shopify.com/en/manual/discounts/discount-types/percentage-fixed-amount), [digital delivery](https://help.shopify.com/en/manual/products/digital-service-product/digital-downloads). |
| **Lemon Squeezy — software-focused alternative already proposed in the commercial plan** | Hosted checkout, percentage/fixed discounts with product scope, dates and redemption limits; optional generated software keys and License API. A closer fit if later software key management is a priority. | Confirm seller/product eligibility and test free-order fulfillment. Optional keys still require plugin integration; avoid subscription-linked licensing for permanent tester grants. [Checkout](https://docs.lemonsqueezy.com/help/checkout/hosted-checkout), [discount API](https://docs.lemonsqueezy.com/api/discounts/create-discount), [keys](https://docs.lemonsqueezy.com/help/licensing/generating-license-keys). |

Evaluate one provider in test mode before selection; do not install both or build custom card processing. The earlier [commercial plan](COMMERCIAL-PLAN.md) proposed Lemon Squeezy but did not activate a provider. This beta plan makes no procurement decision. The permanent grant ledger must work without either checkout provider, so beta can ship before commercial purchasing.

Promotions need a provider code/ID, campaign ID, eligible product/variant IDs, percentage **including 100%** or fixed amount in currency minor units, start/end timestamps, total cap, per-customer cap and stacking policy. Single-use means total cap 1; multi-use means an explicit cap. Show timezone clearly; initially disable stacking. Code expiry affects redemption, never an already issued permanent grant. Verify provider support and end-to-end behavior for every promised mode, especially a zero-total order without payment details; do not infer it from a discount percentage alone.

Create purchase grants only from authenticated server-to-server order evidence: verify webhook signatures, product mapping, order state and unique event IDs. Never grant access from a browser success redirect or an unverified checkout email. Link the order to the verified account through a server-validated association. Refunds affecting a purchase must not erase a separate complimentary-beta grant.

## Provider and environment requirements

Names below describe future server configuration, not variables added or credentials requested today.

| Capability | Configuration / account requirements |
| --- | --- |
| Managed auth | Issuer, audience/client ID, server credential where required, verified-email flow, exact callback origins, recovery and admin MFA |
| Transactional database | Server-only `DATABASE_URL`, migrations, backups, access policies, atomic redemption and webhook uniqueness |
| Invitation service | Server-only `INVITE_CODE_PEPPER`; rotation/version policy that preserves existing code validation |
| Private storage | Bucket, region/endpoint, scoped workload role or server credential, public access blocked, signed GET support; `DOWNLOAD_TTL_SECONDS` |
| Email | Reuse existing verified sender/provider if suitable after account inspection; auth verification delivery and optional notifications need a configured transport. Resend credentials/sender from historical notes are not confirmed active here. |
| Checkout, later | Selected provider account/approval, test-mode product IDs, server API credential, webhook signing secret and verified callback URL |
| Deployment | `SITE_ORIGIN`, separate preview/production auth, database and storage configuration; no preview access to production installers or customer data |

Keep secrets out of browser bundles, manifests, Git and screenshots. Retain the current host, contact routes and public release gates. Final provider-specific variable names and SDKs belong to the implementation pass after account capabilities are verified.

## Next development pass

Build a narrow private-beta flow first: verified sign-in → single-use invite → permanent grant → one signed, approved installer → feedback. Before inviting anyone, verify concurrent redemption, retries, expired/exhausted codes, unverified/other-account denial, unsigned-package denial, link expiry/renewal, retained access after invite/campaign expiry, and backup recovery. Exercise version eligibility and withdrawal without removing the grant. A later checkout pass tests percentage/fixed/100% codes, limits, expiry and webhook replay in provider test mode before enabling purchases.
