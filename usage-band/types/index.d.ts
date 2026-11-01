export type Limit = { kind: string; percentUsed: number; resetsAt?: string }
export type Gauge = { usedBytes: number; totalBytes: number }
export type Machine = { disk: Gauge | null; mem: Gauge | null }

declare module 'claude-code' {
  interface PluginState {
    'usage-band': { limits: Limit[]; machine: Machine; isHidden: boolean }
  }
}
