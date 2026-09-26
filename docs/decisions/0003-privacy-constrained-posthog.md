# 0003 — PostHog: allowlisted events and properties only

- **Status:** Accepted · recorded 2026-09-26

## Context

We want product analytics (navigation, AI Assistant usage, BFF health) without capturing financial amounts, organisation names or personal data, in an accounting product.

## Decision

- Analytics is **optional**: without a valid `phc_` token and an official PostHog host, the app runs without it.
- `autocapture` off, **session recording off**, text and attribute masking on, `memory` persistence (the anonymous id resets each visit), and a denylist for `$ip`, `$email`, `$name` and financial fields.
- Only **allowlisted events** leave the browser (`$pageview`, `$pageleave`, `product_navigation`, `report_opened`, `bff_status`, `assistant_message_sent`, `create_dialog_opened`, `invoice_deep_link_miss`).
- `before_send` runs the unit-tested `prepareEvent`, which keeps allowlisted properties plus the two fields PostHog needs to ingest (`token`, `distinct_id`) and strips everything else.

## Consequences

- Events carry categories, never content. For example, `assistant_message_sent` records outcome, not message text.
- A new event or property needs an allowlist change and a test. Stripping `token` by mistake silently drops **all** events (this happened once and was fixed in PR #12).

## Alternatives considered

- **Autocapture + session replay** — rejected for an accounting product.

## Where it lives

`src/analytics.ts` (+ tests), README "PostHog".
