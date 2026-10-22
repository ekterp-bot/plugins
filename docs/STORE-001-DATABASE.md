# STORE-001 database contract

The store uses a dedicated Supabase Postgres ledger and private Storage bucket.
No commerce, payment processing, activation, device tracking, or entitlement
expiry is enabled. `computer_limit = 2` records the license policy only.

The backend owns all store data access. It must call Auth `getUser` with the
request token, require verified email, take `session_id` from that verified
token, and call `store_session_valid` on **every** authenticated request. Never
take actor/user IDs, authorization roles, or verified-email status from the
request body or user-editable metadata. Admin GET routes must additionally
check `store_admins`; every admin mutation RPC repeats that membership check.

All nine `public.store_*` tables have RLS enabled and no browser permissions or
allow policies. Every store function uses `SECURITY INVOKER`, an empty
`search_path`, and `service_role`-only execution. The service key stays on the
server. Minimal Auth column SELECT grants support live session and verified
email checks. `store_admins` has service SELECT only; application code cannot
grant itself membership. `anon` and `authenticated` have no store RPC access.

## Records

| Table | Contract |
| --- | --- |
| `store_products` | Stable text `id`; `name`, `description`; `status` = `prelaunch`, `private_beta`, or `unavailable`; nullable integer `regular_price_minor`, `promotional_price_minor`; `currency` (three uppercase letters); nullable `checkout_price_id`. Prices are draft metadata. Promotional price cannot exceed regular price. `commerce_enabled` is constrained false. Seed product: `nebula` / ProjectNebula. |
| `store_admins` | `user_id` UUID referencing `auth.users`; `created_at`; required `bootstrap_reason`. Bootstrap only through trusted operator SQL after the intended Auth account is verified. No email-domain or browser self-promotion. |
| `store_invites` | UUID `id`; unique HMAC-SHA256 lowercase hex `code_hash`; `product_id`; nullable normalized `intended_email`; `expires_at`; `created_by/at`; nullable `revoked_by/at`, `redeemed_by/at`. Single-use; no raw codes or pepper. Immutable except its first revocation or redemption. |
| `store_entitlements` | UUID `id`; unique `(user_id, product_id)`; unique `source_invite_id`; `source = complimentary_beta`; `coverage_major = 1`; `maintenance_updates = true`; `computer_limit = 2`; `policy_version = complimentary-v1`; `granted_at`; `expires_at = null`. Append-only permanent ownership. |
| `store_redemptions` | Unique invitation and entitlement references, user ID, redemption time. Append-only. |
| `store_releases` | UUID `id`, product, SemVer `version`, `coverage_major`, `platform = windows-x64`, `format = vst3`, `channel = private_beta/stable`, `artifact_kind = test/installer`, `status = draft/published/withdrawn`; immutable private locator, byte count, SHA-256, release/installation notes and signing status; recorded creation and distribution approval actors/times/reference. |
| `store_download_events` | User, release, entitlement; `event_type = link_authorized`; `authorized_at`, `expires_at` (60 seconds). Append-only authorization evidence, **not proof of link creation, transfer, installation, or listening**. |
| `store_admin_audit` | Append-only actor, action, target ID, limited details and time. Never includes raw invite codes or the invite verifier. |
| `store_rate_limits` | One atomic fixed-window counter per opaque server-derived `key`, with expiry; shared across API instances. Keys must not contain raw email/IP/token values. |

Neither the application role nor its functions have DELETE/TRUNCATE permissions.
Permanent grant/redemption/audit/download records also have mutation-rejecting
triggers. Retained account foreign keys prevent an Auth deletion from silently
erasing ownership. Account-deletion/privacy handling requires a separate,
deliberate operator workflow; there is no destructive account route here.

## Service-only RPCs

| Function | Parameters and return |
| --- | --- |
| `store_session_valid` | `(p_user_id uuid, p_session_id uuid) → boolean`. Requires matching live `auth.sessions` row, unexpired `not_after`, verified email, and a nondeleted/nonbanned Auth user. |
| `store_admin_product` | `(p_actor uuid, p_data jsonb) → product`. Create with `id/name`; update by existing ID with allowed partial fields. Only documented product fields accepted. |
| `store_create_invite` | `(p_actor uuid, p_code_hash text, p_product_id text, p_email text, p_expires_at timestamptz) → invitation without code_hash`. Expiry must be in the next 366 days. Backend generates a random high-entropy code and HMAC verifier; returns the raw code once. |
| `store_revoke_invite` | `(p_actor uuid, p_id uuid) → invitation without code_hash`. Only unused invitations; repeating a revocation is idempotent. |
| `store_redeem` | `(p_user_id uuid, p_code_hash text) → {entitlement, existing}`. Locks the invitation; same-caller successful retry returns the same grant. Invalid/expired/revoked/wrong-email/other-caller codes raise `P0001 invite_unavailable`. An already-owned product reached through a different unused code raises the same error and leaves that code unused. Unverified/nonlive user raises `account_unavailable`. |
| `store_admin_release` | `(p_actor uuid, p_data jsonb) → release`. Create omits `id`; update supplies an existing ID. Artifact fields and notes never change. Editable fields are `status`, `approved_for_distribution`, and first `approval_reference`; DB records approval actor/time. Withdrawal is terminal. |
| `store_rate_limit` | `(p_key text, p_limit integer, p_window_seconds integer) → {allowed, remaining, retry_after_seconds}`. Server fixes limits and uses action-specific key namespaces. No request-controlled limits. |
| `store_record_export` | `(p_actor uuid, p_counts jsonb) → audit row`. Admin-checked, records `export_prepared` before data is returned. Exactly six integer counts, 0–20000: `products`, `invitations`, `entitlements`, `releases`, `downloads`, `audit`. No export contents, codes, or tokens enter this record. API fails closed if recording fails. |
| `store_authorize_download` | `(p_user_id uuid, p_release_id uuid) → {release, bucket, object_key, download_event_id, ttl_seconds:60, expires_at}`. Locks product and release; denies unavailable products, unpublished/withdrawn/unapproved releases, unsigned installers, missing ownership and uncovered major versions. |

`store_require_admin` and `store_verified_email` are internal helper functions,
also restricted to service role. Never expose arbitrary RPC dispatch from HTTP.
Server list/export queries select explicit columns and apply account ownership
or admin checks; exclude `code_hash` and private object locators from browser
responses. Only the signed URL is the actual short-lived download credential.

Redemption locks the invite row; unique user/product and invite constraints make
the grant atomic across concurrent requests. A retry never consumes a second
use. Invite expiry/revocation, product unavailability, and release withdrawal do
not revoke a granted entitlement. A successful retry remains idempotent after
the original invitation expires. A v1 grant covers v1 maintenance releases;
v2 requires another future license policy. Release coverage is constrained to
`max(SemVer major, 1)` so a `0.x` private beta maps to v1 and `2.x` cannot be
silently relabeled v1.

## Private release integrity

`store-installers` is private. Restrictive Storage policies deny browser access
to this bucket even if another broad permissive policy is added. No public
download or bucket-listing policy is created. Service credentials can access
private objects and must remain server-only.

Every object key contains its SHA-256 as a complete path segment, for example
`test/1.0.0/<sha256>/fixture.txt`. Only `.txt`/`.json` artifacts may use
`artifact_kind = test`; test signing status is `not_applicable`. Installers use
`unsigned` or `verified`, and only `verified` installers can publish. All
published artifacts require `approved_for_distribution = true` and an approval
reference, with actor/time recorded by the DB. Approval cannot be rewritten.

These checks cannot hash remote bytes or validate Windows signatures inside
Postgres. Before registering a release, the trusted uploader/backend must read
the actual private object, verify byte length and SHA-256, reject overwrite/upsert,
and obtain separate engineering signing/distribution approval for installers.
An administrator-supplied `signing_status` string alone is not signing evidence.
Object metadata is immutable in this ledger; privileged Storage operators still
must follow the no-overwrite rule. Distribution of a real plugin is a separate
approval from uploading a harmless test fixture.

After authorization, sign the exact returned object with a TTL no longer than
the remaining authorization window. Do not cache or log signed URLs. A bearer
URL can be reused until it expires; withdrawing the release prevents new links,
but cannot retract a link already signed before withdrawal. Failure to sign
still leaves an honest authorization event. Use storage transfer evidence
separately if actual completion must be measured.

## Applied preview and evidence

Applied only to the dedicated preview project `pujpznngwcgutujqgmkp`
(`hex-store-001-preview`), after verifying an empty public schema:

- `20261022040649_store_001.sql`
- `20261022040858_store_001_product_gate.sql`
- `20261022041752_store_001_export_audit.sql`

Both files were initially created with `supabase migration new`. Applying via
Supabase MCP assigned the versions above; local filenames were aligned to the
observed remote migration history, preserving the SQL. No production project
was changed. No administrator was bootstrapped by this migration.

`supabase/tests/store_001_invariants.sql` passed **46 real PostgreSQL checks**
in the preview on October 22, 2026 UTC (October 21 Pacific). It switches among
`service_role`, `anon`, and `authenticated`; fixtures and temporary Auth users
are transactionally rolled back. Checks cover live/revoked/mismatched sessions,
admin escalation, prices, redemption errors/idempotency/permanent coverage,
release approval/immutability/withdrawal/version eligibility, product gating,
limiting, ACLs and private storage policies. The final fixture-user count was 0.
These are sequential SQL checks, not a concurrent HTTP race, Auth email-delivery
test, object transfer, browser flow, or installer validation.

The focused `supabase/tests/store_001_export_audit.sql` additionally passed seven
real PostgreSQL checks for durable counts-only export audit, admin/browser
authorization, input bounds and no writes on rejected payloads, with fixtures
rolled back. `tools/verify-store-integration.mjs` exercised 76 actual local
HTTP/provider checks, including concurrent two-account redemption (one grant),
real Auth OTP/session revocation, private file bytes/SHA-256, signed-link expiry
and renewal, repeated downloads and ownership after actual invitation expiry.
Results and private fixture sessions are under ignored `artifacts/store-001/`.
Provider-generated OTPs do not establish outbound email delivery. After the
synthetic browser verification, the temporary synthetic administrator membership
was removed by trusted SQL. At that historical checkpoint the preview had zero
administrators; the three permanent fixture grants (including flagship `nebula`)
and associated evidence were retained. A final HTTP request with the former test
administrator's still-valid session returned 403 `ADMIN_REQUIRED`.

Subsequently, the real owner completed inbox-code sign-in at **04:31:36 UTC on
October 22, 2026**. A trusted conditional SQL insertion bootstrapped the verified
owner Auth identity as the **sole current administrator** at
**04:31:54.633542 UTC**, with a recorded reason. Browser automation in that
verified owner session created an email-bound ProjectNebula invitation in the admin UI and redeemed it
through the customer UI at **04:32:54.550958 UTC**. SQL confirmed one permanent
owner grant, one owner-created and redeemed invitation, one `invite_created`
audit event and one owner download authorization. The browser separately
verified the downloaded 183-byte text test artifact against its expected SHA-256.
The three synthetic permanent grants remain; no test administrator membership
was restored. See [implementation and operating notes](STORE-001-IMPLEMENTATION.md)
for sender configuration, owner-flow screenshots and validation boundaries.

The initial empty-project advisor scan reported no security warnings/errors.
After Auth integration, the current scan also reports the provider configuration
warning [leaked password protection disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
The application uses OTP sign-in; this pass did not change password-related Auth
settings. Informational findings are intentional
[RLS without client policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
and [unused indexes](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index)
on a new empty deployment. Keep the deny-by-default policy model. Before real
testers, complete API/Auth/storage/concurrent-request checks and a backup restore
exercise; never infer delivery or durable backup recovery from SQL success.

Reviewed current Supabase [function security](https://supabase.com/docs/guides/database/functions),
[session revocation](https://supabase.com/docs/guides/auth/sessions),
[private buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals),
and the [explicit Data API grants change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically).
