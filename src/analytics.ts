import posthog, { type CaptureResult, type PostHog, type Property } from "posthog-js";

const allowedHosts = new Set([
  "https://us.i.posthog.com",
  "https://eu.i.posthog.com",
  "https://us.posthog.com",
  "https://eu.posthog.com",
]);

const allowedEvents = new Set([
  "$pageview",
  "$pageleave",
  "product_navigation",
  "report_opened",
  "bff_status",
  "create_dialog_opened",
]);

const allowedSections = new Set([
  "Dashboard",
  "Sales",
  "Purchases",
  "Banking",
  "Contacts",
  "Reports",
  "all",
  "performance",
  "statements",
]);

const allowedReports = new Set([
  "Profit & Loss",
  "Cash flow",
  "Sales summary",
  "Revenue summary",
  "Balance sheet",
  "Trial balance",
  "all",
  "performance",
  "statements",
]);

const allowedSources = new Set(["core", "reporting"]);
const projectTokenPattern = /^phc_[A-Za-z0-9_-]{20,}$/;

function isAllowedProperty(key: string, value: Property): boolean {
  if (key === "app" || key === "source") {
    return typeof value === "string" && allowedSources.has(value);
  }
  if (key === "section") {
    return typeof value === "string" && allowedSections.has(value);
  }
  if (key === "report") {
    return typeof value === "string" && allowedReports.has(value);
  }
  if (key === "connected") {
    return typeof value === "boolean";
  }
  return false;
}

function sanitiseProperties(properties?: Record<string, Property>): Record<string, Property> | undefined {
  if (!properties) {
    return undefined;
  }

  const sanitised = Object.fromEntries(Object.entries(properties).filter(([key, value]) => isAllowedProperty(key, value)));
  return Object.keys(sanitised).length > 0 ? sanitised : undefined;
}

export function createPosthogClient(app: "core" | "reporting"): PostHog | null {
  const token = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN?.trim();
  const host = import.meta.env.VITE_POSTHOG_HOST?.trim();

  if (!token || !projectTokenPattern.test(token) || !host || !allowedHosts.has(host)) {
    return null;
  }

  const distinctId = `liquid-demo-${app}`;

  posthog.init(token, {
    api_host: host,
    autocapture: false,
    // Manual $pageview below — avoid double-counting with PostHog's auto initial pageview.
    capture_pageview: false,
    capture_pageleave: true,
    disable_session_recording: true,
    // Demo runs in Playwright / Cursor browser where navigator.webdriver is true;
    // PostHog treats that as a bot and silently drops every capture otherwise.
    opt_out_useragent_filter: true,
    // Project default is identified_only — keep person profiles for demo distinct IDs.
    person_profiles: "always",
    persistence: "memory",
    bootstrap: { distinctID: distinctId },
    property_denylist: ["$ip", "$email", "$name", "amount", "netProfit", "cashAtBank"],
  });

  posthog.identify(distinctId, { app });
  posthog.register({ app });
  posthog.capture("$pageview", { source: app, section: app === "core" ? "Dashboard" : "all" });
  return posthog;
}

export function captureProductEvent(
  client: PostHog | null,
  event: "product_navigation" | "report_opened" | "bff_status" | "create_dialog_opened",
  properties?: Record<string, Property>,
): CaptureResult | undefined {
  return client?.capture(event, sanitiseProperties(properties));
}
