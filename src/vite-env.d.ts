/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL for the forged evaluation API. Empty ⇒ relative (proxied in dev). */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
