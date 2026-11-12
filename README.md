# @tplnet/overkiz-client

> Maintained fork of [dubocr/overkiz-client](https://github.com/dubocr/overkiz-client), used by [`@tplnet/homebridge-tahoma`](https://github.com/tplnet/homebridge-tahoma).
Overkiz API client


## Releasing (maintainers)

```
npm version patch   # or minor / major
git push --follow-tags
```
The `Publish to npm` workflow **stages** the version on npm via Trusted Publishing (stage-only permission) and creates a GitHub release.
The version becomes public only after approval with 2FA/passkey: npmjs.com > package > Staged Packages, or `npm stage approve <stage-id>`
(the id is shown in the workflow run summary and by `npm stage list <package>`).
