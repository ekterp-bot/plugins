# Hex the Engineer: commercial foundation

Research checked **October 19, 2026** against the official sources linked below. This is an implementation direction, not an activated merchant account, cleared product name, final offer, licence agreement or approval to sell a plugin.

## Recommended first release path

Keep the existing website hosting. For an initial downloadable-plugin catalogue, use **Lemon Squeezy hosted checkout and hosted product files**, subject to seller/product approval and an approved software release. The website remains the product and support experience; the provider handles checkout and customer purchase recovery. Basic hosted checkout and delivery do not require a new custom payment backend.

This recommendation is based on the combination of merchant-of-record handling, file delivery, customer order access and optional future licensing. It is not a finding that this account has been approved or that any provider has accepted the plugin. [Payments](https://docs.lemonsqueezy.com/help/payments), [product files](https://docs.lemonsqueezy.com/help/products/adding-products), [customer orders](https://docs.lemonsqueezy.com/help/online-store/my-orders).

Do not migrate the website to another host solely to add a checkout button. Confirm the actual hosting project, deployment root, domain and runtime first. A repository containing `api/*.js` is not evidence of a deployed server runtime; the presence of `.nojekyll` is not proof of the live hosting provider either. The Vercel connector was unauthenticated during this pass, so production configuration was not audited.

## Provider comparison

| Option | Tax/payment role | Delivery and software implications | Fit |
| --- | --- | --- | --- |
| Lemon Squeezy | Merchant of record for its transactions | Hosted product files and customer downloads; optional key generation and file versions | Recommended first path, conditional on approval |
| Paddle Billing | Merchant of record | Paddle-led product delivery and key generation are deprecated; build fulfillment with webhooks and separate entitlements | Reconsider if the catalogue needs more elaborate billing/subscriptions |
| Ordinary Stripe Checkout / Payment Links | Hex remains merchant of record | Hex must arrange tax obligations, fulfillment, entitlements and any licensing | More control, more operational responsibility |
| Stripe Managed Payments | A separate Stripe merchant-of-record offering for eligible digital products | Eligibility/onboarding must be confirmed; do not assume a desktop licensing/update system is included | A current alternative worth assessing if Stripe infrastructure becomes established |

Sources: [Paddle Billing feature comparison](https://developer.paddle.com/migrate/learn/feature-comparison/), [Stripe merchant-of-record distinction](https://stripe.com/resources/more/merchant-of-record), [Stripe Managed Payments](https://docs.stripe.com/payments/managed-payments), [Stripe fulfillment](https://docs.stripe.com/checkout/fulfillment).

Avoid the outdated claim that Stripe never acts as merchant of record: ordinary Stripe processing and Stripe Managed Payments are different arrangements.

## Commercial decisions before activation

1. **Seller and product approval.** Lemon Squeezy requires business information and identity verification. Paddle requires domain, business where applicable, and identity review. Confirm supported seller location and payout arrangements; approval is not guaranteed. [Lemon Squeezy activation](https://docs.lemonsqueezy.com/help/getting-started/activate-your-store), [Paddle verification](https://www.paddle.com/help/start/account-verification/what-is-account-verification).
2. **Offer.** A one-time plugin purchase is the proposed simple starting model, not a finalized commitment. Set price, supported systems, included updates, major-version policy, support scope and licence rights before adding a live checkout URL. Review all provider, payment-method, international and payout fees in the actual plan. [Lemon Squeezy fees](https://docs.lemonsqueezy.com/help/getting-started/fees).
3. **Tax responsibility.** Merchant-of-record handling addresses transaction sales taxes within that arrangement. It does not remove Hex's income-tax or other business obligations. Confirm the treatment of payouts with the business's tax adviser. [Sales tax and payout income](https://docs.lemonsqueezy.com/help/payments/sales-tax-vat).
4. **Release approval.** Storefront completion does not establish plugin stability, musical quality or release readiness. Release licence review, approved packaging and any engineering release blockers remain separate. No private-beta binary is authorized for public distribution by this plan.

## Fulfillment, updates and licences

Use only an explicitly approved package. Record its version, platform, binary/package hashes, requirements and release notes. Do not place a paid or private-beta binary in publicly served site assets. Retain recoverable earlier packages separately.

The initial purchase flow can be: product page → provider checkout → provider receipt/customer orders → approved download and installation guide. Make purchase recovery and technical support visible. Lemon Squeezy supports software files and version labels; a custom updater would require additional engineering. [Files](https://docs.lemonsqueezy.com/help/products/adding-products), [versions](https://docs.lemonsqueezy.com/help/products/managing-file-versions).

**Purchase rights and activation enforcement are separate.** Lemon Squeezy can generate keys, expiry rules and activation limits, but these do not make the current VST3 enforce them. Do not enable key generation or promise machine limits, offline activation, automatic updates or revocation until those requirements are approved and the plugin supports them. No activation or licensing code is added to the VST3 by the website work. [Key generation](https://docs.lemonsqueezy.com/help/licensing/generating-license-keys).

Keep each product's availability, platform, offer and eventual provider IDs/checkout URLs in replaceable configuration. An unset checkout or download URL must produce an honest unavailable state. A success redirect is not proof of payment. If custom fulfillment is introduced later, verify provider signatures, persist event IDs, handle retries idempotently and confirm payment state server-side. [OWASP webhook guidance](https://cheatsheetseries.owasp.org/cheatsheets/Webhook_Security_Cheat_Sheet.html).

## Trial, refund and update flow

- **Trial:** leave availability and length pending. Lemon Squeezy's documented free trial is a subscription billing feature; it does not create a time-limited desktop-plugin demo. Any demo build and enforcement need a separate engineering decision. Do not introduce a subscription simply to obtain a trial. [Free trials](https://docs.lemonsqueezy.com/help/products/free-trials).
- **Refund:** publish an approved policy and support route before sales. Do not claim unconditional refusal of refunds: Lemon Squeezy reserves discretion to refund within 60 days to prevent chargebacks. Provider fees and disputes can affect payouts. If future entitlements exist, update them from confirmed provider events rather than a browser request. [Refunds and chargebacks](https://docs.lemonsqueezy.com/help/payments/refunds-chargebacks).
- **Updates:** define what the purchase includes and how customers recover downloads. Never promise lifetime updates or an automatic updater without a deliberate product decision and supporting implementation.
- **Support:** use the fixed-recipient support design in [EMAIL-INTEGRATION.md](EMAIL-INTEGRATION.md). Support requests do not constitute newsletter opt-in.

## Validation and launch gates

Provider sandbox testing is a later authorized step, not performed here. Validate checkout completion/cancellation, receipt recovery, invalid and duplicate webhook events if used, refunds and customer downloads. Lemon Squeezy test mode supports checkout, keys and webhooks but **disables file downloads**. A passing sandbox purchase cannot prove real delivery; record that limitation and complete a separately authorized delivery check before launch. [Test mode](https://docs.lemonsqueezy.com/help/getting-started/test-mode).

Keep commerce disabled until the owner has approved the provider account, final offer/policies, name/licence review, release package, delivery validation and actual production destination. No payments, provider accounts, public downloads, customer uploads, DNS changes or production deployments were activated in this pass.
