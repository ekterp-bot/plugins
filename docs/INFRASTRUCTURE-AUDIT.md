# Website infrastructure audit

Snapshot: October 19, 2026, America/Los_Angeles. Public HTTP observations were
made around 03:47–03:50 UTC on October 20. This is a read-only audit plus local
documentation; it is not a deployment receipt.

## Confirmed target and source

The owner clarified the intended domain as **hextheengineer.com**. The earlier
spelling `hextheegineer.com` returned NXDOMAIN from local, Cloudflare and Google
resolvers. It is not the migration target.

| Item | Evidence |
| --- | --- |
| GitHub repository | `ekterp-bot/hex-solutions`, public, repository ID `1260333340` |
| Default branch and baseline | `main`, `24f0574ea0afc1936dd8f98992a62642d5db8a8f` |
| Original local checkout | `C:\Users\ekter\Documents\GitHub\hex-solutions`, clean at audit |
| Isolated working checkout | `C:\Users\ekter\.codex\worktrees\hex-plugins-website` |
| Local transformation branch | `codex/hex-plugin-storefront` |
| Authorized repository rename | `ekterp-bot/hex-solutions` → `ekterp-bot/plugins`; not executed |
| Repository homepage | `https://hex-solutions.vercel.app` |
| GitHub Pages | Repository metadata reports `has_pages: false`; Pages API returned 404 in the repository audit |
| Baseline config | Static `index.html`, `styles.css`, `script.js`, assets and `api/intake.js`; no baseline `package.json` or `vercel.json` |

The original checkout and live site are preserved. The transformation branch
has not been pushed. Repository renaming has not been performed.

## Public DNS and HTTP

| Record | Observed answer |
| --- | --- |
| `hextheengineer.com` A | `216.198.79.1` |
| `hextheengineer.com` AAAA | No apex AAAA answer returned; query returned SOA |
| Apex NS | `solar.dns-parking.com`, `lunar.dns-parking.com` |
| Apex MX | Priority 5 `mx1.hostinger.com`; priority 10 `mx2.hostinger.com` |
| Apex SPF TXT | `v=spf1 include:_spf.mail.hostinger.com ~all` |
| `www.hextheengineer.com` CNAME | `a9l9a83d9eb4291d.vercel-dns-017.com` |
| CNAME target A | `216.198.79.1`, `64.29.17.1` |
| `hex-solutions.vercel.app` A | `64.29.17.67`, `216.198.79.67` |

`https://hextheengineer.com/` returns **308** with
`Location: https://www.hextheengineer.com/`. The `www` URL returns **200** and
the title `Hex Solutions | Hex the Engineer`. Both responses identify
`Server: Vercel`. The direct `hex-solutions.vercel.app` hostname also returns
the same homepage.

The successful homepage response uses
`Cache-Control: public, must-revalidate, max-age=0`, `X-Vercel-Cache: HIT`, and
`Strict-Transport-Security: max-age=63072000`. Its ETag is
`455abbed11cd871f5b068ed49e2a6b40` (weak encoding form observed on GET).
`X-Vercel-Id` is a request identifier and must not be used as a deployment ID.
Cache age and Last-Modified are HTTP observations, not proof of a source commit.

Web serving is verified as Vercel. DNS is delegated to the listed dns-parking
nameservers, and public mail routing/SPF are configured for Hostinger. Registrar,
billing account, complete DNS zone, mailbox access, DKIM/DMARC and provider account
ownership were not inspected. These DNS answers are a snapshot, not replacement
values to apply later. Preserve existing DNS and email records.

## Live source fingerprint

The same three resources were fetched from both `www.hextheengineer.com` and
`hex-solutions.vercel.app`. Each pair matches. The homepage references
`./styles.css?v=saas-route-1` and `./script.js?v=saas-route-1`.

| Resource | Response bytes | SHA-256 |
| --- | ---: | --- |
| `/` | 38,561 | `7232E8889789C8A35884CD966F4FAB45E6F5876900AE51CE21F5F758B675A7B5` |
| `/styles.css?v=saas-route-1` | 50,031 | `7C508C83D9C25BB1BCF26206D1F87A0EC162A07ADC68CF4B0797B3CD052A557D` |
| `/script.js?v=saas-route-1` | 35,292 | `5F096A4BB5281C9636D7F4FF41687C5134A901845077E019EB29B93BABFA66B9` |

The clean original checkout at the baseline commit matches all three hashes.
HTML and CSS were normalized from working-copy CRLF to LF before comparison;
JavaScript matches as raw bytes. Working-copy HTML was 38,726 bytes, CSS 50,641
bytes, and JavaScript 35,292 bytes. This proves equality of those inspected public
files, not every asset or deployed server function.

The public GitHub deployment record `5487975239` references the exact baseline
SHA and environment string `Production`. Its latest recorded status is
`success` with URL
`https://hex-solutions-qanp89qns-ekterp-bots-projects.vercel.app`, recorded
July 17, 2026. The record's separate `production_environment` boolean is false.
This GitHub ID is not a Vercel deployment ID. Authenticated Vercel inspection
must confirm the project, actual production aliases and rollback eligibility.

## Existing routes and email integration

The current frontend uses hash routes: `home`, `solutions`, `services`,
`websites`, `saas`, `automations`, `rescue`, `process`, and `contact`.
Fragments are not sent in HTTP requests; retirement of old `#/...` navigation
requires client-side handling if those links need a destination.

Three forms submit to `POST /api/intake`. The baseline function checks the HTTP
method before processing input. Safe GET checks on both the custom hostname and
the Vercel alias returned **405**, `Allow: POST`, and
`{"message":"Method not allowed."}`. No POST or mail-send test was performed.

Inspected baseline source calls `https://api.resend.com/emails` and uses these
environment variable names: `RESEND_API_KEY`, `INTAKE_TO_EMAIL`, and
`INTAKE_FROM_EMAIL`. Its public fallback destination is
`hexsolutions.dev@gmail.com`; its fallback sender is
`Hex Solutions <onboarding@resend.dev>`. No secret values were read or printed.
Source and method-response evidence confirm an intended Resend integration;
configured credentials, verified sender domains and actual email delivery remain
unverified. Hostinger mail DNS and a Resend sending integration are separate.

## Local transformation contract

The planned build is `node tools/build.mjs`, producing static pages in `dist`.
The new public route set is `/`, `/plugins`, `/plugins/project-nebula`,
`/downloads`, `/support`, and `/about`. These are local implementation targets;
the live domain continues serving the baseline site.

The new branch retires the old service-request endpoint with HTTP 410 and keeps
the original implementation recoverable in Git history and the backup bundle.
`api/support.js` is a disabled scaffold, not a working support-email service.
The static output must not be assumed to include server-function execution;
verify API packaging separately before any future release.

There is no authorized public deployment, DNS change, hosting reconfiguration,
live email test or plugin-binary publication in this pass. A Git push can trigger
a hosted preview, so the branch stays local. Any future deployment must verify
the existing Vercel project's root/build/output settings rather than assuming a
repository rename creates or updates them.

## Outstanding infrastructure action

**The authorized rename to `ekterp-bot/plugins` remains blocked, not completed.** The Vercel connector's
project lookup requires reconnection, so the account-side Git binding and the
ability to repair that binding have not been verified. The owner has not
authorized hosting changes. GitHub repository redirects alone do not establish
that the existing Vercel integration will remain operational.

Next: reconnect the existing Vercel account for read-only inspection, record the
team/project IDs and Git binding, recheck the destination `plugins` (its GitHub
lookup returned 404 in the repository audit), and determine whether the rename
can proceed without a hosting change. The missing item is Vercel connection
access, not another permission to rename. If a provider-side Git reconnection
is necessary, describe the exact change
for the owner before taking it. See [deployment and rollback](DEPLOYMENT-ROLLBACK.md).

## Evidence sources

- [GitHub repository metadata](https://api.github.com/repos/ekterp-bot/hex-solutions)
- [GitHub deployment record](https://api.github.com/repos/ekterp-bot/hex-solutions/deployments/5487975239)
- [GitHub deployment statuses](https://api.github.com/repos/ekterp-bot/hex-solutions/deployments/5487975239/statuses)
- [Current website](https://www.hextheengineer.com/)
- [Vercel alias](https://hex-solutions.vercel.app/)
- Local read-only DNS queries, HTTP GET/HEAD responses, source hashing and
  baseline `api/intake.js` inspection described above.
