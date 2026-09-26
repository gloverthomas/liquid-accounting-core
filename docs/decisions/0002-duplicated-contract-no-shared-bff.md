# 0002 — The organisation contract is duplicated on purpose; no shared BFF yet

- **Status:** Accepted · recorded 2026-09-26 · Linear LIQ-12

## Context

Core and Reporting both expose `GET /api/v1/organisation`. The long-term goal is one product, but merging the backends before we understand which contracts are really shared would be a "big-bang" change.

## Decision

- Keep the duplicated `organisation` contract in both BFFs **deliberately**. It's the first candidate for the Cursor SDK convergence workflow to identify and classify.
- Keep app-specific read models separate (dashboard and invoices stay in Core).
- **Do not invent a shared BFF yet.**

## Consequences

- Some duplication to maintain until convergence.
- Agent plans that propose a shared BFF or a big-bang merge **fail the eval** on purpose ([workflow 0003](https://github.com/gloverthomas/liquid-workflow/blob/main/docs/decisions/0003-deterministic-eval-harness.md)).

## Alternatives considered

- **Extract a shared BFF now** — rejected until the convergence plan classifies which contracts are really shared.

## Where it lives

`server/`, README "Core BFF".
