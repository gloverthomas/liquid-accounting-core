# Decision records

Why Liquid Core is built the way it is. Liquid Insights reads these to answer "why did we…" questions. When a decision changes, add a new record that supersedes the old one.

| # | Decision | Status |
| --- | --- | --- |
| [0001](0001-per-app-loopback-bff.md) | Each app has its own loopback BFF; secrets stay out of the browser | Accepted |
| [0002](0002-duplicated-contract-no-shared-bff.md) | The organisation contract is duplicated on purpose; no shared BFF yet | Accepted |
| [0003](0003-privacy-constrained-posthog.md) | PostHog: allowlisted events and properties only | Accepted |
| [0004](0004-reporting-migration-seam.md) | Reporting stays a separate app until the planned migration | Accepted |
| [0005](0005-protected-main-humans-merge.md) | `main` is protected; agents open PRs, humans merge | Accepted |

Workflow-wide decisions (write gate, evals, the Linear state machine) live in [liquid-workflow/docs/decisions](https://github.com/gloverthomas/liquid-workflow/blob/main/docs/decisions/README.md).
