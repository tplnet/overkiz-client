# Releasing (maintainers)

[← Back to the README](../README.md)

```sh
npm audit --omit=dev   # must report 0 vulnerabilities
npm version patch      # or minor / major – creates an annotated tag vX.Y.Z
git push --follow-tags
```

The `Publish to npm` workflow **stages** the version on npm via Trusted Publishing (stage-only permission) and creates a GitHub release.
The version becomes public only after approval with 2FA/passkey: npmjs.com → package → *Staged Packages*, or `npm stage approve <stage-id>`
(the id is shown in the workflow run summary and by `npm stage list <package>`).

Release notes: before tagging, describe the changes in a `## X.Y.Z` section at the top of `CHANGELOG.md`. `npm version` refuses to run without it, and the workflow uses this section as the description of the GitHub release (and stops before publishing if it is missing). Start each entry with what changes for the user, technical details after it; with several entries, group them under `### Added`, `### Changed`, `### Fixed` and `### Security`. The release also lists what was checked before it went out (newest Homebridge release, no known vulnerabilities, tested Node.js versions). Pre-release versions (e.g. `1.4.0-beta.1`) are published under the npm dist-tag named after their identifier (`beta`, which the Homebridge UI uses to offer newer betas) and marked as pre-release on GitHub. Existing releases can be (re)filled with *Actions* → *Release notes* → *Run workflow* (tag or `all`).
