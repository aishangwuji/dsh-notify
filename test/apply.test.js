import test from 'node:test'
import assert from 'node:assert/strict'

import { apply, internals } from '../index.js'

/**
 * Minimal Cordis-like context: records listeners so the test can drive the
 * exact event payloads DSH emits.
 */
function fakeContext({ sessionTitle, goals } = {}) {
  const listeners = new Map()
  const ctx = {
    logger: { warn() {} },
    on(name, listener) {
      listeners.set(name, listener)
      return () => listeners.delete(name)
    },
    get(name) {
      if (name === 'sessionTitle') return sessionTitle
      if (name === 'goals') return goals
      return undefined
    },
  }
  return { ctx, listeners }
}

function fakeAgent({ id = 'session-12345678', header = {}, title } = {}) {
  const session = { id, header }
  return { id, session, title }
}

function capture() {
  const originalSend = internals.sendNotification
  const originalPlan = internals.buildPlan
  const plans = []
  internals.buildPlan = (options) => ({
    command: 'test-helper',
    args: [],
    env: {
      DSH_NOTIFY_TITLE: options.title,
      DSH_NOTIFY_BODY: options.body,
    },
  })
  internals.sendNotification = (plan) => {
    plans.push(plan)
    return true
  }
  return {
    plans,
    restore() {
      internals.sendNotification = originalSend
      internals.buildPlan = originalPlan
    },
  }
}

test('a completed turn sends one completion notification', () => {
  const sink = capture()
  try {
    const { ctx, listeners } = fakeContext({
      sessionTitle: { get: () => ({ title: '修复登录' }) },
    })
    const dispose = apply(ctx, { language: 'zh' })
    const agent = fakeAgent()

    listeners.get('agent/status')({ agent, status: 'running' })
    listeners.get('agent/turn-stopping')({ agent, turn: 1 })
    listeners.get('agent/turn-stopping')({ agent, turn: 1 })

    assert.equal(sink.plans.length, 1)
    assert.equal(sink.plans[0].env.DSH_NOTIFY_TITLE, '任务完成')
    assert.match(sink.plans[0].env.DSH_NOTIFY_BODY, /修复登录/)
    dispose()
  } finally {
    sink.restore()
  }
})

test('subagent sessions never notify', () => {
  const sink = capture()
  try {
    const { ctx, listeners } = fakeContext()
    apply(ctx, { language: 'zh' })
    const agent = fakeAgent({ header: { origin: 'subagent', delegationDepth: 1 } })
    listeners.get('agent/status')({ agent, status: 'running' })
    listeners.get('agent/turn-stopping')({ agent, turn: 1 })
    assert.equal(sink.plans.length, 0)
  } finally {
    sink.restore()
  }
})

test('an error without a completion becomes one failure notification', () => {
  const sink = capture()
  try {
    const { ctx, listeners } = fakeContext()
    apply(ctx, { language: 'en' })
    const agent = fakeAgent()
    listeners.get('agent/status')({ agent, status: 'running' })
    listeners.get('agent/error')({ agent, turn: 1, step: 1, error: new Error('provider down') })
    listeners.get('agent/status')({ agent, status: 'idle' })

    assert.equal(sink.plans.length, 1)
    assert.match(sink.plans[0].env.DSH_NOTIFY_TITLE, /Task failed/)
    assert.match(sink.plans[0].env.DSH_NOTIFY_BODY, /provider down/)
  } finally {
    sink.restore()
  }
})

test('an error followed by a completion only reports completion', () => {
  const sink = capture()
  try {
    const { ctx, listeners } = fakeContext()
    apply(ctx, { language: 'zh' })
    const agent = fakeAgent()
    listeners.get('agent/status')({ agent, status: 'running' })
    listeners.get('agent/error')({ agent, turn: 1, step: 1, error: 'transient' })
    listeners.get('agent/turn-stopping')({ agent, turn: 1 })
    listeners.get('agent/status')({ agent, status: 'idle' })

    assert.equal(sink.plans.length, 1)
    assert.match(sink.plans[0].env.DSH_NOTIFY_TITLE, /任务完成/)
  } finally {
    sink.restore()
  }
})

test('session-end notifications are opt-in', () => {
  const sink = capture()
  try {
    const first = fakeContext()
    const off = apply(first.ctx, { language: 'zh' })
    const agent = fakeAgent()
    first.listeners.get('agent/status')({ agent, status: 'running' })
    first.listeners.get('agent/turn-stopping')({ agent, turn: 1 })
    first.listeners.get('agent/disposed')({ agent })
    assert.equal(sink.plans.length, 1)
    off()

    const second = fakeContext()
    const offSecond = apply(second.ctx, { language: 'zh', notifyOnSessionEnd: true })
    const agent2 = fakeAgent({ id: 'session-87654321' })
    second.listeners.get('agent/status')({ agent: agent2, status: 'running' })
    second.listeners.get('agent/turn-stopping')({ agent: agent2, turn: 1 })
    second.listeners.get('agent/disposed')({ agent: agent2 })
    assert.equal(sink.plans.length, 3)
    assert.match(sink.plans[2].env.DSH_NOTIFY_TITLE, /会话已结束/)
    offSecond()
  } finally {
    sink.restore()
  }
})

test('an aborted turn-stopping boundary is treated as a user cancel', () => {
  const sink = capture()
  try {
    const { ctx, listeners } = fakeContext()
    apply(ctx, { language: 'zh' })
    const agent = fakeAgent()
    listeners.get('agent/status')({ agent, status: 'running' })
    const controller = new AbortController()
    controller.abort()
    listeners.get('agent/turn-stopping')({ agent, turn: 1, signal: controller.signal })
    assert.equal(sink.plans.length, 0)
  } finally {
    sink.restore()
  }
})

test('a disabled plugin registers no listeners', () => {
  const { ctx, listeners } = fakeContext()
  assert.equal(apply(ctx, { enabled: false }), undefined)
  assert.equal(listeners.size, 0)
})

test('goal auto-continuation defers the completion toast', () => {
  const sink = capture()
  try {
    const { ctx, listeners } = fakeContext({
      goals: { get: () => ({ phase: 'active', activation: 'armed' }) },
    })
    apply(ctx, { language: 'zh' })
    const agent = fakeAgent()
    listeners.get('agent/status')({ agent, status: 'running' })
    listeners.get('agent/turn-stopping')({ agent, turn: 1 })
    assert.equal(sink.plans.length, 0)
  } finally {
    sink.restore()
  }
})
