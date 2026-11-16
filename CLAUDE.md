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

These apply to `@tplnet/homebridge-tahoma`, `@tplnet/overkiz-client`, `homebridge-tahoma-local` and `@tplnet/homebridge-denon-heos-audio`. Keep the four projects consistent: a change to the release or check process in one of them goes into all of them.

### Language and wording
- Code, comments, README, CHANGELOG and commit messages in English. No German translation of the plugin.
- User-facing text says "Apple Home", not "HomeKit" (README, settings schema, log messages, execution labels). Technical code comments may keep "HomeKit".

### Compatibility and CVEs
- Every change and every release: `npm audit --omit=dev` must report 0 vulnerabilities in the runtime dependencies, and plugins must start with the newest Homebridge release (smoke test against `homebridge@latest`, CI on Node.js 22, 24 and 26).
- Automated in `.github/workflows/compat.yml` (weekly, on dependency changes) and in `publish.yml` (blocks the release). Keep this documented in the README.
- Dependabot pull requests can be merged when all checks are green.

### Release process
1. Write a `## X.Y.Z (YYYY-MM-DD)` section at the top of `CHANGELOG.md` **before** `npm version`. Each entry starts with what changes for the user (Apple Home, Homebridge UI, log), technical details after it. With several entries, group them under `### Added`, `### Changed`, `### Fixed`, `### Security`.
2. `npm version patch|minor|major` (the npm `version` script runs `scripts/release-notes.mjs` and refuses to continue without the section), then `git push --follow-tags` (needs annotated tags).
3. `publish.yml` checks tag, CHANGELOG, CVEs, lint, build and Homebridge compatibility, **stages** the package with `npm stage publish` (pre-releases with `--tag next`) and creates the GitHub release: title = version without "v", notes from CHANGELOG plus the "Checked for this release" block and a "Changelog" link, `--generate-notes`, pre-releases marked as such.
4. The maintainer approves the staged version with his passkey (npmjs.com → Staged Packages, or `npm stage approve <id>`).
- Never run `npm publish` manually (npm Trusted Publishing is stage-only; a manual publish burns the version number).
- `release-notes.yml` (Actions → Release notes → tag or `all`) refills existing releases from CHANGELOG.
- Plugin depending on a new client version: release and approve the client first, then `npm install --prefer-online` in the plugin (otherwise ETARGET from the npm cache).

### Git and security
- Commit as `tplnet <tplnet@users.noreply.github.com>`; never put the maintainer's real name or e-mail into commits or files.
- `master` is protected against deletion and force pushes. Security issues: private vulnerability reporting (see `SECURITY.md`).
- Never commit credentials, tokens or gateway PINs; mask them in logs and issues.
