/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_COGNITO_DOMAIN: string;
  readonly VITE_COGNITO_CLIENT_ID: string;
  readonly VITE_COGNITO_REDIRECT_URI: string;
  readonly VITE_API_BASE_URL: string;
  readonly VITE_GA_MEASUREMENT_ID: string;
  readonly VITE_BITMOVIN_PLAYER_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
