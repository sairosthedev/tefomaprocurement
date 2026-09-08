/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Which deployment this bundle is: development | staging | production. */
  readonly VITE_APP_ENV?: string;
  /** API base URL — host only or full path; `/api` is appended if missing. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
