# Troubleshooting

[← Back to the README](../README.md)

| Problem | What to check |
|---|---|
| `No gateway found on your network` | Developer Mode enabled? Gateway in the same network/VLAN as the host (mDNS)? Otherwise use the gateway's IP address as `user` |
| Certificate error with the local API | Set `tlsInsecure: true` and please open an issue with the error message |
| `401` with the local API | Token revoked or mistyped – generate a new one in the TaHoma app |
| `429 QUOTA_EXCEEDED` (cloud) | See [Cloud rate limits](configuration.md#cloud-rate-limits) |
| Changes made with a remote do not show up | RTS devices cannot report states; keep `refreshPeriod` enabled |

Issues: <https://github.com/tplnet/overkiz-client/issues>
