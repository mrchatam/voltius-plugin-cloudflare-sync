# Cloudflare Sync (Voltius plugin)

Marketplace plugin that syncs your **encrypted** Voltius vault through a **bring-your-own**
[Cloudflare Worker + R2](https://github.com/mrchatam/voltius-cloudflare-sync-worker) store.

- Encryption stays on-device (`api.crypto.deriveKey` + `sync.exportState` / `importStates`)
- The Worker only stores opaque ciphertext + device metadata
- Transport auth is a Bearer `SYNC_TOKEN` (never reuse it as the encryption passphrase)
- **In-app Deploy Worker** uses the Cloudflare HTTP API (Account ID + API token) so you never leave Voltius Settings

Tracking: [VoltiusApp/voltius#267](https://github.com/VoltiusApp/voltius/issues/267) (marketplace-only; core PR #268 closed).

## Install (dev)

```bash
npm install
npm run build       # → dist/index.js
npm run check       # host specifier gate
```

Copy `manifest.json` and `dist/index.js` into your Voltius plugins folder as
`plugins/plugin-cloudflare-sync/` (folder name must match `manifest.json` `id`), then restart Voltius.

## Deploy the Worker

### In Voltius (recommended)

**Settings → Cloudflare Sync → Deploy Worker**:

1. Cloudflare Account ID + API token (Workers Scripts Edit, Workers R2 Storage Edit, Account Settings Read)
2. **Generate sync token** (fills the Sync token vault field)
3. **Deploy Worker** — creates R2 bucket if needed, uploads the published `worker.mjs` artifact, sets `SYNC_TOKEN`, fills Worker URL
4. Enter a **separate** encryption passphrase → **Create vault** / **Link existing**

The Cloudflare API token is kept in React state only (not persisted). Account ID / Worker name / bucket name are stored in plugin storage.

Secondary: **Copy Deploy-to-Cloudflare URL** copies the official dashboard button URL via `navigator.clipboard` (with toast fallback) for users who prefer that flow. Plain `<a href>` links are a no-op in the Tauri webview.

### Manual / CLI

See [voltius-cloudflare-sync-worker](https://github.com/mrchatam/voltius-cloudflare-sync-worker).

## Permissions

`vault:read/write`, `storage`, `http`, `crypto:derive`, `ui`, `sync:read/write`, `notifications`, `settings-page`.

## License

MIT
