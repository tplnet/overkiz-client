# Configuration

[← Back to the README](../README.md)

- [Options](#options)
- [Services](#services)
- [Cloud rate limits](#cloud-rate-limits)

## Options

Options passed as second argument to `new Client(log, config)`:

| Option | Type | Default | Description |
|---|---|---|---|
| `service` | string | `somfy_europe` | `local` or a cloud service, see below |
| `user` | string | – | Local: gateway PIN or IPv4 address. Cloud: account e-mail |
| `password` | string | – | Local: token from the TaHoma app. Cloud: account password |
| `pollingPeriod` | number (s) | `5` local / `60` cloud | Event polling period. Cloud: at least 10, at most 60 recommended |
| `execPollingPeriod` | number (s) | `2` local / `5` cloud | Polling period while executions are running |
| `refreshPeriod` | number (min) | `5` local / `1440` cloud | Periodic full state refresh, `0` disables it. Local: re-reads the states the gateway knows and catches changes it did not send as events. Cloud: asks the gateway to query the devices, allowed once a day |
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
