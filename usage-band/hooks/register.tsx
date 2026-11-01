import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Gauge, Limit, Machine } from '../types'

const limits = atom({ plugin: 'usage-band', key: 'limits' } as const, [] as Limit[])
const machine = atom(
  { plugin: 'usage-band', key: 'machine' } as const,
  { disk: null, mem: null } as Machine,
)
const isHidden = atom({ plugin: 'usage-band', key: 'isHidden' } as const, false)

const GB = 1024 ** 3
const fmtGB = (b: number) => (b / GB >= 100 ? (b / GB).toFixed(0) : (b / GB).toFixed(1))

const NAMES: Record<string, string> = { five_hour: '5시간', seven_day: '주간', spend_limit: '한도' }

function resetLabel(iso?: string): string {
  if (!iso) return ''
  const t = new Date(iso)
  if (Number.isNaN(t.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  const hm = `${pad(t.getHours())}:${pad(t.getMinutes())}`
  const now = new Date()
  return t.toDateString() === now.toDateString() ? hm : `${t.getMonth() + 1}/${t.getDate()} ${hm}`
}

function tone(pctUsed: number): 'green' | 'yellow' | 'red' {
  return pctUsed >= 80 ? 'red' : pctUsed >= 50 ? 'yellow' : 'green'
}

async function sample($: EngineInterface) {
  let disk: Gauge | null = null
  let mem: Gauge | null = null
  try {
    const df = await $.process.run(['df', '-kP', '.'])
    const cols = df.stdout.trim().split('\n').pop()?.split(/\s+/) ?? []
    const total = Number(cols[1]) * 1024
    const avail = Number(cols[3]) * 1024
    if (total > 0) disk = { totalBytes: total, usedBytes: total - avail }
  } catch {}
  try {
    const mi = await $.process.run(['cat', '/proc/meminfo'])
    const kb = (k: string) => Number(new RegExp(`^${k}:\\s+(\\d+)`, 'm').exec(mi.stdout)?.[1] ?? NaN)
    const total = kb('MemTotal') * 1024
    const avail = kb('MemAvailable') * 1024
    if (total > 0 && avail >= 0) mem = { totalBytes: total, usedBytes: total - avail }
  } catch {}
  await update($, machine, () => ({ disk, mem }))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const r = await next(e)
    await $.command.register({ name: 'usage-band', description: '입력창 위 사용량·디스크·메모리 줄 보이기/숨기기' })
    try {
      const u = await $.session.usage()
      await update($, limits, () => u.rateLimits.map(l => ({ ...l })))
    } catch {}
    await sample($)
    $.clock.every(10_000, () => void sample($))
    return r
  })

  on('session.measure', async ($, e, next) => {
    await update($, limits, () => e.rateLimits.map(l => ({ ...l })))
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    if (e.props.hasSurvey || (await read($, isHidden))) return below

    const { Box, Text, Button } = $.ui.resolve(e)
    const ls = await read($, limits)
    const { disk, mem } = await read($, machine)

    const usage =
      ls.length === 0
        ? [<Text key="u" dimColor>사용량 —</Text>]
        : ls.map(l => {
            const left = Math.max(0, Math.round(100 - l.percentUsed))
            const r = resetLabel(l.resetsAt)
            return (
              <Text key={`u-${l.kind}`}>
                {NAMES[l.kind] ?? l.kind} <Text color={tone(l.percentUsed)}>{left}% 남음</Text>
                {r ? <Text dimColor> ({r} 리셋)</Text> : null}
                {'  '}
              </Text>
            )
          })

    const gauge = (label: string, g: Gauge | null, k: string) =>
      g ? (
        <Text key={k}>
          <Text dimColor>│ </Text>
          {label} <Text color={tone((100 * g.usedBytes) / g.totalBytes)}>{fmtGB(g.usedBytes)}</Text>
          <Text dimColor>/{fmtGB(g.totalBytes)}GB </Text>
        </Text>
      ) : null

    return (
      <Box flexDirection="column">
      {below}
      <Box flexDirection="row" flexWrap="wrap">
        {usage}
        {gauge('디스크', disk, 'disk')}
        {gauge('메모리', mem, 'mem')}
        <Button key="hide" label="숨기기" onPress={() => update($, isHidden, () => true)} />
      </Box>
      </Box>
    )
  })

  on('command.run', { command: 'usage-band' }, async ($, e, next) => {
    const hidden = await update($, isHidden, v => !v)
    return { text: hidden ? '사용량 줄을 숨겼어요.' : '사용량 줄을 다시 띄웠어요.' }
  })
}
