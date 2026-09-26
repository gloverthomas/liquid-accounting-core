# PR visual proof

Playwright CI copies screenshots from `e2e/proof/` into this folder on **pull requests** so they render inline in GitHub (PR comment + Files tab) without downloading the Actions artifact zip.

Do not edit CI-generated PNGs by hand; re-run CI or update the Playwright proof specs instead.

## Linear

When the repo has a **`LINEAR_API_KEY`** secret (write access to team *Liquid accounting*), CI posts a **Visual proof (CI)** comment on each `LIQ-*` issue referenced in the PR title, body, or branch, with inline screenshots. Without the secret, this step is skipped (GitHub PR comment still has images).
