# Bugbot — Liquid accounting

## Product context

Two customer-facing apps (Core + Reporting) share a duplicated shell on purpose. Cross-repo drift is expected until a bounded convergence PR lands.

## Review priorities for LIQ-9 style PRs

1. Prefer fixing deep-links / hashes over inventing a shared BFF.
2. Do not suggest merging all of Reporting into Core in the same PR.
3. Keep PostHog allowlists fail-closed: no PII (`$email`, `$name`, amounts).
4. Playwright parity assertions should match the intended seam (legacy alias vs canonical hash).
5. Vercel/static SPA rewrites are fine; do not require auth invention for demo BFFs.

## Out of scope (flag but do not expand the PR)

- Full design-system extraction
- Shared BFF / production auth
- Session recording / heatmaps
