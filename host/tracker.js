/**
 * Per-agent turn bookkeeping.
 *
 * The event vocabulary separates "a turn is about to close" from "the agent
 * became idle", and a failed request may be retried before the turn settles.
 * This tracker collapses those signals into at most one notification per
 * running period:
 *
 * - `turn-stopping` wins: a completion toast, and no late failure toast.
 * - `agent/error` alone: one failure toast when the agent returns to idle.
 * - a user cancellation produces neither.
 *
 * It also records whether the session ever completed a turn, so the optional
 * session-end notice does not fire for sessions that were never used.
 */

/**
 * @typedef {{
 *   running: boolean,
 *   runningSince: number | null,
 *   sawError: boolean,
 *   lastError: string,
 *   completionNotified: boolean,
 *   sawTurn: boolean,
 * }} AgentTurnState
 */

/** @param {unknown} error */
function errorText(error) {
  if (error instanceof Error) return error.message || error.name || 'Error'
  if (typeof error === 'string') return error
  if (error === undefined || error === null) return ''
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

export class TurnTracker {
  /** @type {Map<string, AgentTurnState>} */
  #states = new Map()

  /** @param {string} agentId */
  #state(agentId) {
    let state = this.#states.get(agentId)
    if (!state) {
      state = {
        running: false,
        runningSince: null,
        sawError: false,
        lastError: '',
        completionNotified: false,
        sawTurn: false,
      }
      this.#states.set(agentId, state)
    }
    return state
  }

  /**
   * @param {string} agentId
   * @param {'idle' | 'running'} status
   * @param {number} now
   */
  status(agentId, status, now = Date.now()) {
    const state = this.#state(agentId)
    if (status === 'running') {
      state.running = true
      state.runningSince = now
      state.sawError = false
      state.lastError = ''
      state.completionNotified = false
    } else {
      // Keep `runningSince` until a failure decision can use it; the next
      // `running` transition replaces it.
      state.running = false
    }
    return { ...state }
  }

  /** @param {string} agentId @param {unknown} error */
  noteError(agentId, error) {
    const state = this.#state(agentId)
    state.sawError = true
    state.lastError = errorText(error)
  }

  /**
   * Decide whether this turn-stopping boundary produces a completion toast.
   * A boundary without a preceding `running` status (plugin activated
   * mid-turn, resumed session) still counts: the boundary itself is the
   * authoritative "turn is complete" signal.
   *
   * @param {string} agentId
   * @param {{ now?: number, minDurationMs?: number, suppressed?: boolean }} [options]
   * @returns {{ kind: 'completion', elapsedMs: number } | null}
   */
  turnStopping(agentId, options = {}) {
    const state = this.#state(agentId)
    state.sawTurn = true
    if (state.completionNotified) return null
    if (options.suppressed) return null

    const now = options.now ?? Date.now()
    const elapsedMs = state.running && state.runningSince !== null
      ? Math.max(0, now - state.runningSince)
      : 0
    const minimum = options.minDurationMs ?? 0
    if (elapsedMs < minimum) {
      state.completionNotified = true
      return null
    }

    state.completionNotified = true
    state.sawError = false
    state.lastError = ''
    return { kind: 'completion', elapsedMs }
  }

  /**
   * Produce one failure toast after an error if no completion toast already
   * covered this running period.
   * @param {string} agentId
   * @param {{ now?: number }} [options]
   * @returns {{ kind: 'failure', elapsedMs: number, error: string } | null}
   */
  failureIfPending(agentId, options = {}) {
    const state = this.#state(agentId)
    if (!state.sawError || state.completionNotified) return null
    const now = options.now ?? Date.now()
    const elapsedMs = state.runningSince !== null
      ? Math.max(0, now - state.runningSince)
      : 0
    state.completionNotified = true
    state.sawError = false
    state.runningSince = null
    return { kind: 'failure', elapsedMs, error: state.lastError }
  }

  /**
   * Remove state and report whether the session ever completed a turn.
   * @param {string} agentId
   */
  dispose(agentId) {
    const state = this.#states.get(agentId)
    this.#states.delete(agentId)
    return { sawTurn: state?.sawTurn === true }
  }

  /** @param {string} agentId */
  snapshot(agentId) {
    return { ...this.#state(agentId) }
  }

  clear() {
    this.#states.clear()
  }

  get size() {
    return this.#states.size
  }
}
