import type { PlumeApi } from '../shared/types'

declare global {
  interface Window {
    plume: PlumeApi
  }
}

export {}
