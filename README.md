# Kopia HTML Ui

This is the repository for the html UI for kopia. It is bundled as part of the [kopia UI releases (e.g. `KopiaUI-Setup-X.Y.Z.exe` or a `kopiaui` package)](https://kopia.io/docs/installation/#two-variants-of-kopia).

How to use it: see the [user guide](docs/user-guide.md).

## Reporting issues

If you want to report a bug or have an idea for a feature request, please use the [issues list of the main kopia repository](https://github.com/kopia/kopia/issues?q=is%3Aissue+is%3Aopen+gui).

## Development

The UI is written in TypeScript with [React](https://react.dev/) and [Mantine](https://mantine.dev/). It talks to a kopia server through its REST API (`/api/v1`).

| Folder          | Contents                                                                 |
| --------------- | ------------------------------------------------------------------------ |
| `src/app`       | The UI: pages, layout, setup wizard, dev mock                            |
| `src/api`       | Typed API client, endpoints and polling hooks                            |
| `src/prototype` | Clickable design prototype with mock data (dev only, `/prototype.html`)  |
| `docs/ui-spec`  | Specification of the UI (fields, logic, strings) shared with native apps |
| `tests`         | Vitest tests                                                             |

```bash
npm install
npm start          # dev server on http://localhost:3000, proxies /api to localhost:51515
npm test           # unit tests
npm run lint
npm run build      # production build in build/
```

### Without a kopia server

Add `?mock=1` to any URL of the dev server (e.g. http://localhost:3000/snapshots?mock=1) to use a built-in fake server with sample data. `?mock=empty` starts without sources, `?mock=disconnected` without a repository, `?mock=0` switches back to the real server.

### With a kopia server

As the UI might be ahead of the latest release and depend on changes in the server, it's recommended to clone the [kopia server repository](https://github.com/kopia/kopia#readme) next to this one and start the server from there (Go required):

```bash
#! /bin/bash
(
  cd ../kopia
  # For development, better use a separate repository config, not your normal one:
  go run . server start --insecure --without-password --disable-csrf-token-checks --log-level=debug --config-file=$HOME/.config/kopia/disabled/repository-dev.config
)
```

To try a production build the way KopiaUI serves it (with CSRF protection), point the server at the build:

```bash
npm run build
(cd ../kopia && go run . server start --insecure --without-password --html=../htmlui/build)
```
