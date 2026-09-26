import { captureProductEvent, type PostHogLike } from "./analytics";

/** Where Reports and Create Invoice take you in the Reporting app. */
export const CANONICAL_REPORT_HASH = "revenue-summary";

export function reportingRevenueSummaryUrl(reportingAppUrl: string): string {
  return `${reportingAppUrl.replace(/\/$/, "")}/#${CANONICAL_REPORT_HASH}`;
}

export async function openReportingRevenueSummary(args: {
  posthog: PostHogLike | null;
  reportingAppUrl: string;
  source: "create_invoice" | "reports_nav";
}): Promise<void> {
  const target = reportingRevenueSummaryUrl(args.reportingAppUrl);
  captureProductEvent(args.posthog, "product_navigation", {
    source: "core",
    section: "Reports",
    report: "Revenue summary",
  });
  window.location.assign(target);
}
