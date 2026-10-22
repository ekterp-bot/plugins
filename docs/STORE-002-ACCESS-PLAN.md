# STORE-002 tester access and $0 capacity plan

Reviewed **October 22, 2026 UTC / October 21 Pacific**. This is a prepared plan,
not permission to expose the portal or release the installer. The completed
package is now uploaded privately as a disabled draft. No external sharing token,
new service or paid commitment was created.

## Decision

Reuse the existing **private Supabase Storage bucket** for the installer plus
mandatory notices. For external portal access, the narrowest change compatible
with the current app is **one Vercel shareable link for the existing preview
branch**. Keep project-wide Deployment Protection enabled and preserve the app's
verified-email, live-session, owner and permanent-entitlement checks.

**External access remains held.** The previously verified Vercel Hobby plan is restricted to
personal, non-commercial use. A company plugin storefront/beta portal appears to
fall within Vercel's commercial-use definition even while checkout is disabled;
this is an application of the published policy, not a provider determination.
Resolve eligibility before enabling sharing. A new Hobby project does not resolve
that restriction. [Vercel fair-use guidelines](https://vercel.com/docs/limits/fair-use-guidelines)

## Known setup and evidence boundary

| Item | Evidence |
| --- | --- |
| Website checkout | `codex/hex-plugin-storefront` in the retained marketing worktree. Local status/worktrees inspected before this document was added. |
| Existing Vercel target | Repository records identify team `ekterp-bots-projects`, project `hex-solutions`, production branch `main`. STORE-001 records private hosted validation at the preview branch alias below. |
| Exact allowed hosted origin | `https://hex-solutions-git-codex-hex-plugin-fdcb17-ekterp-bots-projects.vercel.app`, from `server/store-config.mjs`. Localhost port 4176 is the only other allowed origin. Arbitrary deployment hosts are rejected; `VERCEL_ENV` must be `preview`. |
| Vercel plan/protection live recheck | The read-only Vercel connector required reauthentication; this pass stopped that path without a login loop. Hobby was verified previously, not freshly rechecked here. Existing sharing-link inventory and capacity remain unverified. STORE-001's recorded anonymous `/account` request redirected to Vercel SSO. |
| Supabase project | Read-only connector confirmed `hex-store-001-preview`, project `pujpznngwcgutujqgmkp`, region `us-west-1`, `ACTIVE_HEALTHY`. |
| Supabase plan | Read-only organization lookup confirmed organization `azcqawefzjsywbtadmpo` has `plan=free`, `tier=tier_free`. |
| Existing release storage | `store-installers` remains private. After uploading the single STORE-002 ZIP as a disabled draft, it contains **4 objects totaling 9,031,152 bytes**: 349 previous test bytes plus the 9,030,803-byte ZIP. Bucket-specific `file_size_limit` was unset at inspection; the Free project upload limit still applies. This does not measure whole-organization usage or billed storage averages. |
| Remaining allowance | Current organization egress, billing-period storage average, other project usage, email-provider allowance and Vercel usage were not obtained. Published quotas are capacity ceilings, not confirmed remaining balance. |

The [STORE-001 implementation record](STORE-001-IMPLEMENTATION.md) and
[database contract](STORE-001-DATABASE.md) document the existing account,
entitlement and owner checks. A shareable Vercel link is only an outer portal
access mechanism: possession grants no account identity, administrator role or
ProjectNebula entitlement. Treat the link as forwardable access to the login page,
not as an email-bound invitation or a license.

## Private storage capacity

Current Supabase Free pricing includes **1 GB file storage**, **50 MB maximum
upload size**, **5 GB uncached egress** and a separate **5 GB cached egress** quota.
It also includes 500 MB database space per project and 50,000 monthly active
users. Free projects may pause after one week of inactivity, so this is not an
availability guarantee. [Supabase pricing](https://supabase.com/pricing)

The egress allowance is shared by Database, Auth, Storage and other Supabase
services. Cached and uncached allowances are separate; they cannot be treated as
one interchangeable 10 GB download allowance. Budget private signed downloads
as uncached unless actual usage proves otherwise. [Supabase egress accounting](https://supabase.com/docs/guides/platform/manage-your-usage/egress)

Usage quotas aggregate across the organization, not just this preview project.
Storage accounting is an average across the billing period using GB-hours, so a
live object total is not the billing reading. [Organization billing](https://supabase.com/docs/guides/platform/billing-on-supabase),
[storage-size accounting](https://supabase.com/docs/guides/platform/manage-your-usage/storage-size)

The local DIST-001 handoff EXE was read and independently rehashed for this plan:

- File: `ProjectNebula-Setup-0.1.0-Win64.exe`
- Exact length: **9,818,339 bytes** = 9.818339 decimal MB = approximately 9.3635 MiB.
- SHA-256: `B4A204896B91D23C785E0B488880CDA9682927E80B48B887494AAF2D4A3BF52F`.
- Build identity in its release manifest: `BP010-0.1.0-Release-g9eda0638-sd2c7096d6719`.
- Source: engineering `dist/DIST-001-ProjectNebula-0.1.0-b4a204896b91`.

The EXE alone is **not** the complete customer package. The measured
`ProjectNebula-0.1.0-Win64-private-beta.zip` is **9,030,803 bytes** = 9.030803
decimal MB = approximately 8.6124 MiB, with SHA-256
`432813213018f53a2eb69ded2ef7eba3b487d8b9668a60001b53fc50631aee19`.
Its 45 entries contain the unchanged EXE, 40 DIST-002 notice files and four
customer documents. This complete ZIP is the private draft download object;
the EXE has not been uploaded separately. The following budget replaces the
earlier 10 MB planning estimate with the measured ZIP length.

For conservative planning, the following arithmetic uses decimal GB
(`1 GB = 1,000,000,000 bytes`) and counts one complete transfer per download:

| Complete transfers | Exact EXE bytes only | Measured complete ZIP |
| --- | ---: | ---: |
| 25 | 245,458,475 bytes / 0.2455 GB | 225,770,075 bytes / 0.2258 GB |
| 50 | 490,916,950 bytes / 0.4909 GB | 451,540,150 bytes / 0.4515 GB |
| 100 | 981,833,900 bytes / 0.9818 GB | 903,080,300 bytes / 0.9031 GB |
| 200 | 1,963,667,800 bytes / 1.9637 GB | 1,806,160,600 bytes / 1.8062 GB |
| 400 | 3,927,335,600 bytes / 3.9273 GB | 3,612,321,200 bytes / 3.6123 GB |
| 500 | 4,909,169,500 bytes / 4.9092 GB | 4,515,401,500 bytes / 4.5154 GB |

At zero other usage, 5 billion bytes fit **509 EXE-only transfers** or **553
complete ZIP transfers**. Reserving 1 GB for other traffic/retries leaves **407
EXE-only transfers** or **442 complete ZIP transfers**. These are mathematical
ceilings, not promised user counts or free-download entitlements. One tester may
download repeatedly, interrupted requests can retry, and importer byte
verification itself downloads the object. A 25-person batch with two complete
ZIP transfers each would consume 451,540,150 bytes (about 0.452 GB); this is an operating estimate,
**not a two-download limit**.

The current 9,031,152-byte private inventory retained all month consumes about
0.9031% of the 1 GB storage allowance, before any other organizational storage.
The installer and notices are inside the one ZIP, so they do not add duplicate
stored bytes. Preserve local validated archives. Keep only required immutable
release objects in private Storage, and budget each retained version. No storage
upgrade is indicated by this one artifact's size.

Before the first external batch, inspect the organization's current usage and
recalculate `(remaining uncached bytes - reserve bytes) / measured ZIP bytes`.
Review usage after the batch; if headroom is inadequate, pause new invitations
or download availability without deleting permanent grants. Free-limit breaches
can restrict service after notification; do not assume a free tier silently
provides unlimited overage. [Supabase billing FAQ](https://supabase.com/docs/guides/platform/billing-faq)

The expected incremental storage/download charge is **$0 only while the current
Free organization remains within its allowances**. Paid Supabase egress rates
are $0.09/GB uncached and $0.03/GB cached after paid-plan included quotas; these
are not Free-plan pay-as-you-go escape hatches. No upgrade or spend-cap change is
authorized. [Supabase egress pricing](https://supabase.com/docs/guides/platform/manage-your-usage/egress)

## Access options

| Option | Scope, cost and fit | Decision |
| --- | --- | --- |
| Shareable link for the existing beta branch | Available on all plans; Hobby allows one total link per account. Slot availability needs inspection. Retains project protection and the app's exact-origin checks. Later branch deployments update the shared beta. | **Preferred after eligibility and owner approval.** |
| Commit-specific shareable link | Pins a preview revision but its hostname is not currently allowed by the app. It needs a deliberate exact-origin change and verification; accepting arbitrary Vercel hosts would weaken the boundary. | More work than the existing branch for this pass. |
| Turn off project Vercel Authentication | Broadens exposure across existing deployments in the project. It does not resolve commercial eligibility and risks exposing unrelated previews. | **Reject.** |
| Exact preview-domain exception | Makes the specified domain publicly reachable. App checks can still protect functions, but every visitor can reach the portal without the share token. | Broader than required; not selected. |
| Separate free Vercel project | Requires new project/environment/host configuration and validation. A Hobby project still has the same commercial restrictions. A production deployment would also hit the current `preview`-only guard. | **Not a $0 eligibility workaround.** Do not provision. |
| Invite testers as Vercel collaborators | Adds another identity workflow. Hobby permits one collaborator at a time; protected access requires their Vercel login. | Does not fit the intended multi-tester email-only portal experience. |

Vercel documents branch/commit sharing, the default branch link and collaborator
behavior in [Sharing a Preview Deployment](https://vercel.com/docs/deployments/sharing-deployments).
The one-link Hobby limit and revocation controls are in
[Sharable Links](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/sharable-links).
Domain exceptions and project-wide automation bypass scope are described in
[Bypass Deployment Protection](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection).
Project-wide authentication removal exposes existing deployments according to
[Vercel Authentication](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication).

Do not give testers a service key, automation bypass secret or local-development
OIDC token. Do not replace the private Storage bucket with public assets to save
bandwidth. Serve installer bytes directly using the existing authorized private
download mechanism, so Vercel handles portal/API traffic instead of relaying the
whole installer through a Function.

The current download flow issues short-lived signed bearer URLs. Withdrawal
stops new authorization; it does not recall already downloaded files. Do not
promise universal revocation at exactly 60 seconds: Supabase's Smart CDN
documentation warns that a cached signed response can survive token expiry to
its cache TTL. Smart CDN is a paid-plan feature, so that is a future plan-change
review item rather than evidence of current Free/Basic CDN behavior. Keep
conservative cache settings and verify expiry on the deployed configuration.
[Supabase Smart CDN](https://supabase.com/docs/guides/storage/cdn/smart-cdn)

## Eligibility and any unavoidable expense

Vercel's policy includes advertising a product/service and deployments intended
for financial gain within commercial use. Being a free beta or having disabled
checkout does not establish Hobby eligibility. Verify the actual plan and obtain
a provider determination if this scope is claimed to qualify. No support message
was sent in this pass. [Vercel commercial-use policy](https://vercel.com/docs/limits/fair-use-guidelines)

If the scope requires Pro and no existing eligible hosting arrangement covers
it, the current published Vercel entry price is **US $20/month**, with developer
seats and metered usage subject to the plan's terms and applicable taxes. It is
not a guaranteed all-in bill. That conflicts with the $0 additional-monthly-cost
instruction, so **do not upgrade**. Alternatives are a documented no-cost
eligibility/exception from Vercel, use of an already-paid eligible arrangement if
one exists, or separately approved evaluation of a commercial-eligible free
host. None is established here, and no new service is proposed as already ready.
[Vercel pricing](https://vercel.com/pricing)

## Concrete approval option, after prerequisites

Once plan eligibility and the share-link slot are confirmed, the owner can
approve this exact access change:

> Enable one shareable link for `codex/hex-plugin-storefront` in the existing
> `hex-solutions` Vercel project, using the exact approved preview branch origin.
> Keep project-wide Deployment Protection, production and all app authorization
> checks unchanged. Share it only with invited beta testers. No plan upgrade or
> paid resource is authorized. Real downloads remain disabled until the separate
> distribution gates are satisfied and I explicitly approve private beta delivery.

Then the operator can perform this bounded sequence:

1. Confirm the exact preview commit is the reviewed STORE-002 build, record the
   deployment ID and production baseline, and inspect current sharing inventory.
   Do not revoke an unrelated existing Hobby share link to free a slot.
2. In that deployment's Share control, choose the branch link and **Anyone with
   the link**. Copy the generated URL; retain its secret query parameter privately.
   Confirm its hostname exactly matches the approved origin above. Do not commit
   the token, place it on the public marketing site, or use a fabricated URL.
3. Use a fresh browser context without a Vercel login to confirm the generated
   link reaches `/account`. Verify own-email sign-in, entitlement enforcement,
   non-owner admin denial and authorized access to an approved harmless test
   artifact. Confirm real-release availability remains off until all gates clear.
   Verify the unshared bare preview remains protected and production is unchanged.
4. The owner sends the private portal link and email-bound invitation code
   personally. The tester verifies their own email, redeems once, retains the
   permanent entitlement and can return for eligible downloads. The sharing link
   does not enforce the future two-computer activation policy.
5. To close beta access, revoke the shareable link in Vercel and withdraw/disable
   the release in the owner dashboard. Preserve customer entitlements and audit
   history. Recheck the affected browser flows; do not claim existing downloaded
   files have been recalled.

The distribution decision remains separate: exact installer/ZIP integrity,
complete notices, Core Engineering's outstanding exact-build FL Studio playback
confirmation, documented licensing eligibility and the owner's explicit private
beta distribution approval must all be satisfied. This plan clears none of those
gates and does not establish distribution readiness.
