# STORE-001 private implementation and operating notes

Checkpoint: **October 21, 2026 Pacific / October 22 UTC**. Work is in the
`codex/hex-plugin-storefront` branch, using the dedicated Supabase project
`hex-store-001-preview` (`pujpznngwcgutujqgmkp`). The approved API origins are
`http://localhost:4176` and the verified private Vercel branch alias
`https://hex-solutions-git-codex-hex-plugin-fdcb17-ekterp-bots-projects.vercel.app`.
The production website has not received these changes; hosted deployment and
validation are pending at this checkpoint.

## Implemented scope

`/account` provides email-code sign-in, a multi-product library, permanent
complimentary invitation redemption, release information and authorized private
downloads. `/admin` provides product/draft-price editing, single-use invitation
creation and revocation, existing release availability, access/download activity
and an audited JSON export. The original storefront appearance and plugin code
remain outside this backend change.

The Node/Vercel adapter in `api/store.js` calls the shared Fetch handler in
`server/store-handler.mjs`. Supabase manages authentication, Postgres and private
Storage; no separate Edge deployment is required. Every authenticated request
uses Auth `getUser` and checks its verified session ID against live Auth sessions.
Server-only `store_admins` membership authorizes management; an email address or
user-editable metadata never grants administrator access.

Cookies are HttpOnly/SameSite=Lax, with Secure and `__Host-` names on the approved
HTTPS origin. Every mutation requires the exact approved Origin and a
CSRF token from the session response. Responses are uncached, errors exclude
provider internals, and request bodies are capped at 16 KiB. Shared database
limits protect sign-in, redemption and download issuance. The preview uses a
conservative shared ingress bucket because browser-supplied IP headers are not
trusted; this can throttle several testers together.

Tester grants are durable, have no expiry, include ProjectNebula 1.0 and its
maintenance updates, and survive invitation expiry, later login and withdrawal
of a release. Downloads are unlimited subject to short-term abuse limits, not
limited to two. `computer_limit = 2` records the intended policy; plugin-side
activation and offline enforcement are **not implemented**.

Pricing is draft configuration only. Supported editor/API currencies are USD,
EUR, GBP, CAD and AUD, all with two decimal places. Amounts are integer minor
units; a zero promotional amount is distinct from no promotion. Fractional minor
units and unsupported currencies are rejected. Saving a price does not update
a checkout provider, enable payments or convert currency. Owner catalogue
records serve the account/download system; the existing public storefront is
still generated from its source catalogue.

## Start the configured local preview

Use Node.js 22 or newer and the committed dependency lockfile:

```powershell
npm ci
npm run store:dev
```

For a fresh checkout, first create the ignored `.env.store` from `.env.example`;
preserve an existing configured file. Set `PORT=4176`, the dedicated
`SUPABASE_URL`, server-only `SUPABASE_SERVICE_ROLE_KEY`, the project's public
`SUPABASE_PUBLISHABLE_KEY`, and an independent random `INVITE_CODE_PEPPER`.
Never copy these secrets into browser assets, screenshots, Git or exported
reports. `SITE_ORIGIN` in the example documents the origin; the actual allowlist
is the reviewed constant in `server/store-config.mjs`.

Open [customer accounts](http://localhost:4176/account) or
[owner management](http://localhost:4176/admin). Use `localhost`, not
`127.0.0.1`: the API intentionally matches the exact configured host/origin.

The dedicated Supabase URL, public key, service key and independent invitation
pepper have also been configured as branch-specific Vercel preview variables.
Production variables were not configured. The backend rejects a present
`VERCEL_ENV` other than `preview`; the hosted preview remains behind Vercel's
existing authentication protection. Its deployment still needs end-to-end
validation before external use.

The preview database already has these migrations; inspect migration history
before applying anything to a fresh environment:

1. `20261022040649_store_001.sql`
2. `20261022040858_store_001_product_gate.sql`
3. `20261022041752_store_001_export_audit.sql`

The local Docker-based Supabase stack was unavailable, so database/Auth/Storage
checks used the dedicated hosted preview. This does not require production
credentials or a production database change. See the
[database contract](STORE-001-DATABASE.md) for the schema and grants.

## Email and owner access still need final verification

At this checkpoint, SMTP/sender setup and **actual owner inbox delivery** remain
pending. Supabase Auth's Magic Link template must include `{{ .Token }}` for the
code-entry UI. Configure sender DNS, SMTP and allowed URLs in Supabase, then
verify delivery and sign-in with the real owner before inviting customers.
Setting the old support-form environment variables does not configure Auth
email, and `api/support.js` remains deliberately unavailable.

The intended owner email is `hexsolutions.dev@gmail.com`. After that account
actually verifies its address, a trusted operator must confirm the corresponding
Auth user ID and explicitly insert that ID into `store_admins` with a bootstrap
reason. There is no automatic email-based promotion. Temporary synthetic test
administrator membership must be removed after QA; fixture grants and audit
evidence are retained. Provider-generated test OTPs establish the real Auth
exchange, not email delivery to that owner or to testers.

## Create an invitation and send it personally

Once owner sign-in is verified:

1. Open `/admin`, select **Invitations**, choose ProjectNebula and enter the
   intended engineer's email if the code should be restricted to that address.
2. Choose a redemption deadline, or leave it blank for 30 days. The maximum
   window is 366 days. Create the invitation and copy the code immediately;
   the server returns the raw code only once and stores only its HMAC verifier.
3. Send the account URL and code personally through your chosen channel. The
   portal does not automatically send invitations. A localhost URL is usable
   only on this computer; external testers need an approved hosted preview.
4. The engineer verifies that email, redeems the code and receives a permanent
   grant. Returning later requires sign-in, not another invitation.

An unused lost code can be revoked and replaced. Revocation is unavailable after
redemption and never removes the resulting grant. A retry of the same successful
redemption returns the existing entitlement without issuing another license.

## Import and manage an artifact

The current ProjectNebula release **`0.1.0-store001.test`** is a small text file,
explicitly labeled as a distribution test. It is not a VST3, installer or product
validation. The real approved installer is required before external testers
receive the plugin.

Only the trusted operator importer creates release metadata and distribution
approval. The browser admin changes existing availability status only. Prepare
a private JSON manifest with `file`, `product_id`, SemVer `version`, verified
admin `actor_id`, `artifact_kind`, `approval_reference`, release/installation
notes and optional channel. File/evidence paths resolve relative to the manifest
directory unless absolute. Then run:

```powershell
npm run store:import-release -- <approved-manifest.json>
```

For `artifact_kind=test`, the tool accepts only UTF-8 `.txt` or valid `.json`
files up to 64 KiB and refuses binary control bytes. For a real Windows `.exe`
installer, also provide approved `sha256`, `file_size`,
`signing_status="verified"` and a `signing_evidence` JSON file containing that
`sha256` and the approved certificate's `signer_thumbprint`. On Windows, the
tool verifies the actual Authenticode result, timestamp and signer, and hashes
the file before/after signature inspection. A metadata string alone is
insufficient. Core Engineering's separate release approval still applies.

The importer pins the preview project, verifies the actor and private bucket,
uses an immutable version/hash object key without overwrite, downloads the
stored bytes to recheck size/hash, and then registers the release. An exact
repeat returns the original release after byte verification. A changed artifact,
approval or withdrawn release is rejected; it is never silently replaced.
The installer signature acceptance path has not been tested with an approved
real installer in STORE-001.

Downloads require an eligible grant and approved/published release. The signed
URL lasts at most the remaining 60-second authorization window. Withdrawal or
product unavailability prevents new URLs; a previously issued bearer URL can
remain usable until expiry. Activity records authorization, not completed
transfer, installation or listening.

## Export and recovery

Owner exports contain customer data and must be stored privately. Each successful
preparation records an `export_prepared` audit event with actor and row counts;
the export includes its `exportAuditId`. Invite codes/verifiers, sessions and
service secrets are excluded. Lists/exports page explicitly rather than stopping
at a provider row limit. A collection above 20,000 records fails visibly and
requires an operator's paged export. Concurrent count changes cause a retry,
not a silently incomplete result.

The admin export is **not a complete backup or an atomic database snapshot**.
Recovery also needs protected database/Auth backups, private Storage objects,
the independent invitation pepper, and approved artifact/signing manifests.
Back up those materials separately and perform a restore into an isolated
preview before external distribution. No full backup-restore exercise has been
completed here.

For a failed import, keep the private artifact and manifest; rerun the exact
manifest to verify bytes and finish or recover the record. Do not delete grant
history, overwrite an object or recreate the database as a retry strategy. To
stop a bad build, withdraw its release; ownership remains. To recover the
website code, return to a preserved commit without reversing append-only ledger
history. A new database target or hosted origin requires an explicit reviewed
configuration change, never a production fallback.

Keep `INVITE_CODE_PEPPER` backed up and stable. Service-key rotation leaves
existing invites valid when that independent pepper is retained. If the optional
namespaced service-key fallback was used instead, preserve the old derived
pepper before key rotation or unused invitations will stop validating. Existing
permanent grants do not depend on either invitation secret after redemption.

## Focused evidence and remaining work

| Evidence | Result and boundary |
| --- | --- |
| Initial real HTTP/provider integration | **63 checks passed**, including managed Auth OTP exchange, sessions/CSRF/admin denial, concurrent redemption, permanent grants, private byte/hash checks, signed-link expiry and renewal. OTPs were generated by the provider's admin test facility; no inbox delivery claim. |
| Review and flagship follow-up | **13 additional HTTP checks passed**, for **76 total**: export audit, money validation and ProjectNebula's explicit test-release workflow. See ignored `artifacts/store-001/http-integration-results.json`. |
| Database | **46 original PostgreSQL assertions + 7 export-audit assertions passed**, using real role permissions and transactional fixtures. These do not establish email delivery or backup recovery. |
| Local regression tests | **12 existing tests + 5 focused pagination/importer tests passed** (`npm test`, 17 total). Pagination guard tests use controlled page results and are distinct from live provider evidence. |
| Trusted importer recovery | Two actual retries verified the existing private flagship artifact and returned the same release without overwrite/duplication. See `artifacts/store-001/importer-review-results.json`; this is retry evidence, not a fresh-registration or real-installer signing claim. |
| Browser and layout | Real synthetic-account sign-in/out, owner screens, customer admin denial and library verified in Chrome. A browser-triggered text download matched its expected SHA-256. Desktop and actual 390 px mobile layouts were inspected; full-page screenshots are in `artifacts/store-001/screenshots/`, including `projectnebula-library-desktop-full.jpg` and `projectnebula-library-mobile-full.jpg`. See `browser-qa-report.json` and `browser-download-proof.json`. |
| Fixture cleanup | Temporary synthetic administrator membership removed; its still-valid session receives `403 ADMIN_REQUIRED`. Three synthetic permanent grants and audit evidence are preserved. The real owner has not been automatically verified or promoted. |

Actual owner email delivery, final owner bootstrap and hosted private deployment
are not established at this checkpoint. Update those outcomes only after their
separate checks complete.
Commerce, discount checkout, two-computer enforcement, production publication,
external installer distribution and plugin engineering remain outside STORE-001.
See the [commerce and activation plan](STORE-001-COMMERCE-AND-ACTIVATION.md).
