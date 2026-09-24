import { captureProductEvent, type PostHogLike } from "./analytics";
import { reportBrokenInvoiceDeepLink, Sentry } from "./sentry";

/** Intentional LIQ-15 miss — Reporting has no such report. */
export const BROKEN_INVOICE_REPORT_HASH = "invoice-performance";

export function reportingInvoicePerformanceUrl(reportingAppUrl: string): string {
  return `${reportingAppUrl.replace(/\/$/, "")}/#${BROKEN_INVOICE_REPORT_HASH}`;
}

/**
 * Demo bridge: product/error signal → liquid-workflow /signal (loopback).
 * Does not auto-merge; starts the governed plan path for LIQ-15.
 */
export async function signalWorkflowIncident(args: {
  source: "create_invoice" | "reports_nav";
  reportingUrl: string;
}): Promise<{ ok: boolean; detail?: string }> {
  const endpoint =
    import.meta.env.VITE_WORKFLOW_SIGNAL_URL?.trim() || "http://127.0.0.1:4100/signal";

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        issueIdentifier: "LIQ-15",
        title: "[Hero] Create Invoice / Reports deep-link to missing #invoice-performance",
        source: args.source,
        hash: BROKEN_INVOICE_REPORT_HASH,
        reportingUrl: args.reportingUrl,
        url: typeof window !== "undefined" ? window.location.href : undefined,
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      return { ok: false, detail: text.slice(0, 200) };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function fireBrokenInvoiceDeepLink(args: {
  posthog: PostHogLike | null;
  reportingAppUrl: string;
  source: "create_invoice" | "reports_nav";
  customer?: string;
  amount?: string;
}): Promise<void> {
  const target = reportingInvoicePerformanceUrl(args.reportingAppUrl);

  captureProductEvent(args.posthog, "invoice_deep_link_miss", {
    source: "core",
    section: "Reports",
    report: "Invoice performance",
  });

  reportBrokenInvoiceDeepLink({
    hash: BROKEN_INVOICE_REPORT_HASH,
    source: args.source,
    customer: args.customer,
    amount: args.amount,
  });

  Sentry.addBreadcrumb({
    category: "liq-15",
    message: `Navigating to missing report ${target}`,
    level: "warning",
  });

  const signal = await signalWorkflowIncident({
    source: args.source,
    reportingUrl: target,
  });
  if (!signal.ok) {
    console.info("Workflow signal skipped or failed (is liquid-workflow on :4100?):", signal.detail);
  }

  window.location.assign(target);
}
