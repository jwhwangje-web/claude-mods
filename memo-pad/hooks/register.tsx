import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Memo } from '../types'

const PANE = 'memo-pad'
const STORE_KEY = 'memos'

const memos = atom({ plugin: 'memo-pad', key: 'memos' } as const, [] as Memo[], { shape: 'memos-1' })
const draft = atom({ plugin: 'memo-pad', key: 'draft' } as const, '')
const editingId = atom({ plugin: 'memo-pad', key: 'editingId' } as const, null as string | null)

function titleOf(text: string, max = 18): string {
  const line = text.trim().split('\n')[0]?.trim() ?? ''
  if (!line) return '(빈 메모)'
  return line.length > max ? line.slice(0, max - 1) + '…' : line
}

async function persist($: EngineInterface, list: Memo[]) {
  await $.store.set(STORE_KEY, list)
}

async function openPad($: EngineInterface) {
  await $.ui.open({ id: PANE, title: '메모', focus: true })
}

async function saveDraft($: EngineInterface, text: string) {
  if (!text.trim()) {
    $.ui.toast('빈 메모는 저장하지 않아요')
    return
  }
  const id = await read($, editingId)
  const now = await $.clock.now()
  const list = await update($, memos, cur => {
    if (id && cur.some(m => m.id === id)) {
      return cur.map(m => (m.id === id ? { ...m, text, savedAt: now } : m))
    }
    return [...cur, { id: `m${now}`, text, savedAt: now }]
  })
  await persist($, list)
  await update($, draft, () => '')
  await update($, editingId, () => null)
  $.ui.toast(`저장했어요: ${titleOf(text, 30)}`)
}

async function removeMemo($: EngineInterface, id: string) {
  const list = await update($, memos, cur => cur.filter(m => m.id !== id))
  await persist($, list)
  if ((await read($, editingId)) === id) {
    await update($, editingId, () => null)
    await update($, draft, () => '')
  }
}

async function editMemo($: EngineInterface, m: Memo) {
  await update($, editingId, () => m.id)
  await update($, draft, () => m.text)
  await openPad($)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const r = await next(e)
    await $.command.register({ name: 'memo', description: '옆 창에 메모장 열기' })
    try {
      const saved = await $.store.get(STORE_KEY)
      if (Array.isArray(saved)) {
        const list = saved.filter(
          (m): m is Memo => !!m && typeof m.id === 'string' && typeof m.text === 'string',
        )
        await update($, memos, () => list)
      }
    } catch {}
    return r
  })

  on('command.run', { command: 'memo' }, async $ => {
    await openPad($)
    return { text: '메모장을 열었어요.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const els = $.ui.resolve(e)
    const { Box, Text, Button } = els
    const Input = 'Input' in els ? els.Input : null
    const list = await read($, memos)
    const text = await read($, draft)
    const id = await read($, editingId)
    const editing = id ? list.find(m => m.id === id) : undefined

    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>{editing ? `편집 중: ${titleOf(editing.text, 30)}` : '새 메모'}</Text>
        {Input ? (
        <Input
          key="draft"
          rows={8}
          autoFocus
          placeholder="메모를 적으세요. 첫 줄이 버튼 이름이 돼요."
          value={text}
          submitLabel="저장"
          onInput={(v: string) => void update($, draft, () => v)}
          onSubmit={(v: string) => void saveDraft($, v)}
        />
        ) : (
          <Text dimColor>이 화면에서는 메모를 적을 수 없어요. 데스크톱이나 웹에서 적어 주세요.</Text>
        )}
        <Box flexDirection="row" gap={1}>
          <Button key="save" label="저장" onPress={async () => saveDraft($, await read($, draft))} />
          <Button
            key="new"
            label="새 메모"
            onPress={async () => {
              await update($, editingId, () => null)
              await update($, draft, () => '')
            }}
          />
        </Box>
        <Text dimColor>저장한 메모 {list.length}개</Text>
        {list.length === 0 && <Text dimColor>아직 저장한 메모가 없어요.</Text>}
        {list
          .slice()
          .reverse()
          .map(m => (
            <Box key={`row-${m.id}`} flexDirection="row" gap={1}>
              <Button key={`edit-${m.id}`} label={titleOf(m.text, 26)} onPress={() => editMemo($, m)} />
              <Button
                key={`ins-${m.id}`}
                label="입력창에"
                onPress={() => void $.prompt.fill({ text: m.text, mode: 'insert' })}
              />
              <Button key={`del-${m.id}`} label="삭제" onPress={() => removeMemo($, m.id)} />
            </Box>
          ))}
      </Box>
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    if (e.props.hasSurvey) return below

    const { Box, Button } = $.ui.resolve(e)
    const list = await read($, memos)

    return (
      <Box flexDirection="column">
        {below}
        <Box flexDirection="row" flexWrap="wrap" gap={1}>
          {list.map(m => (
            <Button
              key={`memo-${m.id}`}
              label={titleOf(m.text)}
              onPress={() => void $.prompt.fill({ text: m.text, mode: 'insert' })}
            />
          ))}
          <Button key="open-pad" label={list.length ? '✎ 메모장' : '✎ 메모장 열기'} onPress={() => openPad($)} />
        </Box>
      </Box>
    )
  })
}
