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
  "invoice_deep_link_miss",
]);

const allowedSections = new Set([
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
  "Invoice performance",
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

  posthog.init(token, {
    api_host: host,
    defaults: "2026-05-30",
    autocapture: false,
    capture_pageview: true,
    disable_session_recording: true,
    mask_all_text: true,
    mask_all_element_attributes: true,
    persistence: "memory",
    property_denylist: ["$ip", "$email", "$name", "amount", "netProfit", "cashAtBank"],
    before_send: (event) => {
      if (!event || !allowedEvents.has(event.event)) {
        return null;
      }

      event.properties = {
        ...sanitiseProperties(event.properties as Record<string, Property> | undefined),
        app,
      };
      return event;
    },
  });

  return posthog;
}

export type PostHogLike = PostHog;

export function captureProductEvent(
  client: PostHog | null,
  event:
    | "product_navigation"
    | "report_opened"
    | "bff_status"
    | "create_dialog_opened"
    | "invoice_deep_link_miss",
  properties?: Record<string, Property>,
): CaptureResult | undefined {
  return client?.capture(event, sanitiseProperties(properties));
}
