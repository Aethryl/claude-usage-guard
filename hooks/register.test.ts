import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const RESETS = '2099-01-05T12:00:00Z'

function engine(on: On, pct: number | undefined, root = '/home/u/repos/app') {
  const at = { root }
  mock.store(on)
  on('session.root', () => ({ value: at.root }))
  on('session.cwd', () => ({ value: at.root }))
  mock.clock(on)
  on('command.register', () => ({ value: { command: 'usage-cap' } }))
  on('session.usage', () => ({
    value: {
      startedAt: 0,
      context: {},
      rateLimits: pct === undefined ? [] : [{ kind: 'seven_day', percentUsed: pct, resetsAt: RESETS }],
    },
  }))
  on('tool.call', () => ({ result: {} }))
  return at
}

test('denies tool calls at or over the cap', async ($, on) => {
  engine(on, 85)
  const r = await $.tool.call({ tool: 'Bash', command: 'ls' })
  expect(r.deny).toMatch(/85% \(cap 84%\)/)
})

test('lets calls through under the cap and with no reading', async ($, on) => {
  engine(on, 50)
  expect((await $.tool.call({ tool: 'Bash', command: 'ls' })).deny).toBeUndefined()
})

test('/usage-cap raises the cap and turns the guard off and on', async ($, on) => {
  engine(on, 85)
  expect((await $.command.run({ command: 'usage-cap', args: '100' })).text).toMatch(/on: cap 100%/)
  expect((await $.tool.call({ tool: 'Bash', command: 'ls' })).deny).toBeUndefined()

  await $.command.run({ command: 'usage-cap', args: 'reset' })
  expect((await $.tool.call({ tool: 'Bash', command: 'ls' })).deny).toBeDefined()

  expect((await $.command.run({ command: 'usage-cap', args: 'off' })).text).toMatch(/usage-guard off/)
  expect((await $.tool.call({ tool: 'Bash', command: 'ls' })).deny).toBeUndefined()

  expect((await $.command.run({ command: 'usage-cap', args: 'on' })).text).toMatch(/BLOCKING/)
  expect((await $.command.run({ command: 'usage-cap', args: 'abc' })).text).toMatch(/expected a percent/)
})

test('/usage-cap <percent> turns a disabled guard back on', async ($, on) => {
  engine(on, 85)
  await $.command.run({ command: 'usage-cap', args: 'off' })
  expect((await $.command.run({ command: 'usage-cap', args: '80' })).text).toMatch(/BLOCKING.*cap 80%/)
  expect((await $.tool.call({ tool: 'Bash', command: 'ls' })).deny).toBeDefined()
})

test('/usage-cap exempt lets the current project through over the cap, and only it', async ($, on) => {
  engine(on, 95, '/home/u/repos/homelab')
  expect((await $.command.run({ command: 'usage-cap', args: 'exempt' })).text)
    .toMatch(/this project is exempt; exempt: \/home\/u\/repos\/homelab/)
  expect((await $.tool.call({ tool: 'Bash', command: 'ls' })).deny).toBeUndefined()
})

test('an exemption does not cover other projects or a prefix-sharing sibling', async ($, on) => {
  const at = engine(on, 95, '/home/u/repos/homelab')
  await $.command.run({ command: 'usage-cap', args: 'exempt' })
  at.root = '/home/u/repos/homelab-old'
  expect((await $.tool.call({ tool: 'Bash', command: 'ls' })).deny).toBeDefined()
  at.root = '/home/u/repos/app'
  expect((await $.tool.call({ tool: 'Bash', command: 'ls' })).deny).toBeDefined()
})

test('/usage-cap unexempt blocks the project again', async ($, on) => {
  engine(on, 95, '/home/u/repos/homelab')
  await $.command.run({ command: 'usage-cap', args: 'exempt' })
  expect((await $.command.run({ command: 'usage-cap', args: 'unexempt' })).text).toMatch(/BLOCKING.*not exempt\.$/)
  expect((await $.tool.call({ tool: 'Bash', command: 'ls' })).deny).toBeDefined()
})
