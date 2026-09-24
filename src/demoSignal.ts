import { captureProductEvent, type PostHogLike } from "./analytics";

/** Fixed LIQ-15 target — existing Revenue summary report in Reporting. */
export const CANONICAL_INVOICE_REPORT_HASH = "revenue-summary";

export function reportingInvoicePerformanceUrl(reportingAppUrl: string): string {
  return `${reportingAppUrl.replace(/\/$/, "")}/#${CANONICAL_INVOICE_REPORT_HASH}`;
}

/**
 * After creating an invoice (or opening Reports), navigate to a real Reporting hash.
 * Kept as a named helper so the demo signal path stays easy to find in review.
 */
export async function openInvoiceRelatedReport(args: {
  posthog: PostHogLike | null;
  reportingAppUrl: string;
  source: "create_invoice" | "reports_nav";
}): Promise<void> {
  const target = reportingInvoicePerformanceUrl(args.reportingAppUrl);

  captureProductEvent(args.posthog, "product_navigation", {
    source: "core",
    section: "Reports",
    report: "Revenue summary",
  });

  window.location.assign(target);
}

/** @deprecated name retained for call-site clarity during LIQ-15 review */
export const fireBrokenInvoiceDeepLink = openInvoiceRelatedReport;
export const BROKEN_INVOICE_REPORT_HASH = CANONICAL_INVOICE_REPORT_HASH;
