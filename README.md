# Voltius plugin template

A working [Voltius](https://github.com/VoltiusApp/voltius) plugin you can build in one command.
Click **Use this template** and start editing.

It registers a right-panel section, reads a setting the host renders for you, and is wired with
the exact build flags Voltius requires.

## Quick start

```bash
npm install
npm run build       # → dist/index.js
```

Then load it in the app:

1. Find your app data directory — `%APPDATA%\Voltius\` (Windows),
   `~/Library/Application Support/Voltius/` (macOS), `~/.config/voltius/` (Linux).
2. Create `plugins/my-plugin/` inside it. **The folder name must match `id` in `manifest.json`.**
3. Copy `manifest.json` and `dist/index.js` into it.
4. Restart Voltius. The plugin appears under **Settings → Plugins**.

## What's here

| Path | |
|---|---|
| `manifest.json` | id, permissions, and a `contributes.configuration` setting the host renders |
| `src/index.tsx` | the `register` entry point and its cleanup function |
| `src/Panel.tsx` | the right-panel component |
| `scripts/check-externals.mjs` | fails the build if you import something the host can't provide |

## The build flags are not optional

Voltius provides six modules and rewrites those imports to its own live instances when it loads
your bundle. Ship your own copy of one and it will load without error, then misbehave:

- **`react`, `react/jsx-runtime`, `react-dom`** — a second React has a null hook dispatcher, so
  every hook throws. `react/jsx-runtime` is pulled in by the automatic JSX transform, which this
  template (and most modern setups) uses.
- **`@iconify/react`** — you'd get your own icon storage, and the host's hand-written collections
  (`devicon`, `simple-icons`, `custom`) would render as an empty `<span>` with no error.
- **`@voltius/ui`** — the host's own components, so your UI matches the app.
- **`@voltius/api`** — reserved; keep it external.

**Every other bare import is rejected at load time and your plugin will not load at all**
(`Plugin bundle imports disallowed specifier: "lodash"`). Bundle your dependencies — esbuild does
that by default — or drop them. Relative imports are fine.

`npm run check` enforces this. It fetches the specifier list from Voltius itself rather than
trusting a copy here, so it also catches the host changing the contract.

## Types

`PluginAPI` comes from the [`@voltius/plugin-types`](https://www.npmjs.com/package/@voltius/plugin-types)
dev dependency:

```sh
npm install --save-dev @voltius/plugin-types
```

Its version tracks the app, so `@voltius/plugin-types@0.15.0` is the API Voltius 0.15.0 exposes —
install the one matching the oldest release you support, and keep `minAppVersion` in
`manifest.json` in step. One install also covers the `@voltius/ui` types.

## Docs

- [Developing plugins](https://docs.voltius.app/plugins/developing)
- [PluginAPI reference](https://docs.voltius.app/plugins/api-reference)
- [Publishing to the marketplace](https://github.com/VoltiusApp/marketplace)
