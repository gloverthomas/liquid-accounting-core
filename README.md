# Liquid Accounting Core

The canonical accounting shell for the two-repository convergence prototype.

## Run locally

```bash
npm install
npm run dev
```

The app starts on `http://localhost:3000`. The **Reports** navigation item deliberately links to `http://localhost:3001`, where the independently deployed reporting application will run.

## Core BFF

Run both the local Core BFF and frontend with the same local token. The Vite development proxy injects it server-side, so it is never exposed to browser code:

```bash
LIQUID_BFF_DEMO_TOKEN=replace-with-a-local-value npm run api
LIQUID_BFF_DEMO_TOKEN=replace-with-a-local-value npm run dev
```

The BFF runs on `http://127.0.0.1:4000`; the frontend calls it through same-origin `/api` routes.

The BFF has synthetic endpoints for:

- `GET /api/v1/organisation`
- `GET /api/v1/dashboard`
- `GET /api/v1/invoices`

It deliberately duplicates the organisation contract exposed by the Reporting BFF. The planned migration workflow should identify that shared contract while keeping Core-specific data endpoints separate.

The dashboard organisation and bank-balance card consume the BFF. Remaining screen data is intentionally static synthetic fixture data, so the migration workflow has both live contracts and existing presentation fixtures to classify.

The server binds to loopback only, requires a bearer token from `LIQUID_BFF_DEMO_TOKEN`, only allows the local Core app origin by default, rate limits requests, and returns no-store responses. It refuses to start outside development/test mode. It is a demo boundary, not a production authentication implementation.

## PostHog

Product analytics is optional and privacy-constrained. Copy `.env.example` to `.env.local` and set a project token (`phc_...`) plus an official PostHog host. If those values are missing or invalid, the app renders without analytics.

You can also run the interactive installer:

```bash
npx -y @posthog/wizard@latest
```

That wizard cannot be completed non-interactively here, so both apps also include a manual React SDK setup. Autocapture and session replay are off. Only allowlisted events leave the browser (`product_navigation`, `create_dialog_opened`, `bff_status`, plus PostHog pageview/pageleave). Financial amounts, organisation names, and other PII are not captured.

To point the app at a deployed reporting service, set this before building:

```bash
VITE_REPORTING_APP_URL=https://reports.example.test npm run build
```

## Brand assets

The app uses the supplied Space Grotesk family when it is installed on the presentation machine, and falls back to the system sans-serif stack otherwise. Install the supplied files before the demo to preserve the intended typography.

## Intentional migration seam

`Reports` is a separate navigation boundary. The reporting app will initially ship a duplicate shell and an older component implementation. The later Cursor SDK workflow can analyse both repositories, plan a safe migration, and move the reporting routes into this canonical application.
