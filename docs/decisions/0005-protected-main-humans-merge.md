# 0005 — `main` is protected; agents open PRs, humans merge

- **Status:** Accepted · recorded 2026-09-26

## Context

Cursor SDK agents open PRs against this repo. The safety of that depends on what it takes to get code into `main`.

## Decision

- `main` is branch-protected: required status checks `build`, `assistant-unit`, `smoke`, `parity-proof`; no force-push; linear history; admins included.
- Agents may open PRs but never merge or deploy ([workflow 0001](https://github.com/gloverthomas/liquid-workflow/blob/main/docs/decisions/0001-humans-own-every-write.md)). Humans merge after CI, BugBot and preview review.
- UI PRs carry visual proof: Playwright artifacts plus `docs/pr-proof/` screenshots, using the PR template.
- Merging a PR that mentions a `LIQ-N` ticket moves that ticket to **Done** through the workflow's GitHub webhook, so don't mention unrelated tickets in PR bodies.

## Consequences

- A red required check blocks everyone, including admins, until it's fixed or the requirement is changed deliberately.

## Where it lives

GitHub branch protection, `.github/workflows/ci.yml`, `.github/pull_request_template.md`.
