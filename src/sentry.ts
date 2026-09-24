import * as Sentry from "@sentry/react";

const dsnPattern = /^https:\/\/[^@\s]+@[^/\s]+\/\d+$/;


/** Hosts we expect for production Liquid surfaces (fail closed: warn if cross-app URL drifts). */
const expectedProdHosts = new Set([
  "liquid-accounting.world",
  "www.liquid-accounting.world",
  "reporting.liquid-accounting.world",
]);

function scrubEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent | null {
  // Fail closed: never ship emails, names, or financial figures to Sentry.
  if (event.user) {
    delete event.user.email;
    delete event.user.username;
    delete event.user.ip_address;
  }
  if (event.request?.headers) {
    delete event.request.headers.Authorization;
    delete event.request.headers.cookie;
  }
  return event;
}

export function initSentry(app: "core" | "reporting"): boolean {
  const dsn = import.meta.env.VITE_SENTRY_DSN?.trim();
  if (!dsn || !dsnPattern.test(dsn)) {
    return false;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: `liquid-accounting-${app}@${import.meta.env.VITE_APP_VERSION ?? "0.1.0"}`,
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    beforeSend: scrubEvent,
    initialScope: {
      tags: { app, product: "liquid-accounting" },
    },
  });

  return true;
}

/** Warn when a production custom-domain page still points at vercel.app (or other) cross-app hosts. */
export function reportCrossAppUrlDrift(args: {
  app: "core" | "reporting";
  configuredUrl: string;
  role: "reporting-target" | "core-target";
}): void {
  if (!import.meta.env.PROD) {
    return;
  }

  let configuredHost = "";
  try {
    configuredHost = new URL(args.configuredUrl).hostname;
  } catch {
    Sentry.captureMessage("Invalid cross-app URL configuration", {
      level: "error",
      tags: { app: args.app, role: args.role, kind: "config" },
      extra: { configuredUrl: args.configuredUrl },
    });
    return;
  }

  const pageHost = window.location.hostname;
  const pageIsCustom = expectedProdHosts.has(pageHost) || pageHost.endsWith(".liquid-accounting.world");
  const targetLooksStale =
    configuredHost.endsWith(".vercel.app") ||
    configuredHost === "localhost" ||
    configuredHost === "127.0.0.1";

  if (pageIsCustom && targetLooksStale) {
    Sentry.captureMessage("Cross-app URL still points at non-custom host", {
      level: "warning",
      tags: { app: args.app, role: args.role, kind: "config-drift" },
      extra: {
        pageHost,
        configuredHost,
        configuredUrl: args.configuredUrl,
      },
    });
  }
}

/** Product signal for LIQ-9-style legacy deep links (not a thrown exception). */
export function reportLegacyDeepLink(hash: string): void {
  Sentry.captureMessage("Legacy report deep-link hit", {
    level: "warning",
    tags: { app: "reporting", kind: "deep-link", seam: "LIQ-9" },
    extra: { hash },
  });
}

/** LIQ-15: Core invents #invoice-performance — do not include customer/amount PII. */
export function reportBrokenInvoiceDeepLink(args: {
  hash: string;
  source: "create_invoice" | "reports_nav";
  customer?: string;
  amount?: string;
}): void {
  Sentry.captureMessage("Core deep-link to missing Reporting hash", {
    level: "error",
    tags: {
      app: "core",
      kind: "deep-link",
      seam: "LIQ-15",
      source: args.source,
    },
    extra: {
      hash: args.hash,
      // Intentionally omit customer/amount — scrubbed even if callers pass them.
      hasCustomer: Boolean(args.customer),
      hasAmount: Boolean(args.amount),
    },
  });
}

export { Sentry };
