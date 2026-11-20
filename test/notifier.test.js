import test from 'node:test'
import assert from 'node:assert/strict'

import { sendNotification } from '../host/notifier.js'

function fakeChild() {
  const calls = { unref: 0, on: [] }
  return {
    calls,
    child: {
      on(event, listener) {
        calls.on.push([event, listener])
      },
      unref() {
        calls.unref += 1
      },
    },
  }
}

test('spawns without a shell, ignores stdio, and merges plan env', () => {
  const { child, calls } = fakeChild()
  let captured
  const ok = sendNotification(
    { command: 'tool', args: ['a', 'b c'], env: { DSH_NOTIFY_TITLE: '标题' } },
    {
      spawnImpl: (command, args, options) => {
        captured = { command, args, options }
        return child
      },
    },
  )
  assert.equal(ok, true)
  assert.equal(captured.command, 'tool')
  assert.deepEqual(captured.args, ['a', 'b c'])
  assert.equal(captured.options.stdio, 'ignore')
  assert.equal(captured.options.windowsHide, true)
  assert.equal(captured.options.detached, false, 'Windows detached PowerShell skips -EncodedCommand')
  assert.equal(captured.options.env.DSH_NOTIFY_TITLE, '标题')
  assert.equal(calls.unref, 1)
  assert.equal(calls.on[0][0], 'error')
})

test('spawn errors are contained and logged', () => {
  const warnings = []
  const ok = sendNotification(
    { command: 'missing', args: [] },
    {
      spawnImpl: () => {
        throw new Error('ENOENT')
      },
      logger: { warn: (...args) => warnings.push(args) },
    },
  )
  assert.equal(ok, false)
  assert.equal(warnings.length, 1)
})

test('no plan means no work', () => {
  let called = false
  assert.equal(sendNotification(null, { spawnImpl: () => { called = true } }), false)
  assert.equal(called, false)
})
