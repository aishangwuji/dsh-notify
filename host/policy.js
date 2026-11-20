/** Turn/task predicates shared by the plugin entry and its tests. */

/**
 * Only user-visible sessions notify. Delegated children are represented by
 * `origin === 'subagent'` or a positive delegation depth; their turn endings
 * are internal work and would otherwise produce one toast per child.
 * @param {{ session?: { header?: { origin?: string, delegationDepth?: number } } }} agent
 */
export function isUserFacingSession(agent) {
  const header = agent?.session?.header
  if (!header) return false
  if (header.origin === 'subagent') return false
  if (typeof header.delegationDepth === 'number' && header.delegationDepth > 0) return false
  return true
}

/**
 * An armed, active goal will start another round by itself. Suppress the
 * intermediate "turn complete" toast so a long goal reports once, at the round
 * that actually completes or blocks it.
 * @param {{ get?: (agent: unknown) => unknown } | undefined} goals
 * @param {unknown} agent
 */
export function goalIsAutoContinuing(goals, agent) {
  try {
    const view = goals?.get?.(agent)
    return view?.phase === 'active' && view?.activation === 'armed'
  } catch {
    return false
  }
}

/**
 * Read the durable session title through the optional title service.
 * @param {{ get?: (session: unknown) => { title?: string } | undefined } | undefined} sessionTitle
 * @param {unknown} session
 */
export function readSessionTitle(sessionTitle, session) {
  try {
    const snapshot = sessionTitle?.get?.(session)
    return typeof snapshot?.title === 'string' ? snapshot.title : ''
  } catch {
    return ''
  }
}

/** @param {unknown} agent */
export function shortSessionId(agent) {
  const value = /** @type {{ session?: { id?: unknown } }} */ (agent)?.session?.id
  const id = typeof value === 'string' ? value : ''
  return id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 8)
}
