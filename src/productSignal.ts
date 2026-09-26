/**
 * Call from UI when a product seam fires (PostHog/Sentry should run alongside).
 * No-op until a feature imports this — BFF + Vercel env are ready on Core prod.
 */
export async function postProductSignal(args: {
  hash: string;
  source?: string;
  pageUrl?: string;
}): Promise<void> {
  void fetch("/api/v1/product/signal", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      hash: args.hash,
      source: args.source ?? "core:ui",
      pageUrl: args.pageUrl ?? (typeof window !== "undefined" ? window.location.href : undefined),
    }),
  }).catch(() => undefined);
}
