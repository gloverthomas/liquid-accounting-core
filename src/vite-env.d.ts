/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_POSTHOG_PROJECT_TOKEN?: string;
  readonly VITE_POSTHOG_HOST?: string;
  readonly VITE_REPORTING_APP_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
