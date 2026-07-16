/// <reference types="vite/client" />

import type { ForgeXAPI } from '../../preload/types'

declare global {
  interface Window {
    forgex: ForgeXAPI
  }
}

export {}
