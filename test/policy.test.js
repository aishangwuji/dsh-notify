import test from 'node:test'
import assert from 'node:assert/strict'

import {
  goalIsAutoContinuing,
  isUserFacingSession,
  readSessionTitle,
  shortSessionId,
} from '../host/policy.js'

test('only top-level sessions are user-facing', () => {
  assert.equal(isUserFacingSession({ session: { header: {} } }), true)
  assert.equal(isUserFacingSession({ session: { header: { origin: 'subagent' } } }), false)
  assert.equal(isUserFacingSession({ session: { header: { delegationDepth: 1 } } }), false)
  assert.equal(isUserFacingSession({ session: { header: { delegationDepth: 0 } } }), true)
  assert.equal(isUserFacingSession({}), false)
})

test('an armed active goal suppresses intermediate rounds', () => {
  const agent = {}
  assert.equal(goalIsAutoContinuing({ get: () => ({ phase: 'active', activation: 'armed' }) }, agent), true)
  assert.equal(goalIsAutoContinuing({ get: () => ({ phase: 'active', activation: 'disarmed' }) }, agent), false)
  assert.equal(goalIsAutoContinuing({ get: () => ({ phase: 'paused', activation: 'armed' }) }, agent), false)
  assert.equal(goalIsAutoContinuing(undefined, agent), false)
  assert.equal(goalIsAutoContinuing({ get: () => { throw new Error('no service') } }, agent), false)
})

test('session title falls back safely when the service is absent or throws', () => {
  assert.equal(readSessionTitle({ get: () => ({ title: '标题' }) }, {}), '标题')
  assert.equal(readSessionTitle(undefined, {}), '')
  assert.equal(readSessionTitle({ get: () => ({}) }, {}), '')
  assert.equal(readSessionTitle({ get: () => { throw new Error('x') } }, {}), '')
})

test('shortSessionId keeps at most eight safe characters', () => {
  assert.equal(shortSessionId({ session: { id: 'abc-123_XYZ-999' } }), 'abc-123_')
  assert.equal(shortSessionId({}), '')
})
