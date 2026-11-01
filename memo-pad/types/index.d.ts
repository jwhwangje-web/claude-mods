export type Memo = { id: string; text: string; savedAt: number }

declare module 'claude-code' {
  interface PluginState {
    'memo-pad': { memos: Shaped<Memo[]>; draft: string; editingId: string | null }
  }
}
