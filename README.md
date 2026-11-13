# @tplnet/overkiz-client

[![npm](https://img.shields.io/npm/v/@tplnet/overkiz-client)](https://www.npmjs.com/package/@tplnet/overkiz-client)
[![CI](https://github.com/tplnet/overkiz-client/actions/workflows/ci.yml/badge.svg)](https://github.com/tplnet/overkiz-client/actions/workflows/ci.yml)
[![CVE check](https://github.com/tplnet/overkiz-client/actions/workflows/compat.yml/badge.svg)](https://github.com/tplnet/overkiz-client/actions/workflows/compat.yml)
[![License](https://img.shields.io/npm/l/@tplnet/overkiz-client)](LICENSE)

A Node.js client for the **Overkiz API**, the platform behind **Somfy TaHoma**, Connexoon, **Atlantic / Thermor / Sauter Cozytouch**, Hitachi Hi Kumo, Flexom and Rexel Energeasy.

It talks either to the **local API** of your TaHoma gateway (Somfy *Developer Mode*) or to the manufacturer's **cloud**, keeps device states up to date through event polling and executes commands.

> This is a maintained fork of [dubocr/overkiz-client](https://github.com/dubocr/overkiz-client) by Romain Duboc.
> It is used by [`@tplnet/homebridge-tahoma`](https://github.com/tplnet/homebridge-tahoma). See [CHANGELOG.md](CHANGELOG.md) for the changes compared to the original.

## Contents

- [Features](#features)
- [Installation](#installation)
- [Quick start](#quick-start)
- [Local API or cloud?](#local-api-or-cloud)
- [Configuration](#configuration)
- [Usage](#usage)
- [Cloud rate limits](#cloud-rate-limits)
- [Troubleshooting](#troubleshooting)
- [Security](#security)
- [Releasing (maintainers)](#releasing-maintainers)
- [License](#license)

## Features

- Local API (TaHoma / TaHoma Switch in Developer Mode) and cloud services
- Gateway discovery by PIN via mDNS, TLS verified against the Overkiz root CA
- Real-time state updates through the event listener (`DeviceStateChangedEvent`)
- Command batching: several commands for the same device within 100 ms are sent as one execution
- Execution tracking (`COMPLETED`, `FAILED`, `TIMED_OUT`, …)
- Respects the documented cloud rate limits, automatic reconnect after network errors
- Written in TypeScript, ships type definitions

## Installation

```sh
npm install @tplnet/overkiz-client
```

Tested with Node.js 22, 24 and 26.

## Quick start

```ts
import { Client, Device, State } from '@tplnet/overkiz-client';

const client = new Client(console, {
    service: 'local',
    user: '2001-1234-5678',      // gateway PIN (or IPv4 address)
    password: 'YOUR-LOCAL-TOKEN', // token generated in the TaHoma app
});

const devices = await client.getDevices();
for (const device of devices) {
    console.log(`${device.label} (${device.definition.uiClass} > ${device.definition.widgetName})`);

    device.on('states', (states: State[]) => {
        states.forEach((state) => console.log(`${device.label}: ${state.name} = ${state.value}`));
    });
}
```

The first argument is a logger with `debug`, `info`, `warn` and `error` methods (`console` works).
The client logs in on the first request; event polling starts automatically after the login.

## Local API or cloud?

| | Local API (`service: 'local'`) | Cloud |
|---|---|---|
| Gateways | TaHoma, TaHoma Switch (not the 1st generation square TaHoma / Connectivity Kit) | all Overkiz based gateways |
| Credentials | gateway PIN or IP + local token | account e-mail + password |
| Internet needed | no | yes |
| Rate limits | none | strict, see [below](#cloud-rate-limits) |
| State updates | every 5 s by default | every 60 s by default |
| Scenarios (action groups) | not available | available |

**Use the local API whenever your gateway supports it.**

### Enabling the local API

1. Open the **TaHoma by Somfy** app.
2. Go to *Configure the installation* → *Access the parameters* of your gateway.
3. Tap the gateway PIN (e.g. `2001-1234-5678`) **7 times** quickly to enable *Developer Mode*.
4. Accept the terms and **generate a token**. Copy it right away – it is only shown once.

Then use `service: 'local'`, the PIN (or the gateway's IPv4 address) as `user` and the token as `password`.
Details: [Somfy TaHoma Developer Mode](https://github.com/Somfy-Developer/Somfy-TaHoma-Developer-Mode).

> **Note:** local and cloud API use different device identifiers (`deviceURL`). Switching between them makes devices appear as new ones.

## Configuration

Options passed as second argument to `new Client(log, config)`:

| Option | Type | Default | Description |
|---|---|---|---|
| `service` | string | `somfy_europe` | `local` or a cloud service, see below |
| `user` | string | – | Local: gateway PIN or IPv4 address. Cloud: account e-mail |
| `password` | string | – | Local: token from the TaHoma app. Cloud: account password |
| `pollingPeriod` | number (s) | `5` local / `60` cloud | Event polling period. Cloud: at least 10, at most 60 recommended |
| `execPollingPeriod` | number (s) | `2` local / `5` cloud | Polling period while executions are running |
| `refreshPeriod` | number (min) | `30` local / `1440` cloud | Periodic full state refresh, `0` disables it. Needed for RTS devices and physical remotes that do not report their state |
| `tlsInsecure` | boolean | `false` | Local only: skip TLS certificate verification (fallback if your gateway's certificate is rejected) |
| `proxy` | string | – | Optional URL of a forwarding proxy: requests are sent to it with the original host in an `X-Forward-Host` header (not a standard HTTP proxy) |

### Services

| `service` | Platform |
|---|---|
| `local` | Somfy local API (TaHoma, TaHoma Switch) |
| `somfy_europe`, `tahoma`, `tahoma_switch`, `connexoon` | Somfy Europe |
| `somfy_australia`, `connexoon_rts` | Somfy Australia / Oceania |
| `somfy_north_america` | Somfy North America |
| `cozytouch` | Atlantic, Thermor, Sauter Cozytouch |
| `hi_kumo` | Hitachi Hi Kumo |
| `flexom` | Bouygues Flexom |
| `rexel` | Rexel Energeasy Connect |

## Usage

### Read devices and states

```ts
const devices = await client.getDevices();       // devices with their sensors attached
const device = devices[0];

device.hasState('core:ClosureState');           // true / false
device.getState('core:ClosureState')?.value;    // e.g. 0 … 100

device.on('states', (states) => { /* states changed */ });
```

`getSetup()` returns gateways and devices in one call, `getGateways()` only the gateways.

### Execute a command

```ts
import { Action, Command, Execution, ExecutionState } from '@tplnet/overkiz-client';

const action = new Action(device.deviceURL, [new Command('setClosure', [50])]);
action.on('update', (state: ExecutionState, event) => {
    console.log(`${device.label}: ${state}`);    // TRANSMITTED, IN_PROGRESS, COMPLETED, FAILED …
});

const execId = await client.execute('apply', new Execution('Half open - my app', action));

// cancel if needed
await client.cancelExecution(execId);
```

Available commands depend on the device; see `device.definition.commands`.

### Client events

```ts
client.on('connect', () => console.log('logged in'));
client.on('disconnect', () => console.log('session lost, will reconnect'));
```

### Other methods

| Method | Description |
|---|---|
| `refreshAllStates()` | Ask for a full state refresh (local: re-reads all devices) |
| `refreshDeviceStates(deviceURL)` | Refresh one device (cloud only) |
| `getStates(deviceURL)` / `getState(deviceURL, name)` | Read states directly from the API |
| `getActionGroups()` | Scenarios (cloud only, empty list locally) |
| `getSetupLocation()` | Setup location (cloud only) |
| `isLocal` | `true` when using the local API |

## Cloud rate limits

The Overkiz cloud limits several endpoints **per session**, for example:

| Endpoint | Limit |
|---|---|
| Full state refresh (`/setup/devices/states/refresh`) | 1 per day |
| Device list (`/setup/devices`) | 1 per day |
| Executions (`/exec/apply`) | rate limited |
| Event fetch | 1 per second |

That is why the cloud defaults are a refresh period of one day and a polling period of 60 s.
If you see `429 QUOTA_EXCEEDED`, increase `refreshPeriod` (or set it to `0`) – or switch to the local API, which has no limits.
The client does **not** log in again to reset the quota, as that would circumvent the limit and may get the account locked.

## Troubleshooting

| Problem | What to check |
|---|---|
| `No gateway found on your network` | Developer Mode enabled? Gateway in the same network/VLAN as the host (mDNS)? Otherwise use the gateway's IP address as `user` |
| Certificate error with the local API | Set `tlsInsecure: true` and please open an issue with the error message |
| `401` with the local API | Token revoked or mistyped – generate a new one in the TaHoma app |
| `429 QUOTA_EXCEEDED` (cloud) | See [Cloud rate limits](#cloud-rate-limits) |
| Changes made with a remote do not show up | RTS devices cannot report states; keep `refreshPeriod` enabled |

Issues: <https://github.com/tplnet/overkiz-client/issues>

## Security

The client is kept free of **known vulnerabilities (CVEs)**:

- The [CVE check](https://github.com/tplnet/overkiz-client/actions/workflows/compat.yml) workflow runs `npm audit` **weekly and on every dependency change** – any known vulnerability in the runtime dependencies fails the check.
- **Every release** runs the same check before the version is staged on npm.
- **Dependabot** opens weekly pull requests for dependency and GitHub Actions updates. Each of them runs CI and the CVE check – when the checks are green, the update can simply be merged.
- Compatibility with the newest Homebridge release is checked in [`@tplnet/homebridge-tahoma`](https://github.com/tplnet/homebridge-tahoma#compatibility-and-security), which uses this client.

Found a security issue? Please report it privately via GitHub (*Security* → *Report a vulnerability*) instead of a public issue.

## Releasing (maintainers)

```sh
npm audit --omit=dev   # must report 0 vulnerabilities
npm version patch      # or minor / major – creates an annotated tag vX.Y.Z
git push --follow-tags
```

The `Publish to npm` workflow **stages** the version on npm via Trusted Publishing (stage-only permission) and creates a GitHub release.
The version becomes public only after approval with 2FA/passkey: npmjs.com → package → *Staged Packages*, or `npm stage approve <stage-id>`
(the id is shown in the workflow run summary and by `npm stage list <package>`).

## License

[Apache License 2.0](LICENSE). Original work © Romain Duboc and contributors, modifications © 2026 tplnet – see [NOTICE](NOTICE).
