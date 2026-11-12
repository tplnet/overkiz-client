## 1.2.0 (2026-11-12)

Aligned with the Overkiz cloud API rate limits and the Somfy TaHoma Developer Mode (local API) specification.

* Change: no re-login on `429 QUOTA_EXCEEDED` anymore (reverts 1.1.0 behaviour) – a new session only circumvents the per-session quota and risks an account lock; 429 is now logged as a warning
* Change: cloud default `refreshPeriod` is 1440 min (once a day, the documented limit of the bulk state refresh); warning below that. Local API keeps 30 min
* Change: no re-read of all devices after a state refresh on the cloud API (`GET /setup/devices` is limited to once a day); states arrive as events
* Local API: TLS verified against the Overkiz root CA (host name `gateway-<pin>.local`) instead of accepting any certificate; `tlsInsecure: true` as fallback
* Local API: gateway discovery matches the mDNS TXT record `gateway_pin` (Somfy: service name is not reliable)
* Local API: high priority executions fall back to `/exec/apply`; scenarios return an empty list; state refresh re-reads devices (endpoints not offered locally)

## 1.1.0 (2026-11-12) – fork

* Forked from dubocr/overkiz-client 1.0.23, published as `@tplnet/overkiz-client`
* Release via GitHub Actions + npm Trusted Publishing; no automatic version bump on publish
* Fix: `Action.addCommands()` dropped new commands batched for the same device (iterated existing instead of new commands)
* Fix: a failed login was cached forever, so the client never reconnected after a network/DNS error
* Fix: unhandled rejection (process exit) when the device refresh after `RefreshAllDevicesStatesCompletedEvent` failed (upstream PR #12)
* Fix: on `429 QUOTA_EXCEEDED`, re-login and retry once (quota is tied to the session; idea from maximekduval/homebridge-tahoma)
* Feature: `refreshPeriod: 0` disables the periodic full-state refresh
* CI also tests Node.js 26
