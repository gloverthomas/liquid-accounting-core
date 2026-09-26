const LIQ_TEAM_ID = "5389dda4-1725-4096-9ecb-a24a378b28c6";
const PARITY_PROJECT_ID = "555e1574-8669-4119-94c5-f3584b2d9aaa";
const TODO_STATE_ID = (process.env.LINEAR_TODO_STATE_ID ?? "84569319-0517-4fd2-b04f-81c02d0f7192").trim();

/** Shared seam ids — keep in sync with Reporting `server/productSignal.mjs`. */
export const ASSISTANT_CALC_ACCORDION_SEAM = "assistant-calculation-accordion";
export const CORE_REPORTING_DEEP_LINK_SEAM = "core-reporting-deep-link-miss";

const SEAMS = {
  [ASSISTANT_CALC_ACCORDION_SEAM]: {
    title: '[Hero] Reporting AI Assistant: "How this was calculated" accordion does not expand',
    description:
      "Reporting AI Assistant chat works (LIQ-24). The **How this was calculated** disclosure under replies does not expand when clicked. Core behaves correctly.",
  },
  [CORE_REPORTING_DEEP_LINK_SEAM]: {
    title: "[Hero] Core still deep-links to legacy Reporting hash",
    description:
      "Core Reports nav / dashboard tasks link to a legacy hash while Reporting canonical route moved (LIQ-9 class).",
  },
};

async function linearGql(apiKey, query, variables) {
  const response = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: apiKey,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await response.json();
  if (!response.ok || json.errors?.length) {
    throw new Error(json.errors?.[0]?.message ?? `linear_http_${response.status}`);
  }
  return json.data;
}

async function createLinearIssue(apiKey, hash, appLabel) {
  const seam = SEAMS[hash];
  if (!seam) return null;

  const data = await linearGql(
    apiKey,
    `
    mutation SignalIssueCreate($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue { id identifier title url }
      }
    }
  `,
    {
      input: {
        teamId: LIQ_TEAM_ID,
        projectId: PARITY_PROJECT_ID,
        stateId: TODO_STATE_ID,
        title: seam.title,
        description: `${seam.description}\n\n---\nOpened from ${appLabel} **product signal** (\`${hash}\`).`,
      },
    },
  );

  const issue = data.issueCreate?.issue;
  if (!data.issueCreate?.success || !issue) return null;
  return issue;
}

async function linearComment(apiKey, issueId, body) {
  await linearGql(
    apiKey,
    `
    mutation CommentCreate($input: CommentCreateInput!) {
      commentCreate(input: $input) { success }
    }
  `,
    { input: { issueId, body } },
  );
}

async function forwardWorkflow(body) {
  const url = (process.env.WORKFLOW_SIGNAL_URL ?? process.env.VITE_WORKFLOW_SIGNAL_URL ?? "").trim();
  if (!url) return null;
  const response = await fetch(url.replace(/\/$/, ""), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  try {
    return { status: response.status, json: JSON.parse(text) };
  } catch {
    return { status: response.status, json: { raw: text } };
  }
}

export async function handleProductSignal(payload) {
  const hash = typeof payload.hash === "string" ? payload.hash.trim() : "";
  const source = typeof payload.source === "string" ? payload.source : "core";
  const pageUrl =
    typeof payload.pageUrl === "string"
      ? payload.pageUrl
      : typeof payload.reportingUrl === "string"
        ? payload.reportingUrl
        : undefined;

  const body = {
    hash,
    source,
    reportingUrl: pageUrl,
    title: SEAMS[hash]?.title,
  };

  const forwarded = await forwardWorkflow(body);
  if (forwarded && forwarded.status >= 200 && forwarded.status < 300) {
    return { ok: true, via: "workflow", ...forwarded.json };
  }

  const apiKey = (process.env.LINEAR_API_KEY ?? "").trim();
  if (!apiKey || !hash || !SEAMS[hash]) {
    return {
      ok: false,
      error: "signal_unconfigured",
      workflowStatus: forwarded?.status,
    };
  }

  const issue = await createLinearIssue(apiKey, hash, "Core");
  if (!issue) {
    return { ok: false, error: "linear_create_failed" };
  }

  await linearComment(
    apiKey,
    issue.id,
    [
      "## Product signal received",
      "",
      `- Source: \`${source}\``,
      `- Seam: \`${hash}\``,
      pageUrl ? `- URL: ${pageUrl}` : null,
      "",
      "Assigned for triage (**Todo**). Move to **In Progress** to start the Cursor SDK plan.",
    ]
      .filter(Boolean)
      .join("\n"),
  );

  return {
    ok: true,
    via: "linear_direct",
    issue: { identifier: issue.identifier, title: issue.title, url: issue.url },
  };
}
