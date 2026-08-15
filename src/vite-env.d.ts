/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_EMAIL_CONFIRMATION_REDIRECT_URI: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
