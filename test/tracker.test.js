import test from 'node:test'
import assert from 'node:assert/strict'

import { TurnTracker } from '../host/tracker.js'

test('one completion per running period, with measured duration', () => {
  const tracker = new TurnTracker()
  tracker.status('a', 'running', 1_000)
  const first = tracker.turnStopping('a', { now: 6_000 })
  assert.deepEqual(first, { kind: 'completion', elapsedMs: 5_000 })
  assert.equal(tracker.turnStopping('a', { now: 6_100 }), null)
})

test('a new running period resets the completion guard', () => {
  const tracker = new TurnTracker()
  tracker.status('a', 'running', 1_000)
  assert.ok(tracker.turnStopping('a', { now: 2_000 }))
  tracker.status('a', 'idle', 2_100)
  tracker.status('a', 'running', 3_000)
  assert.deepEqual(tracker.turnStopping('a', { now: 4_000 }), {
    kind: 'completion',
    elapsedMs: 1_000,
  })
})

test('a failure is reported once when no completion covered the turn', () => {
  const tracker = new TurnTracker()
  tracker.status('a', 'running', 1_000)
  tracker.noteError('a', new Error('boom'))
  tracker.status('a', 'idle', 3_000)
  assert.deepEqual(tracker.failureIfPending('a', { now: 3_000 }), {
    kind: 'failure',
    elapsedMs: 2_000,
    error: 'boom',
  })
  assert.equal(tracker.failureIfPending('a', { now: 3_100 }), null)
})

test('completion after an error suppresses the failure toast', () => {
  const tracker = new TurnTracker()
  tracker.status('a', 'running', 1_000)
  tracker.noteError('a', 'transient')
  assert.ok(tracker.turnStopping('a', { now: 2_000 }))
  assert.equal(tracker.failureIfPending('a', { now: 2_100 }), null)
})

test('a turn boundary without a running status still notifies', () => {
  const tracker = new TurnTracker()
  assert.deepEqual(tracker.turnStopping('a'), { kind: 'completion', elapsedMs: 0 })
})

test('minimum duration filters very short turns', () => {
  const tracker = new TurnTracker()
  tracker.status('a', 'running', 1_000)
  assert.equal(tracker.turnStopping('a', { now: 1_200, minDurationMs: 1_000 }), null)
})

test('goal suppression leaves the next round eligible', () => {
  const tracker = new TurnTracker()
  tracker.status('a', 'running', 1_000)
  assert.equal(tracker.turnStopping('a', { now: 2_000, suppressed: true }), null)
  tracker.status('a', 'idle', 2_000)
  tracker.status('a', 'running', 3_000)
  assert.deepEqual(tracker.turnStopping('a', { now: 4_500 }), {
    kind: 'completion',
    elapsedMs: 1_500,
  })
})

test('dispose reports whether a turn ever completed', () => {
  const tracker = new TurnTracker()
  tracker.status('a', 'running', 1_000)
  assert.equal(tracker.dispose('a').sawTurn, false)
  tracker.status('b', 'running', 1_000)
  tracker.turnStopping('b', { now: 2_000 })
  assert.equal(tracker.dispose('b').sawTurn, true)
  assert.equal(tracker.size, 0)
})
