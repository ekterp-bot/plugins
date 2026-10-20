# Deployment and rollback preparation

October 19, 2026, America/Los_Angeles. **Prepared procedure only.** The storefront
branch is local; no push, deployment, DNS change, hosting change, email send or
GitHub repository rename has been performed by this pass.

## Preserved baseline

- Original repository: `https://github.com/ekterp-bot/hex-solutions`
- Original clean checkout: `C:\Users\ekter\Documents\GitHub\hex-solutions`
- Baseline commit: `24f0574ea0afc1936dd8f98992a62642d5db8a8f`
- Working checkout: `C:\Users\ekter\.codex\worktrees\hex-plugins-website`
- Local branch: `codex/hex-plugin-storefront`
- Full-history bundle:
  `C:\Users\ekter\.codex\worktrees\hex-solutions-pre-migration.bundle`
- Bundle SHA-256:
  `D071319AE434AE2DBAC310F7C36406B75DF79D9E5D4B48FF59E81CB2AD005AF0`
- `git bundle verify` succeeded and reported complete history. The bundle
  includes `main` and the initial transformation branch at the baseline SHA.
- Recorded candidate rollback deployment:
  `https://hex-solutions-qanp89qns-ekterp-bots-projects.vercel.app`
- GitHub deployment record: `5487975239`, successful, source matches baseline.
  It is not a Vercel deployment ID; account-side eligibility is still unverified.

[Infrastructure audit](INFRASTRUCTURE-AUDIT.md) records custom-domain DNS,
redirects, public body hashes and the method-only endpoint check. Preserve the
bundle, original checkout, existing deployment and current provider settings.

## Current blockers and boundaries

The owner authorized the repository name **`ekterp-bot/plugins`**. That rename is
**not complete**. Its destination lookup returned 404 in the repository audit.
Authenticated Vercel project
inspection requires the owner to reconnect the existing integration. Verify the
Git binding and a repair path before renaming; GitHub's redirects are not proof
that third-party deployment hooks remain functional. A required hosting change
is outside the current authorization and must be described before it is made.
The blocker is missing Vercel connection access, not missing rename permission.

Do not push this branch merely to create a PR: configured Vercel Git integration
can deploy non-production branches as previews. Pushing `main` can update
production. Local build/review is the current delivery boundary. No automatic
GitHub or Vercel project creation, repository disconnection, DNS edit, environment
variable pull, token output, email send or public artifact upload is needed.

Before a future authorized release, inspect the existing Vercel team/project,
root directory, production branch, build command, output directory, function
packaging, domain aliases, environment variable *names* and deployment history.
Record IDs and non-secret settings. Do not copy secret values into this repository.
Confirm the intended support/mail behavior and plugin release status separately.

## Repository rename, after its blocker is resolved

GitHub redirects repository web and Git operations after a rename. Project-site
URLs and calls to actions hosted in that repository are exceptions. Reusing the
old repository name breaks its redirect. Update local remotes after a successful
rename. [GitHub rename behavior](https://docs.github.com/en/repositories/creating-and-managing-repositories/renaming-a-repository)

The commands below are prepared PowerShell commands, not executed actions. They
use the exact owner-approved repository name. No provider project name or domain
is renamed by these commands.

```powershell
$approvedRepoName = 'plugins'
$originalCheckout = 'C:\Users\ekter\Documents\GitHub\hex-solutions'
gh api repos/ekterp-bot/hex-solutions --jq '{id: .id, full_name: .full_name, default_branch: .default_branch}'
git -C $originalCheckout status --short
git -C $originalCheckout remote -v
```

Verify repository ID `1260333340`, continued availability of `plugins`, and the
unchanged baseline/relevant user work. Confirm the existing Vercel project can
retain its binding or that any necessary repair is explicitly authorized. Only
then run the prepared rename:

```powershell
gh repo rename $approvedRepoName --repo ekterp-bot/hex-solutions --yes
if ($LASTEXITCODE -ne 0) { throw 'GitHub rename failed; inspect before continuing.' }
gh api "repos/ekterp-bot/$approvedRepoName" --jq '{id: .id, full_name: .full_name, default_branch: .default_branch}'
git -C $originalCheckout remote set-url origin "https://github.com/ekterp-bot/$approvedRepoName.git"
git -C $originalCheckout remote -v
```

The two local worktrees share repository configuration, so updating the common
`origin` covers both. Reinspect the same Vercel project, repository ID/binding,
live HTTPS redirects, public file hashes and method-only endpoint response. Do
not push a test commit without preview/deployment authorization. A rename is
complete only after these checks, not after the GitHub command alone.

If the rename must be reversed and the original name is available, use the
owner-authorized rollback below with the same verified `$approvedRepoName`:

```powershell
gh repo rename hex-solutions --repo "ekterp-bot/$approvedRepoName" --yes
if ($LASTEXITCODE -ne 0) { throw 'Rename rollback failed; inspect before continuing.' }
git -C $originalCheckout remote set-url origin 'https://github.com/ekterp-bot/hex-solutions.git'
gh api repos/ekterp-bot/hex-solutions --jq '{id: .id, full_name: .full_name}'
```

Verify Vercel's binding again. Reversing the GitHub name does not itself repair
a provider configuration that was separately changed.

## Future site release and rollback

Review the local generated `dist` route output and disabled API behavior before
requesting any release. The planned build is `node tools/build.mjs`; route set:
`/`, `/plugins`, `/plugins/project-nebula`, `/downloads`, `/support`, `/about`.
Confirm `api/support.js` remains disabled until the support service is authorized
and configured, and that retired `api/intake.js` returns 410. A static preview
does not validate deployed functions. Validate ordinary GET navigation, direct
deep links, unknown paths, asset paths and responsive layouts; use mocked or
local endpoint tests, not unsolicited production form submissions.

After explicit release authorization, use the existing verified project. Preserve
the exact prior deployment and record the approved source SHA, deployment ID,
target, aliases and build settings. A repository rename is separate from this
release. No DNS change should be inferred from either action.

If production must be restored after a future release, first confirm that the
baseline deployment still belongs to the same project and is eligible. Vercel
plan restrictions can limit which historical deployment can be restored. The
prepared CLI sequence uses a deployment URL, not the GitHub deployment number:

```powershell
# Read-only: run from an already verified, correctly linked project directory.
vercel project inspect --non-interactive
vercel inspect 'https://hex-solutions-qanp89qns-ekterp-bots-projects.vercel.app'
```

Stop on an unlinked/wrong project or an authentication request; do not let a
command silently create/link a project. Once the target, eligibility and rollback
authorization are confirmed, the exact prepared rollback is:

```powershell
vercel rollback 'https://hex-solutions-qanp89qns-ekterp-bots-projects.vercel.app'
vercel rollback status
```

Rollback reassigns production to a prior build. It does not restore external
service state or new secret values. Vercel suspends automatic production-domain
assignment after rollback; resuming that behavior requires a later authorized
promotion. Do not promote an arbitrary preview as an incidental cleanup step.
[Vercel rollback CLI](https://vercel.com/docs/cli/rollback),
[rollback behavior and eligibility](https://vercel.com/docs/instant-rollback).

After rollback, verify apex 308 to `www`, successful homepage/assets, the baseline
hashes in the audit, and safe `GET /api/intake` returning 405 with `Allow: POST`.
That verifies the route's method gate, not email delivery. Confirm that existing
mail DNS and unrelated provider settings remain intact. Record the actual
deployment IDs and result rather than describing this prepared procedure as
an executed recovery.

## Recover source without overwriting current work

The bundle is an independent source-history backup. To recover into a new
directory, inspect it and use a destination that does not already exist:

```powershell
$backupBundle = 'C:\Users\ekter\.codex\worktrees\hex-solutions-pre-migration.bundle'
$recoveryPath = 'C:\Users\ekter\.codex\worktrees\hex-solutions-recovery-20261019'
Get-FileHash -Algorithm SHA256 -LiteralPath $backupBundle
git -C 'C:\Users\ekter\Documents\GitHub\hex-solutions' bundle verify $backupBundle
if (Test-Path -LiteralPath $recoveryPath) { throw 'Recovery directory already exists.' }
git clone --branch main $backupBundle $recoveryPath
git -C $recoveryPath rev-parse HEAD
```

The recovered `main` should be
`24f0574ea0afc1936dd8f98992a62642d5db8a8f`. A source clone is not a deployed
rollback and the bundle does not contain provider secrets, DNS configuration or
mail data. Keep the recovery separate; do not hard-reset, clean, delete, or
overwrite the active worktrees to restore old code.
