## 1.3.2 (2026-11-13)

* Fix: an execution is removed as soon as it reaches a terminal state (COMPLETED, FAILED, TIMED_OUT, NOT_TRANSMITTED). The local API does not send `timeToNextState: -1` on completion, so finished executions stayed in the pool for 2 minutes: a wrong `TIMED_OUT` was reported after a successful command, the device was considered busy (state updates ignored) and event polling stayed at the faster execution rate. The safety timeout is now cleared when an execution ends

## 1.3.1 (2026-11-13)

* Local API: after an outage (e.g. power loss or restart of the gateway) the client keeps trying the gateway's last known IP address when mDNS does not find it, instead of falling back to `gateway-<pin>.local` (not resolvable on many systems) – reconnects faster
* Local API: clearer log messages – the outage is logged once ("Gateway not reachable … Retrying"), the recovery as "Gateway reachable again"; updated help text and link for the gateway search; `tlsInsecure` warning only once
* The expected `400 No registered event listener` after a gateway restart is logged as info and a new listener is registered immediately (no error, no back-off)

## 1.3.0 (2026-11-12)

* Change: local API polls events every 5 s (executions: 2 s) by default instead of 60 s / 5 s – changes made with a remote or the TaHoma app show up in HomeKit within seconds. Cloud defaults unchanged
* Fix: back-off after event polling errors is capped at 5 minutes (was doubling without limit, so polling could stall for hours after a gateway reboot)
* Fix: mDNS gateway search closes its socket when done (leaked one UDP socket per (re)login)
* Fix: gateway configured by PIN is searched again after a network error (new IP address, e.g. DHCP), instead of retrying the old address until restart
* Fix: limit of 10 simultaneous executions was never applied (execution pool length was always 0)
* Fix: credentials check tested `user` twice instead of `user` and `password`

## 1.2.1 (2026-11-12)

* Security: axios ^1.21.1 (GHSA-vh66-26gq-q6x8, GHSA-9fr6-4gfg-395g, GHSA-c29m-xwm3-cm6r), pulls follow-redirects 1.16.3 (GHSA-q3jh-wrc6-jgq8, GHSA-8r9p-f939-6h3c, GHSA-mrwp-f3q8-3g9p)
* Dev dependencies: `npm audit fix`, override minimatch ^11.0.8 (GHSA-g3hv-75wg-m249) – `npm audit` reports 0 vulnerabilities

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
