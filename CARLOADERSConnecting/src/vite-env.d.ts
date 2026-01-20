/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USER_SERVICE_URL: string
  readonly VITE_DRIVER_SERVICE_URL: string
  readonly VITE_CUSTOMER_SERVICE_URL: string
  readonly VITE_USER_SERVICE_PORT: string
  readonly VITE_DRIVER_SERVICE_PORT: string
  readonly VITE_CUSTOMER_SERVICE_PORT: string
  readonly VITE_API_TIMEOUT: string
  readonly VITE_ENABLE_MOCK_API: string
  readonly MODE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}