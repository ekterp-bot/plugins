# STORE-002 implementation and owner workflow

October 22, 2026 UTC / October 21 Pacific. Implemented on
`codex/hex-plugin-storefront` in the isolated marketing worktree. The engineering
repository, VST3, installer, production branch and production deployment are unchanged.

## Current release

The real ProjectNebula 0.1.0 installer is integrated in private Supabase Storage
and registered as an **unapproved draft**. It is absent from customer libraries,
and an entitled customer's request for its download receives HTTP 403.

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| Unchanged `ProjectNebula-Setup-0.1.0-Win64.exe` | 9,818,339 | `b4a204896b91d23c785e0b488880cda9682927e80b48b887494aaf2d4a3bf52f` |
| `ProjectNebula-0.1.0-Win64-private-beta.zip` | 9,030,803 | `432813213018f53a2eb69ded2ef7eba3b487d8b9668a60001b53fc50631aee19` |

Build identity: `BP010-0.1.0-Release-g9eda0638-sd2c7096d6719`. Windows
Authenticode reports `NotSigned`. The ZIP has 45 files: the exact EXE, all 40
DIST-002 customer-notice files, the proprietary licence, README, installation
instructions and release notes. Required covered source is included in the
notice tree. Private engineering financial/eligibility reports are not included.
Notice index SHA-256:
`9fdfd9cd78f755fec166fe56c73ac8b48ecb7562ffbbf4256778ba58279498cb`.

The package and ignored operator manifests are retained in `artifacts/store-002`.
No installer binary or service credential is committed to Git. The one private
bucket now contains four objects totaling 9,031,152 bytes; it remains non-public.

## Policy and implementation

Installer ingestion always creates an unapproved draft. The importer verifies
the local EXE's SHA-256/size and actual Windows signature status, verifies every
ZIP entry and required notice hash/size, rejects unexpected entries and unsafe
Windows paths, uploads without overwrite, and rehashes the stored object. ZIP
verification counts actual streamed bytes with bounded expansion. Release
identity and package metadata become immutable after registration.

Unsigned installers are eligible only in `private_beta`, after the five gates
below. Stable installer distribution still requires verified, timestamped
Authenticode matching the approved signer. An invalid signature cannot masquerade
as unsigned. Browser owner actions can change availability only; they cannot
upload bytes or fabricate gate evidence. Approval uses the trusted operator tool.

| Gate | Current evidence |
| --- | --- |
| Exact installer checksum | Passed: matches DIST-001 and user-supplied SHA-256/size |
| Required notices delivered | Passed: complete DIST-002 tree verified inside the same ZIP |
| Exact-build FL Studio playback | **Missing**: DIST-002 establishes loading only; playback was not started |
| Documented licensing eligibility | Documented by DIST-002 owner-attested Starter checklist/addendum; ongoing eligibility remains required |
| Explicit owner private-beta distribution approval | **Missing** |

First-write evidence and owner approval are immutable. Download authorization
still requires verified email, a live session, a permanent entitlement covering
the release major, available product, approved eligible release and published
status. Both SQL and server policy enforce readiness before issuing a signed
URL. Customers receive safe package/installer metadata and notice paths, not
internal evidence references or storage keys. Owner release review shows all
five gates, separate ZIP/EXE hashes, and the unsigned warning.

Availability can move between draft (disabled) and published (enabled) after
approval. Withdrawal is terminal. Disabling stops new authorizations; it cannot
recall already downloaded files or instantly revoke issued URLs. There is no
two-download limit and no device-activation enforcement. Pricing remains draft;
payments, public files and browser uploads are not implemented.

## Owner workflow

1. Sign in at the [protected preview owner workspace](https://hex-solutions-git-codex-hex-plugin-fdcb17-ekterp-bots-projects.vercel.app/admin)
   with the existing owner email. Open **Invitations**, select ProjectNebula,
   bind the invitation to the engineer's email, generate it and copy the code.
2. Wait until the access plan and actual distribution are approved before sending
   the tester-facing portal link/code. No external invitations were sent in this pass.
3. The engineer verifies their own email at Account and redeems once. The grant
   remains permanent even after the invitation expires. Review redeemed
   invitations and entitlements in the owner workspace.
4. After Core Engineering supplies the missing playback evidence and the owner
   explicitly approves this exact package, the operator records both using the
   approval command below. The release stays disabled until the owner enables it.
5. Open **Releases**, review version, package, warnings and gates, then choose
   Published and save. Choose Draft to pause new downloads. Use Withdrawn only
   for permanent withdrawal. Existing permanent grants are preserved.
6. The engineer can download eligible releases repeatedly from their library.
   Download records represent signed-link authorizations, not proof of completed
   transfers or successful installation.

## Trusted operator commands

Use the existing ignored `.env.store` with preview-only credentials; never place
it in the browser bundle or paste keys into chat. Run from the marketing checkout.

```powershell
# Local-only package creation and complete entry verification (no upload).
node tools/store-package-release.mjs artifacts/store-002/package-input.json

# Inspect existing prepared package, including actual Windows signature status.
node tools/store-import-release.mjs --check artifacts/store-002/stage-manifest.json

# Register in private storage as an unapproved draft. Already completed for 0.1.0.
node --env-file=.env.store tools/store-import-release.mjs artifacts/store-002/stage-manifest.json

# FUTURE ONLY: after actual engineering confirmation and explicit owner approval.
node --env-file=.env.store tools/store-approve-release.mjs <private-approval.json>
```

The packaging input names the sealed engineering manifest, complete notice folder
and approved index hash, reviewed companion documents, output ZIP/stage-manifest
paths, owner actor, documented licensing reference and customer-facing notes.
Outputs are created exclusively; a prepared package is never overwritten. The
importer requires exact ZIP/installer identity and a bounded notice manifest.
An exact unchanged draft import is retryable; differing metadata or availability
is refused. A failed registration retains the private object for recovery.

The later approval JSON has **exactly** `stage_manifest`, `release_id`,
`fl_playback_reference`, and `approval_reference`. The references must identify
real exact-build engineering evidence and the owner's explicit distribution
decision; strings themselves do not constitute approval. Do not create placeholder
signoffs. The tool revalidates local/stored bytes and metadata, records approval,
and leaves status draft. It was not run for the real release in this pass.

## Focused verification

- 77 PostgreSQL assertions passed inside a rollback transaction before migration
  application. Includes unsigned private-beta approval, stable rejection, missing
  gate rejection, forced draft insertion, immutable evidence, owner restrictions,
  permanent redemption and download authorization. Test fixtures did not persist.
- 18 focused Node checks passed for importer/approval input, safe customer
  projection, gate combinations, and ZIP bounds/identity. Includes a forged
  expansion-length regression, protection against output overwrite, and two
  deferred-request regressions for navigation during owner-data loading/error.
- 15 real HTTP/provider checks passed: existing synthetic customer OTP login,
  permanent grant retention, three repeat test download authorizations, stored
  test bytes matching SHA-256, unauthorized/non-owner denial, private-field
  exclusion, and the real installer's enforced hold.
- Production home/download-page responses remained byte-identical after preview
  deployment; `origin/main` remains `3368296e7f7f4f99e3922e2643920cd5717dd19c`.
  Build produced eight routes. The protected preview deployment for `9678c8a`
  reached Ready (`GpTZL1RV5Vz5psJSY2oxH1rSr5Bk`). Hosted owner sign-in persisted;
  real draft metadata and all five gate states rendered, with Enable disabled.
  The hosted library showed only the approved test artifact and successfully
  issued its private download link.
  The external preview still redirects anonymous access to Vercel SSO (HTTP 302).
- An additional actual-package check replaced the approved ZIP checksum in an
  ignored input copy; inspection rejected it before upload. No real package or
  release metadata was changed by that negative test.

Browser review also prompted one narrow UI improvement: the full 44-file notice
inventory is available in a collapsed native disclosure, keeping warnings and
gates easy to reach. Decimal MB/KB labels now match their units. Final deployment
and screenshots are retained under ignored `artifacts/store-002`.
Clicking an owner navigation item while its first data request was pending
exposed a loading race during browser QA. Explicit loading/error states now
preserve the selected destination without rendering null data; real 403 errors
remain visible with retry. The targeted regressions cover both outcomes.

The post-migration advisor results match the prior security baseline: nine
intentional deny-by-default RLS tables with no browser policies, and the existing
[leaked-password protection warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
This portal uses email OTP, not passwords. Performance notices only identify
currently unused indexes in the small preview ledger; no indexes were removed.

No full STORE-001 suite, plugin build, DAW manipulation, listening test or new
outbound email was performed. Synthetic OTPs were generated through Auth's admin
test facility and verified through the actual HTTP login. Existing owner browser
session remains usable. This is integration evidence, not a stability or sound
quality claim.

## External access and remaining holds

[Access and capacity plan](STORE-002-ACCESS-PLAN.md) prepares a single branch
sharing link while preserving Vercel protection and app checks. No link was
created and no external exposure was enabled. Supabase Free has ample storage
for this package; actual shared-period egress headroom still needs review before
a tester batch. No paid resources or subscriptions were added.

Vercel Hobby's personal/non-commercial restriction is a separate hosting
eligibility issue for this company beta portal. Resolve it through a documented
no-cost eligibility determination, an already-covered eligible arrangement, or
a separately approved host evaluation. Pro starts at US $20/month plus applicable
usage/taxes and is not authorized under the $0 instruction. No upgrade is made.

Before outside testers receive the installer: Core Engineering must confirm the
short exact-build FL Studio playback check; the owner must approve private-beta
distribution, including remaining beta terms/name review; and external portal
access must receive separate approval after hosting eligibility is resolved.
