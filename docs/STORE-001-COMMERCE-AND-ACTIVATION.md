# STORE-001 commerce, activation and installer handoff

Research checked **October 21, 2026**. This is the future-commerce and Core
Engineering handoff plan. Checkout, discount redemption and plugin activation
are **not implemented by STORE-001**. No provider account, paid service or live
transaction is authorized by this document. The implementation/setup report
records which account, invitation and download flows have actually been tested.

## Provider recommendation

Evaluate **Lemon Squeezy first**, subject to seller/product approval and a focused
test-mode checkout. It fits a small catalogue of one-time software purchases and
has optional license-instance APIs. Use its single-payment product model; a
subscription is unnecessary for a permanent ProjectNebula license. Lemon Squeezy
acts as merchant of record for its transactions, including payment handling,
sales-tax collection, refunds and chargebacks. This recommendation supersedes
the Shopify-first comparison in the earlier architecture-only
[beta plan](BETA-DISTRIBUTION-PLAN.md), following STORE-001's explicit request to
evaluate a software merchant of record.
[MoR responsibilities](https://docs.lemonsqueezy.com/help/payments/merchant-of-record),
[software keys](https://docs.lemonsqueezy.com/help/licensing/generating-license-keys).

| Candidate | Fit and tradeoff |
| --- | --- |
| **Lemon Squeezy — first evaluation** | Hosted software checkout, optional license activation limits, scoped percentage/fixed discounts and dated campaigns. Its documented product/variant/price APIs expose retrieval and listing, so price publication initially requires provider-dashboard work followed by reconciliation. Seller review must explicitly accept our private account-based fulfillment. |
| **Paddle — alternative** | Its current digital-products guide explicitly supports one-time software licenses and plugins as merchant of record. It supports API-managed products/prices and percentage/fixed discounts. Our service would still implement the entitlement and activation layer. Prefer it if automated catalogue management or its commercial terms outweigh Lemon Squeezy's optional key service. |

Sources: [Lemon Squeezy activation and fulfillment eligibility](https://docs.lemonsqueezy.com/help/getting-started/activate-your-store),
[price API](https://docs.lemonsqueezy.com/api/prices/the-price-object),
[Paddle digital products](https://developer.paddle.com/get-started/how-paddle-works/digital-products/),
[Paddle products/prices](https://developer.paddle.com/build/products/create-products-prices/).

Published headline fees currently start at **5% + $0.50 per transaction** for
both. Lemon Squeezy documents extra fees for international and PayPal transactions
and some payout/marketing features; Paddle advertises an inclusive pay-as-you-go
rate without a monthly fee. Compare the actual account offer, supported seller
country, settlement currency and payout terms before selection. These figures
are research, not a purchase or cost commitment.
[Lemon Squeezy fees](https://docs.lemonsqueezy.com/help/getting-started/fees),
[Paddle pricing](https://www.paddle.com/pricing).

## Account, order and entitlement boundaries

The verified account ID and stable product ID `nebula` are ours. Provider
customer IDs, order IDs, receipt links and optional license-key IDs are mappings;
they never replace the account or permanent-grant ledger. Back up and export
grants with their source and coverage independently of the checkout provider.

Preserve separate grant evidence for `complimentary_beta`, a future purchase and
a future complimentary checkout campaign. Tester grants have no expiry and cover
ProjectNebula 1.0 plus included maintenance updates, with no subscription, payment
or future charge. Other products and future major-upgrade coverage require their
own explicit policy. Expiring an invite, campaign, session or download URL must
not expire the resulting grant.

A future server-created checkout attempt binds the authenticated account to an
opaque attempt ID, approved product/price mapping and environment. Save the
provider checkout/order relationship. Treat returned metadata as a reference to
that saved attempt, not permission to choose any account or product. Grant only
after verified server-to-server order evidence; redirects and receipt emails are
not fulfillment evidence. An unmatched order enters an audited claim/recovery
flow requiring ownership verification.

Orders retain currency, integer monetary totals, provider line-item IDs, relevant
tax/discount totals, status and timestamps. A uniqueness constraint on provider,
environment, order and line item prevents repeated purchase grants. Compute
library access from all eligible grant sources: refunding one purchase must
never remove a separate complimentary tester grant.

## Draft pricing and future promotions

STORE-001 prices remain **draft/prelaunch**. Saving an admin price changes local
configuration only. Store regular and optional promotional amounts as integer
currency minor units with an ISO currency code; convert decimal input exactly,
validate supported currency precision, and never calculate money using binary
floating-point arithmetic. Zero is a valid explicit promotional price; absence
is a separate value.

A later integration adds immutable price revisions, provider product/variant/
price IDs, environment, sync status and the last verified provider amount.
Publication is an explicit operation: validate the draft, publish through a
supported provider operation, fetch it back, then mark the matching revision
synced. Keep checkout disabled on a mismatch. For Lemon Squeezy, initially use
its dashboard and readback; do not invent a write-price endpoint. Its price
objects preserve historical prices when a variant price changes.
[Lemon Squeezy price semantics](https://docs.lemonsqueezy.com/api/prices/the-price-object).

Future campaign configuration needs:

- Percentage discounts, including a required **100%** mode, or a fixed amount
  with its currency; eligible products/prices and a campaign ID.
- Start/end timestamps stored in UTC and shown with timezone; total redemption
  cap, optional per-account cap, status and provider discount ID.
- Explicit stacking policy (initially disabled), audit trail and test/live
  separation. A promotional price is not automatically an additional discount.

Lemon Squeezy documents product-scoped fixed/percentage discounts, start/end
dates and redemption limits. Paddle's API expressly permits 100% discounts,
fixed amounts, product restrictions, expiry and overall usage limits. Neither
reference establishes the entire required no-card zero-total workflow: test
100% fulfillment and receipt behavior before advertising it. Direct tester
invitations already bypass checkout and must continue to do so.
[Lemon Squeezy discount API](https://docs.lemonsqueezy.com/api/discounts/create-discount),
[Paddle discount API](https://developer.paddle.com/api-reference/discounts/create-discount/).

Do not promise strict per-account or concurrent redemption limits merely because
a provider has a cap field. Paddle explicitly warns that simultaneous checkouts
can exceed its overall usage limit. For a strict campaign, reserve eligibility
transactionally in our service, restrict checkout entry accordingly, expire
abandoned reservations and reconcile completed orders. Verify that the chosen
provider flow cannot bypass those controls. Single-use tester invitations remain
our own atomic operation and are never implemented as a public discount code.
[Paddle cap behavior](https://developer.paddle.com/api-reference/discounts/create-discount/).

## Webhooks, refunds and recovery

The future handler must verify signatures over the unmodified request body
before processing, limit request size, separate test/live secrets and validate
store, product, currency and order state. Lemon Squeezy uses `X-Signature` with
HMAC-SHA256; Paddle uses `Paddle-Signature` with a signed timestamp and body.
Use maintained verification helpers where available, constant-time comparison
and the provider's timestamp policy where supported.
[Lemon Squeezy signatures](https://docs.lemonsqueezy.com/help/webhooks/signing-requests),
[Paddle signatures](https://developer.paddle.com/webhooks/about/signature-verification/).

Persist a receipt and processing state before acknowledging success; keep
retries safe. Paddle supplies `event_id` for deduplication. Lemon Squeezy's
documented payload is a resource snapshot, so do not confuse `data.id` (order
ID) with a unique event ID. Record a verified payload digest/type/resource
identity for delivery deduplication, plus the durable order-line uniqueness
constraint for fulfillment. Reconcile current order state through the provider
API when events are stale, reordered or ambiguous; a late creation event must
not reinstate a refunded purchase. Keep a recoverable failed-event list and an
owner-triggered reconciliation path.
[Paddle delivery model](https://developer.paddle.com/webhooks/about/how-webhooks-work/),
[Lemon Squeezy payload/retries](https://docs.lemonsqueezy.com/help/webhooks/webhook-requests).

Lemon Squeezy's `order_refunded` includes full **and partial** refunds. Record
the financial adjustment before deciding its access effect; do not revoke a
whole product for every partial refund. Apply the eventual published refund
policy only to the affected purchase grant, retain historical evidence and
audit the reason. Unclear line allocation or chargeback state requires review.
Withdrawing an installer is separate from revoking a grant. Never delete the
permanent tester grant as a side effect.
[Lemon Squeezy event semantics](https://docs.lemonsqueezy.com/help/webhooks/event-types).

## Future two-computer activation contract

The intended policy is **two simultaneously authorized computers per license**
and unlimited authorized installer downloads. Multiple evidence sources for the
same account/product do not silently multiply the seat allowance. STORE-001
records the policy only; it shows no invented device list or enforcement claim.

A separately authorized Core Engineering pass would add:

| Proposed API | Required behavior |
| --- | --- |
| `POST /licensing/activations` | Verify account/entitlement and client proof; atomically reserve one of two seats. Idempotent retry of the same activation returns the same seat. |
| `POST /licensing/activations/{id}/refresh` | Recheck eligible grant sources and issue a signed, versioned offline authorization certificate. |
| `GET /licensing/activations` | Return only the customer's real activations, with customer-chosen labels and minimal metadata. |
| `POST /licensing/activations/{id}/deactivate` | Release the owned seat idempotently. Support replacement of a lost/reinstalled computer through recent account verification and an audited recovery action. |

Core Engineering must select a supported, privacy-minimizing installation
identity and secure local storage. This plan specifies no hardware fingerprint.
Do not treat a random installation label as proof that cloning is impossible.
Keep signing keys server-side; ship only verification keys with rotation support.
Lemon Squeezy instances could be an adapter for purchased licenses, but tester
activation must work from our independent grants without manufacturing a paid
order. Its API supports activation and instance deactivation; it does not add
verification to a VST3 automatically.
[Activate](https://docs.lemonsqueezy.com/api/license-api/activate-license-key),
[deactivate](https://docs.lemonsqueezy.com/api/license-api/deactivate-license-key).

**Proposed offline policy for owner/Core approval:** once activated, a signed
certificate continues to authorize the covered installed version offline,
without an expiring product entitlement or a connectivity requirement during
audio work. Refresh and account recovery happen outside audio processing.
Indefinite offline use means a physically offline old installation cannot learn
about remote deactivation immediately; an absolute simultaneous-device limit
cannot be guaranteed. If bounded offline leases are preferred, approve their
validity, grace and recovery behavior before implementation and communicate
them before sale. Never silently mute a session because a network request fails.
No DSP, JUCE, host IDs or plugin-state changes belong to STORE-001.

## Installer handoff and release gate

Until Core Engineering supplies an owner-approved package, use a harmless
private text/test file clearly labeled **Distribution test artifact — not a
ProjectNebula installer**. Never give external testers a placeholder as the
plugin or upload a local beta merely because its filename looks current.

Core hands over an immutable package and release record containing product ID,
semantic version and build ID, Windows x64/VST3 platform/format, beta/stable
channel, byte size, SHA-256, release notes, compatible update coverage, package
and source-attestation references, signing result and release approval actor/
time. Record the installer Authenticode identity/timestamp and verification
evidence; do not substitute a binary hash for signing or claim signing for an
unsigned private build. The standing release gate requires a signed approved
installer. An unsigned private-test exception requires explicit owner approval
of that exact artifact and scope before availability.

Upload to private storage under a version/hash-specific object key, then verify
downloaded bytes against the approved record before enabling availability.
Publication approval and availability are separate fields; withdrawing a build
keeps its record and all customer entitlements. Issue short-lived URLs only
after checking account, grant coverage and release availability. Download logs
describe authorization/link issuance unless storage separately proves transfer;
they do not prove installation or listening. Never put installers in Git,
public assets or the website deployment bundle.

Before real distribution, verify one authorized download and checksum, denial
without entitlement, link expiry/renewal, release withdrawal, and a returning
tester retaining access without a new invitation. No live website publication,
provider provisioning, paid transaction, system installation or external tester
distribution is approved by this plan.
