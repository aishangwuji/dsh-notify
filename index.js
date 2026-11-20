/**
 * dsh-notify — native desktop notifications for DSH conversation turns.
 *
 * The Host half listens to the public agent lifecycle vocabulary and spawns a
 * platform helper without a shell:
 *
 *   agent/turn-stopping → completion toast (goal rounds are coalesced)
 *   agent/error + idle  → failure toast (one per turn, never after success)
 *   agent/disposed      → optional session-end toast
 *
 * Notifications never block or fail a turn: every listener is synchronous and
 * contained, and delivery failures only reach the Host log.
 */

import { normalizeConfig } from './host/config.js'
import { buildText } from './host/messages.js'
import { sendNotification } from './host/notifier.js'
import { buildPlan } from './host/platform.js'
import {
  goalIsAutoContinuing,
  isUserFacingSession,
  readSessionTitle,
  shortSessionId,
} from './host/policy.js'
import { TurnTracker } from './host/tracker.js'

/**
 * Test seam: the suite replaces `buildPlan`/`sendNotification` to observe
 * decisions without touching the operating system. Production code never
 * mutates it.
 */
export const internals = { buildPlan, sendNotification }

/**
 * @param {object} ctx Cordis Host context.
 * @param {unknown} rawConfig
 */
export function apply(ctx, rawConfig) {
  const config = normalizeConfig(rawConfig)
  if (!config.enabled) return

  const logger = ctx.logger
  const tracker = new TurnTracker()
  let warnedUnsupported = false

  /**
   * @param {'completion' | 'failure' | 'ended'} kind
   * @param {{ session?: { id?: string, header?: object } }} agent
   * @param {{ elapsedMs?: number, error?: string }} [details]
   */
  const notify = (kind, agent, details = {}) => {
    if (!isUserFacingSession(agent)) return
    const session = agent.session
    const text = buildText(kind, {
      language: config.language,
      sessionTitle: readSessionTitle(ctx.get('sessionTitle'), session),
      sessionId: shortSessionId(agent),
      durationMs: details.elapsedMs,
      error: details.error,
    })
    const plan = internals.buildPlan({
      platform: process.platform,
      title: text.title,
      body: text.body,
      sound: config.sound,
      appId: config.appId,
      appName: config.appName,
      linuxIcon: config.linuxIcon,
    })
    if (!plan) {
      if (!warnedUnsupported) {
        warnedUnsupported = true
        logger?.warn?.(`[dsh-notify] no supported notification command on ${process.platform}`)
      }
      return
    }
    internals.sendNotification(plan, { logger })
  }

  /** Keep listener failures away from the agent loop. @param {() => void} run */
  const contained = (run) => {
    try {
      run()
    } catch (error) {
      logger?.warn?.('[dsh-notify] notification listener failed', error)
    }
  }

  const offStatus = ctx.on('agent/status', ({ agent, status }) => {
    contained(() => {
      tracker.status(agent.id, status)
      if (status !== 'idle' || !config.notifyOnError) return
      const decision = tracker.failureIfPending(agent.id)
      if (decision) notify('failure', agent, decision)
    })
  })

  const offTurnStopping = ctx.on('agent/turn-stopping', ({ agent, signal }) => {
    contained(() => {
      // An aborted signal means the turn was canceled (user stop, disposal,
      // archive): the user already knows, so no completion toast.
      if (signal?.aborted) return
      const suppressed = config.suppressWhenGoalActive
        && goalIsAutoContinuing(ctx.get('goals'), agent)
      const decision = tracker.turnStopping(agent.id, { suppressed })
      if (decision && config.notifyOnTurnComplete) notify('completion', agent, decision)
    })
  })

  const offError = ctx.on('agent/error', ({ agent, error }) => {
    contained(() => {
      if (!config.notifyOnError) return
      tracker.noteError(agent.id, error)
    })
  })

  const offDisposed = ctx.on('agent/disposed', ({ agent }) => {
    contained(() => {
      const { sawTurn } = tracker.dispose(agent.id)
      if (!config.notifyOnSessionEnd || !sawTurn) return
      notify('ended', agent)
    })
  })

  return () => {
    offStatus()
    offTurnStopping()
    offError()
    offDisposed()
    tracker.clear()
  }
}
