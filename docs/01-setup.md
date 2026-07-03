# Developer Setup

## Prerequisites

- **Node.js**: No `.nvmrc` is present. The project uses Vite 8, React 19, and TypeScript 6 — use Node.js 20 LTS or later. Node.js 22 LTS is the recommended choice.
- **Package manager**: npm (no lock file for pnpm or yarn is present). The `package.json` scripts all use `npm run`.

## Installing Dependencies

```
cd purchase_order_management_web
npm install
```

## Running the Dev Server

```
npm run dev
```

The dev server runs on **port 46258** (not the Vite default of 5173 — the port is deliberately non-standard to avoid collisions with other local apps). It uses **HTTPS** via `@vitejs/plugin-basic-ssl`, which is required for the session cookie to work (see API proxy section below).

Open the app at: `https://localhost:46258`

Your browser will show a self-signed-certificate warning. Accept it to proceed (the certificate is local only).

## Building for Production

```
npm run build
```

This runs `tsc -b && vite build`. Output goes to `dist/`. The production build should be served from the same host/origin as the API so the session cookie can round-trip.

## Previewing the Production Build

```
npm run preview
```

Also serves on port 46258.

## Linting

```
npm run lint
```

The project uses [oxlint](https://github.com/oxc-project/oxlint) (configured in `.oxlintrc.json`). There is no Prettier or ESLint.

## End-to-End Tests

```
npm run test:e2e
```

Requires [Playwright](https://playwright.dev/). Run `npx playwright install` on first use to install browsers.

## Environment Variables

There are no `.env` files checked in and no custom `VITE_*` variables are read anywhere in the source. The API base URL is hard-coded as `/api` in `src/api/client.ts` and `src/api/filesApi.ts`. The relative path is intentional — see API proxy below.

## API Proxy

The Vite dev server proxies all requests beginning with `/api` to the backend:

```ts
// vite.config.ts
proxy: {
  '/api': {
    target: 'http://localhost:29739',
    changeOrigin: true,
    secure: false,
  },
},
```

The backend API must be running on **`http://localhost:29739`** during development. The proxy is what allows the SPA (on `https://localhost:46258`) and the API (on `http://localhost:29739`) to share the same effective origin for the session cookie.

The session cookie is configured `Secure` and `SameSite=Strict` on the backend, which is why HTTPS is required for the SPA — a plain HTTP dev server would cause the browser to block the cookie.

In production, the SPA and API are expected to be served from the same origin (or behind a reverse proxy that maps `/api` through), so no explicit proxy configuration is needed.
