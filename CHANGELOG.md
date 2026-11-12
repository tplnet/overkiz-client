## 1.1.0 (2026-11-12) – fork

* Forked from dubocr/overkiz-client 1.0.23, published as `@tplnet/overkiz-client`
* Release via GitHub Actions + npm Trusted Publishing; no automatic version bump on publish
* Fix: `Action.addCommands()` dropped new commands batched for the same device (iterated existing instead of new commands)
* Fix: a failed login was cached forever, so the client never reconnected after a network/DNS error
* Fix: unhandled rejection (process exit) when the device refresh after `RefreshAllDevicesStatesCompletedEvent` failed (upstream PR #12)
* Fix: on `429 QUOTA_EXCEEDED`, re-login and retry once (quota is tied to the session; idea from maximekduval/homebridge-tahoma)
* Feature: `refreshPeriod: 0` disables the periodic full-state refresh
* CI also tests Node.js 26
