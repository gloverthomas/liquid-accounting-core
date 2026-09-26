# PR visual proof

Put manual or agent-captured screenshots here and embed them in the PR body.

Playwright CI does **not** commit here. On pull requests it force-pushes `e2e/proof/*.png` to branch `pr-proof/pr-<number>` and posts a PR comment with the images inline, so the PR head (and its required checks) never moves.

## Linear

When the repo has a **`LINEAR_API_KEY`** secret (write access to team *Liquid accounting*), CI posts a **Visual proof (CI)** comment on each `LIQ-*` issue referenced in the PR title, body, or branch, with inline screenshots. Without the secret, this step is skipped (GitHub PR comment still has images).
