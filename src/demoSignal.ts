import { captureProductEvent, type PostHogLike } from "./analytics";

/** Fixed report target — no longer the demo hero. */
export const CANONICAL_REPORT_HASH = "revenue-summary";

export function reportingRevenueSummaryUrl(reportingAppUrl: string): string {
  return `${reportingAppUrl.replace(/\/$/, "")}/#${CANONICAL_REPORT_HASH}`;
}

/** @deprecated kept for older call sites during LIQ-15 teardown */
export const BROKEN_INVOICE_REPORT_HASH = CANONICAL_REPORT_HASH;
export const reportingInvoicePerformanceUrl = reportingRevenueSummaryUrl;

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

/** @deprecated */
export const fireBrokenInvoiceDeepLink = openReportingRevenueSummary;
