# 0001 — Each app has its own loopback BFF; secrets stay out of the browser

- **Status:** Accepted · recorded 2026-09-26

## Context

The app needs a server-side boundary for data and keys (the AI Assistant's Grok key, for example) without building production auth for a prototype.

## Decision

- A local BFF on `http://127.0.0.1:4000` serves synthetic endpoints (`/api/v1/organisation`, `/api/v1/dashboard`, `/api/v1/invoices`). The frontend calls it through same-origin `/api` routes.
- It **binds to loopback only**, refuses to start outside development/test, requires a bearer token (`LIQUID_BFF_DEMO_TOKEN`), allows only the local app origin by default, rate-limits, and returns `no-store` responses.
- The Vite dev proxy injects the bearer token server-side, so it never reaches browser code.

## Consequences

- Keys and data access stay server-side from the start, so moving to real auth later changes the BFF, not the frontend.
- This is a **demo boundary, not production authentication**. Anything real (customer data, per-user access) needs proper auth first.

## Alternatives considered

- **Calling third-party APIs from the browser** — rejected: exposes keys.
- **One shared BFF for both apps now** — see 0002.

## Where it lives

`server/`, `vite.config.ts` (proxy), README "Core BFF".
