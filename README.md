# Cloudflare Sync (Voltius plugin)

Marketplace plugin that syncs your **encrypted** Voltius vault through a **bring-your-own**
[Cloudflare Worker + R2](https://github.com/mrchatam/voltius-cloudflare-sync-worker) store.

- Encryption stays on-device (`api.crypto.deriveKey` + `sync.exportState` / `importStates`)
- The Worker only stores opaque ciphertext + device metadata
- Transport auth is a Bearer `SYNC_TOKEN` (never reuse it as the encryption passphrase)

Tracking: [VoltiusApp/voltius#267](https://github.com/VoltiusApp/voltius/issues/267) (marketplace-only; core PR #268 closed).

## Install (dev)

```bash
npm install
npm run build       # → dist/index.js
```

Copy `manifest.json` and `dist/index.js` into your Voltius plugins folder as
`plugins/plugin-cloudflare-sync/` (folder name must match `manifest.json` `id`), then restart Voltius.

## Deploy the Worker

One-click:

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/mrchatam/voltius-cloudflare-sync-worker)

Full steps: [voltius-cloudflare-sync-worker](https://github.com/mrchatam/voltius-cloudflare-sync-worker).

Then in Voltius → **Settings → Cloudflare Sync**: paste Worker URL, sync token, and a **separate** encryption passphrase → **Create vault** / **Link existing**.

## Permissions

`vault:read/write`, `storage`, `http`, `crypto:derive`, `ui`, `sync:read/write`, `notifications`, `settings-page`.

## License

MIT
