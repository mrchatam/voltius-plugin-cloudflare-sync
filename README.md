# Cloudflare Sync (Voltius plugin)

Marketplace plugin that syncs your **encrypted** Voltius vault through a **bring-your-own**
[Cloudflare Worker + R2](https://github.com/mrchatam/voltius-cloudflare-sync-worker) store.

- Encryption stays on-device (`api.crypto.deriveKey` + `sync.exportState` / `importStates`)
- The Worker only stores opaque ciphertext + device metadata
- Transport auth is a Bearer `SYNC_TOKEN` (never reuse it as the encryption passphrase)
- **In-app Deploy Worker** uses the Cloudflare HTTP API (Account ID + API token) so you never leave Voltius Settings

Tracking: [VoltiusApp/voltius#267](https://github.com/VoltiusApp/voltius/issues/267)
(marketplace-only; core PR #268 closed / not reopened). Aligned with maintainer fixes from
[VoltiusApp/marketplace#17](https://github.com/VoltiusApp/marketplace/pull/17) (v0.2.3).

## Why Cloudflare Sync instead of Gist?

| | Cloudflare Sync | Gist Sync |
| --- | --- | --- |
| Store | Your Cloudflare R2 bucket | A GitHub Gist |
| Auth to backend | Worker `SYNC_TOKEN` (no GitHub PAT) | GitHub PAT |
| Deploy | In-app Deploy Worker, or Deploy-to-Cloudflare / Wrangler | N/A (Gist API) |
| Backend shape | Dedicated Worker API + ETag concurrency | Gist file API |
| Encryption | Client-side E2EE (passphrase) | Client-side E2EE (passphrase) |

Both keep encryption on-device. This plugin is for self-hosters who prefer Cloudflare infra over GitHub as the sync transport.

## Layout

- `src/` — the plugin
- `worker/` — Worker source vendored for build-time inlining. `npm run build` bundles it into `index.js`, so **Deploy Worker** uploads a reviewed, hash-pinned script (not `releases/latest`).
- Keep [voltius-cloudflare-sync-worker](https://github.com/mrchatam/voltius-cloudflare-sync-worker) in sync when changing Worker behaviour.

## Build

```bash
npm ci
npm run typecheck
npm run build       # → index.js (with worker/ inlined) + dist/worker.mjs
npm run check       # host specifier gate
```

Worker tests (from `worker/` or the sibling worker repo):

```bash
cd worker && npm ci && npm run typecheck && npm test
```

## Deploy the Worker

### Option 1 — In-app (recommended)

**Settings → Cloudflare Sync → Deploy Worker**:

1. Cloudflare Account ID + API token (Workers Scripts Edit, Workers R2 Storage Edit, Account Settings Read)
2. **Generate sync token**
3. **Deploy Worker** — creates the R2 bucket if needed, uploads the **bundled** Worker, sets `SYNC_TOKEN`, fills Worker URL
4. Enter a **separate** encryption passphrase → **Create vault** / **Link existing**

The Worker URL, sync token and passphrase are saved only when Create vault or Link existing
succeeds. The Cloudflare API token is kept in React state only (never persisted). Account ID /
Worker name / bucket name are stored in plugin storage.

### Option 2 — Copy Deploy-to-Cloudflare URL

**Copy Deploy-to-Cloudflare URL** copies the official dashboard button URL for
[mrchatam/voltius-cloudflare-sync-worker](https://github.com/mrchatam/voltius-cloudflare-sync-worker)
(via `navigator.clipboard`, with toast fallback). Plain `<a href>` links are a no-op in the Tauri webview.

### Manual / CLI

See [voltius-cloudflare-sync-worker](https://github.com/mrchatam/voltius-cloudflare-sync-worker).

## Permissions

`vault:read/write`, `storage`, `http`, `crypto:derive`, `ui`, `sync:write`, `notifications`, `settings-page`.

## License

MIT
