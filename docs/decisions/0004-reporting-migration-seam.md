# 0004 — Reporting stays a separate app until the planned migration

- **Status:** Accepted · recorded 2026-09-26

## Context

Reporting grew as a separate app. The end state is one canonical product (Core), but the migration should be planned, bounded and proven, with the Cursor SDK workflow as the planner.

## Decision

- **Reports** is a separate navigation boundary in Core. Reporting currently ships its own duplicate shell and older components.
- The planned Cursor SDK workflow analyses both repos, plans a safe migration, and moves the reporting routes into this canonical app.

## Consequences

- Some differences between Core and Reporting are known and deliberate. Check the ticket before "fixing" drift, since it may be a planned migration item.
- UI fixes need parity proof across both apps (Playwright parity and help-proof jobs).

## Alternatives considered

- **Rewrite Reporting inside Core in one go** — rejected: high risk, and it hides which contracts really differ.

## Where it lives

README "Intentional migration seam", Linear LIQ-5 to LIQ-9, LIQ-12.
