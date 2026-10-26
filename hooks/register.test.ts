import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const RESETS = '2099-01-05T12:00:00Z'

function engine(on: On, pct: number | undefined) {
  mock.store(on)
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
