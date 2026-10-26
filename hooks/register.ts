import type { EngineInterface, Register } from 'claude-code'

// Refuses tool calls once the weekly (seven_day) plan window reaches the cap.
// Cap and on/off live in $.store, so /usage-cap changes apply on the next tool
// call, with no restart. Fails open when there is no reading or the window
// has already reset.

const DEFAULT_CAP = 84

type Settings = { cap: number; enabled: boolean }

async function settings($: EngineInterface): Promise<Settings> {
  const cap = Number((await $.store.get('cap')) ?? DEFAULT_CAP)
  const enabled = (await $.store.get('enabled')) !== false
  return { cap: Number.isFinite(cap) ? cap : DEFAULT_CAP, enabled }
}

async function weekly($: EngineInterface) {
  const { rateLimits } = await $.session.usage()
  const week = rateLimits.find(r => r.kind === 'seven_day')
  if (!week) return undefined
  const resets = week.resetsAt ? Date.parse(week.resetsAt) : NaN
  if (Number.isFinite(resets) && resets <= $.clock.now()) return undefined
  return { pct: week.percentUsed, resets }
}

function when(resets: number) {
  if (!Number.isFinite(resets)) return 'the weekly reset'
  return new Date(resets).toLocaleString('en-GB', {
    weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'usage-cap',
      description: 'Usage guard: show status, set the weekly cap %, or turn it on/off',
      argumentHint: '[<percent> | on | off | reset]',
      immediate: true,
    })
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const { cap, enabled } = await settings($)
    if (!enabled) return next(e)
    const week = await weekly($)
    if (!week || week.pct < cap) return next(e)
    return {
      deny:
        `Weekly Claude usage is at ${week.pct}% (cap ${cap}%). Tool use is paused until ` +
        `the weekly limit resets (${when(week.resets)}). Raise the cap with ` +
        `/usage-cap <percent>, or turn the guard off with /usage-cap off.`,
    }
  }).catch(($, e, next) => next(e)) // a failing guard lets the call through

  on('command.run', { command: 'usage-cap' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'on' || arg === 'off') {
      await $.store.set('enabled', arg === 'on')
    } else if (arg === 'reset') {
      await $.store.delete('cap')
      await $.store.set('enabled', true)
    } else if (arg !== '') {
      const n = Number(arg.replace(/%$/, ''))
      if (!Number.isFinite(n) || n <= 0 || n > 100) {
        return { text: `usage-cap: expected a percent (1-100), on, off or reset; got "${e.args.trim()}".` }
      }
      await $.store.set('cap', n)
    }
    const { cap, enabled } = await settings($)
    const week = await weekly($)
    const usage = week ? `weekly usage ${week.pct}%, resets ${when(week.resets)}` : 'no weekly usage reading yet'
    const state = !enabled ? 'off' : week && week.pct >= cap ? 'BLOCKING tool use' : 'on'
    return { text: `usage-guard ${state}: cap ${cap}%, ${usage}.` }
  })
}
