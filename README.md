# @tplnet/overkiz-client

[![npm](https://img.shields.io/npm/v/@tplnet/overkiz-client)](https://www.npmjs.com/package/@tplnet/overkiz-client)
[![CI](https://github.com/tplnet/overkiz-client/actions/workflows/ci.yml/badge.svg)](https://github.com/tplnet/overkiz-client/actions/workflows/ci.yml)
[![CVE check](https://github.com/tplnet/overkiz-client/actions/workflows/compat.yml/badge.svg)](https://github.com/tplnet/overkiz-client/actions/workflows/compat.yml)
[![Malware scan](https://github.com/tplnet/overkiz-client/actions/workflows/malware.yml/badge.svg)](https://github.com/tplnet/overkiz-client/actions/workflows/malware.yml)
[![License](https://img.shields.io/npm/l/@tplnet/overkiz-client)](LICENSE)

A Node.js client for the **Overkiz API**, the platform behind **Somfy TaHoma**, Connexoon, **Atlantic / Thermor / Sauter Cozytouch**, Hitachi Hi Kumo, Flexom and Rexel Energeasy.

It talks either to the **local API** of your TaHoma gateway (Somfy *Developer Mode*) or to the manufacturer's **cloud**, keeps device states up to date through event polling and executes commands.

> This is a maintained fork of [dubocr/overkiz-client](https://github.com/dubocr/overkiz-client) by Romain Duboc.
> It is used by [`@tplnet/homebridge-tahoma`](https://github.com/tplnet/homebridge-tahoma). See [CHANGELOG.md](CHANGELOG.md) for the changes compared to the original.

> **Note:** Private hobby project, developed in spare time with the help of AI tools. Use at your own risk; support is best effort. See the [disclaimer](#disclaimer).

## Contents

- [Features](#features)
- [Installation](#installation)
- [Quick start](#quick-start)
- [Local API or cloud?](#local-api-or-cloud)
- [Configuration](#configuration)
- [Usage](#usage)
- [Troubleshooting](#troubleshooting)
- [Security](#security)
- [Documentation](#documentation)
- [Disclaimer](#disclaimer)
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
| Rate limits | none | strict, see [below](https://github.com/tplnet/overkiz-client/blob/master/docs/configuration.md#cloud-rate-limits) |
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

All options of `new Client(log, config)` – services, polling and refresh periods, TLS, proxy – and the cloud rate limits are described in **[docs/configuration.md](https://github.com/tplnet/overkiz-client/blob/master/docs/configuration.md)**.

## Usage

Reading devices and states, executing and cancelling commands, client events and all other methods: **[docs/usage.md](https://github.com/tplnet/overkiz-client/blob/master/docs/usage.md)**.

## Troubleshooting

Gateway not found, certificate errors, `401`, `429 QUOTA_EXCEEDED`, missing remote changes: see **[docs/troubleshooting.md](https://github.com/tplnet/overkiz-client/blob/master/docs/troubleshooting.md)**.

## Security

The client is kept free of **known vulnerabilities (CVEs)** and **malware**:

- The [CVE check](https://github.com/tplnet/overkiz-client/actions/workflows/compat.yml) workflow runs `npm audit` **weekly and on every dependency change** – any known vulnerability in the runtime dependencies fails the check.
- **Every release** runs the same CVE and malware checks before the version is staged on npm.
- **Malware scan** ([workflow](https://github.com/tplnet/overkiz-client/actions/workflows/malware.yml), weekly, on every dependency change and before every release): [OSV-Scanner](https://google.github.io/osv-scanner/) checks all dependencies against the list of **known malicious npm packages**, and [ClamAV](https://www.clamav.net/) scans the package as it is published plus all installed dependencies for **malware**. Dependencies are installed with `npm ci --ignore-scripts`, so their install scripts never run in the build.
- **Dependabot** opens weekly pull requests for dependency and GitHub Actions updates. Each of them runs CI and the CVE check – when the checks are green, the update can simply be merged.
- Compatibility with the newest Homebridge release is checked in [`@tplnet/homebridge-tahoma`](https://github.com/tplnet/homebridge-tahoma#compatibility-and-security), which uses this client.

Found a security issue? Please report it privately via GitHub (*Security* → *Report a vulnerability*) instead of a public issue.

## Documentation

- [Configuration](https://github.com/tplnet/overkiz-client/blob/master/docs/configuration.md) – options, services, cloud rate limits
- [Usage](https://github.com/tplnet/overkiz-client/blob/master/docs/usage.md) – devices, states, commands, events
- [Troubleshooting](https://github.com/tplnet/overkiz-client/blob/master/docs/troubleshooting.md)
- [Releasing](https://github.com/tplnet/overkiz-client/blob/master/docs/releasing.md) – for maintainers
- [Changelog](CHANGELOG.md)

## Disclaimer

This is a private development project. It exists to keep the library compatible with current Node.js and Homebridge releases, to apply security updates, to add features and to fix bugs.

- It is developed in spare time and with the help of AI tools. Every change goes through the automated checks described under [Security](#security) and is tested with real devices where possible, but mistakes can still happen.
- **Use at your own risk.** The library is provided as is, without any warranty (see the [Apache License 2.0](LICENSE)).
- Questions, bug reports and feature requests are welcome and are handled on a best-effort basis. There is no guaranteed response time and no guarantee that a request will be implemented.
- This project is not affiliated with or endorsed by Somfy, Overkiz, Apple or the Homebridge project. All product names are trademarks of their respective owners.

## License

[Apache License 2.0](LICENSE). Original work © Romain Duboc and contributors, modifications © 2026 tplnet – see [NOTICE](NOTICE).
