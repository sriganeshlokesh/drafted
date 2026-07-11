/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL for the forged evaluation API. Empty ⇒ relative (proxied in dev). */
  readonly VITE_API_BASE_URL?: string
  /** Base URL for the keysmith auth API. Empty ⇒ relative (proxied in dev). */
  readonly VITE_AUTH_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
