# @tplnet/overkiz-client

Maintained fork of dubocr/overkiz-client: Node.js client for the Overkiz API (Somfy TaHoma local API in Developer Mode and the vendor clouds). Used by `@tplnet/homebridge-tahoma`.

## Commands
- `npm run lint`, `npm run build` (TypeScript → `dist/`), `npm audit --omit=dev`
- Preview release notes: `node scripts/release-notes.mjs [version]`

## Project rules
- Respect the Overkiz cloud rate limits: bulk state refresh and `GET /setup/devices` at most once per day per session; never log in again to reset a `429 QUOTA_EXCEEDED` quota.
- Local API: TLS verified against the Overkiz root CA (`tlsInsecure` only as fallback), gateway discovery via mDNS TXT `gateway_pin`, reconnect via the last known IP address.
- Executions are removed on every terminal state (the local API does not always send `timeToNextState: -1`). In multi-device executions only the devices listed in `failedCommands` fail.
- A change that the plugin needs is only delivered to users through a plugin release that raises the required client version.

## Rules for all tplnet Homebridge projects

These apply to `@tplnet/homebridge-tahoma`, `@tplnet/overkiz-client`, `homebridge-tahoma-local` and `@tplnet/homebridge-heos-multiroom-audio`. Keep the four projects consistent: a change to the release or check process in one of them goes into all of them. New tplnet projects adopt these rules from the start.

Notes that concern several projects (a change to port, a new rule, what still has to be done in another project) are written into this section – in all four `CLAUDE.md` files – not only into a note of a Claude project: every session reads the `CLAUDE.md` of its repository, whichever Claude project it belongs to. When a change in one project still has to be ported to another one, note it here as an open item and remove it once it is done everywhere.

### Language and wording
- Code, comments, README, CHANGELOG and commit messages in English. No German translation of the plugin (exception for now: the German settings form of `@tplnet/homebridge-heos-multiroom-audio`).
- User-facing text says "Apple Home", not "HomeKit" (README, settings schema, log messages, execution labels). Technical code comments may keep "HomeKit".

### README
- Every README has the disclaimer: a short note at the top ("Private hobby project, developed in spare time with the help of AI tools. Use at your own risk; support is best effort. See the disclaimer.") and a "Disclaimer" section before the license / credits: private project to keep compatibility, security updates, features and bug fixes going; developed in spare time with the help of AI tools; use at your own risk, no warranty (link to the project's license); questions, bug reports and requests are handled best effort, without guarantee; not affiliated with the brands named in the project.
- Keep the "Compatibility and security" (or "Security") and "Privacy" sections up to date where the README has them.

### Documentation structure
- Keep the README short: what the project is, requirements, installation, quick configuration, compatibility and security, privacy, a "Documentation" list, contributing, disclaimer, license.
- Details go into `docs/`: `configuration.md` (all options, settings for single devices, several gateways), `troubleshooting.md` (problems, debug log, reporting a problem), `releasing.md` (maintainers), images in `docs/images/`. Each page starts with a "← Back to the README" link.
- Links from the README to `docs/` are absolute GitHub URLs (`https://github.com/tplnet/<repo>/blob/master/docs/...`) so they also work on npm; inside `docs/` relative links. `docs/` is not part of the npm package.
- Screenshots of the settings form come from a real Homebridge UI with the plugin (no real credentials, example devices only), collapsible with `<details>`. Update them when the settings form changes.

### Compatibility and CVEs
- Every change and every release: `npm audit --omit=dev` must report 0 vulnerabilities in the runtime dependencies, and plugins must start with the newest Homebridge release (smoke test against `homebridge@latest`, CI on Node.js 22, 24 and 26).
- Automated in `.github/workflows/compat.yml` (weekly, on dependency changes) and in `publish.yml` (blocks the release). Keep this documented in the README.
- Dependabot pull requests can be merged when all checks are green.

### Malware scan
- Dependencies are installed with `npm ci --ignore-scripts` in every workflow (their install scripts never run). Our own packages must not need install scripts.
- `.github/workflows/malware.yml` (weekly, on dependency changes, on demand) and `publish.yml` (blocks the release) run the composite action `.github/actions/malware-scan`: OSV-Scanner (pinned version, SHA-256 checked) against `package-lock.json` – any known malicious package (OSV `MAL-…`) fails – and ClamAV over the `npm pack` tarball and `node_modules` (signatures cached between runs). The logic is in `scripts/malware-scan.mjs` (`npm run malware`, needs `osv-scanner` and `clamscan` locally).
- `.github/actions/malware-scan`, `malware.yml` and `scripts/malware-scan.mjs` are identical in all projects; new projects copy them. To update OSV-Scanner, change version and SHA-256 (from `osv-scanner_SHA256SUMS` of the release) in the action in all projects.
- README: "Malware scan" badge next to the other workflow badges and a bullet in "Compatibility and security" / "Security"; SECURITY.md describes the scan.

### Release process
1. Write a `## X.Y.Z (YYYY-MM-DD)` section at the top of `CHANGELOG.md` **before** `npm version`. Each entry starts with what changes for the user (Apple Home, Homebridge UI, log), technical details after it. With several entries, group them under `### Added`, `### Changed`, `### Fixed`, `### Security`.
2. `npm version patch|minor|major` (the npm `version` script runs `scripts/release-notes.mjs` and refuses to continue without the section), then `git push --follow-tags` (needs annotated tags).
3. `publish.yml` checks tag, CHANGELOG, CVEs, lint, build and Homebridge compatibility, **stages** the package with `npm stage publish` (pre-releases with the dist-tag of their identifier, e.g. `--tag beta` for `X.Y.Z-beta.N`, which the Homebridge UI uses to offer newer betas) and creates the GitHub release: title = version without "v", notes from CHANGELOG plus the "Checked for this release" block and a "Changelog" link, `--generate-notes`, pre-releases marked as such.
4. The maintainer approves the staged version with his passkey (npmjs.com → Staged Packages, or `npm stage approve <id>`).
- Never run `npm publish` manually (npm Trusted Publishing is stage-only; a manual publish burns the version number).
- `release-notes.yml` (Actions → Release notes → tag or `all`) refills existing releases from CHANGELOG.
- Plugin depending on a new client version: release and approve the client first, then `npm install --prefer-online` in the plugin (otherwise ETARGET from the npm cache).

### Git and security
- Commit as `tplnet <tplnet@users.noreply.github.com>`; never put the maintainer's real name or e-mail into commits or files.
- `master` is protected against deletion and force pushes. Security issues: private vulnerability reporting (see `SECURITY.md`).
- Never commit credentials, tokens or gateway PINs; mask them in logs and issues.
