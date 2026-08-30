export * from './chains.js'
export * from './gateway.js'
export * from './watchtower.js'
export * from './iit.js'
export * from './guard.js'

import { chainTools } from './chains.js'
import { gatewayTools } from './gateway.js'
import { watchtowerTools } from './watchtower.js'
import { iitTools } from './iit.js'
import { guardTools } from './guard.js'

export const allTools = [...chainTools, ...gatewayTools, ...watchtowerTools, ...iitTools, ...guardTools]
export const toolGroups = {
  chains: chainTools,
  gateway: gatewayTools,
  watchtower: watchtowerTools,
  iit: iitTools,
  guard: guardTools,
} as const
