#!/usr/bin/env node
/**
 * Upload Playwright proof PNGs to linked Linear issues (LIQ-* in PR title/body/branch).
 * Requires LINEAR_API_KEY repo secret and pull_request event context.
 */
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { execSync } from "node:child_process";

const LINEAR_API_KEY = process.env.LINEAR_API_KEY?.trim();
const PR_NUMBER = process.env.PR_NUMBER?.trim();
const PROOF_DIR = process.env.PROOF_DIR?.trim() || "e2e/proof";
const JOB_LABEL = process.env.JOB_LABEL?.trim() || "parity-proof";
const RUN_URL =
  process.env.CI_RUN_URL?.trim() ||
  (process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : "");

async function linearGql(query, variables) {
  const response = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: LINEAR_API_KEY,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await response.json();
  if (!response.ok || json.errors?.length) {
    throw new Error(json.errors?.map((e) => e.message).join("; ") || `Linear HTTP ${response.status}`);
  }
  return json.data;
}

function extractIssueIds(...texts) {
  const ids = new Set();
  const re = /LIQ-\d+/gi;
  for (const t of texts) {
    if (!t) continue;
    for (const m of t.matchAll(re)) ids.add(m[0].toUpperCase());
  }
  return [...ids];
}

async function listPngs(dir) {
  try {
    const names = await readdir(dir);
    const pngs = [];
    for (const name of names) {
      if (!name.endsWith(".png")) continue;
      const path = join(dir, name);
      const st = await stat(path);
      if (st.isFile()) pngs.push({ path, name, size: st.size });
    }
    return pngs.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

async function uploadFileToLinear(file) {
  const data = await linearGql(
    `mutation($contentType: String!, $filename: String!, $size: Int!) {
      fileUpload(contentType: $contentType, filename: $filename, size: $size) {
        success
        uploadFile {
          uploadUrl
          assetUrl
          headers { key value }
        }
      }
    }`,
    { contentType: "image/png", filename: file.name, size: file.size },
  );
  const upload = data.fileUpload?.uploadFile;
  if (!data.fileUpload?.success || !upload?.uploadUrl || !upload?.assetUrl) {
    throw new Error(`fileUpload failed for ${file.name}`);
  }
  const headers = new Headers();
  headers.set("Content-Type", "image/png");
  headers.set("Cache-Control", "public, max-age=31536000");
  for (const { key, value } of upload.headers ?? []) {
    headers.set(key, value);
  }
  const bytes = await readFile(file.path);
  const put = await fetch(upload.uploadUrl, { method: "PUT", headers, body: bytes });
  if (!put.ok) {
    throw new Error(`PUT upload failed for ${file.name}: HTTP ${put.status}`);
  }
  return { name: file.name, assetUrl: upload.assetUrl };
}

async function issueHasProofComment(issueId, runId) {
  const marker = `visual-proof-run:${runId}`;
  const data = await linearGql(
    `query($id: String!) {
      issue(id: $id) {
        comments(first: 30) {
          nodes { body }
        }
      }
    }`,
    { id: issueId },
  );
  return data.issue?.comments?.nodes?.some((c) => c.body?.includes(marker)) ?? false;
}

async function postComment(issueId, body) {
  await linearGql(
    `mutation($input: CommentCreateInput!) {
      commentCreate(input: $input) { success }
    }`,
    { input: { issueId, body } },
  );
}

async function main() {
  if (!LINEAR_API_KEY) {
    console.log("LINEAR_API_KEY not set; skipping Linear visual proof upload.");
    return;
  }
  if (!PR_NUMBER) {
    console.log("PR_NUMBER not set; skipping Linear visual proof upload.");
    return;
  }

  const runId = process.env.GITHUB_RUN_ID?.trim() || "local";
  let pr;
  try {
    const raw = execSync(`gh pr view "${PR_NUMBER}" --json title,body,headRefName,url`, {
      encoding: "utf8",
    });
    pr = JSON.parse(raw);
  } catch (e) {
    console.warn("Could not read PR via gh:", e.message);
    return;
  }

  const issueIds = extractIssueIds(pr.title, pr.body, pr.headRefName);
  if (issueIds.length === 0) {
    console.log("No LIQ-* id in PR title, body, or branch; skipping Linear.");
    return;
  }

  let pngs = await listPngs(PROOF_DIR);
  if (pngs.length === 0) pngs = await listPngs("e2e/proof");
  if (pngs.length === 0) {
    console.log("No proof PNGs found; skipping Linear.");
    return;
  }

  const uploaded = [];
  for (const file of pngs) {
    uploaded.push(await uploadFileToLinear(file));
  }

  for (const identifier of issueIds) {
    const issueData = await linearGql(
      `query($id: String!) { issue(id: $id) { id identifier title } }`,
      { id: identifier },
    );
    const issue = issueData.issue;
    if (!issue?.id) {
      console.warn(`Linear issue not found: ${identifier}`);
      continue;
    }
    if (await issueHasProofComment(issue.id, runId)) {
      console.log(`Proof comment already on ${identifier} for run ${runId}; skipping.`);
      continue;
    }

    const lines = [
      `<!-- visual-proof-run:${runId} -->`,
      `## Visual proof (CI · ${JOB_LABEL})`,
      "",
      `- **Issue:** ${issue.identifier}`,
      `- **PR:** ${pr.url}`,
      RUN_URL ? `- **CI run:** ${RUN_URL}` : "",
      "",
      "Screenshots from Playwright (also inline on the GitHub PR comment).",
      "",
    ];
    for (const { name, assetUrl } of uploaded) {
      lines.push(`### ${name}`, "", `![${name}](${assetUrl})`, "");
    }
    await postComment(issue.id, lines.join("\n"));
    console.log(`Posted ${uploaded.length} image(s) to ${issue.identifier}.`);
  }
}

main().catch((err) => {
  console.error("Linear visual proof upload failed (non-fatal for CI):", err);
  process.exit(0);
});
