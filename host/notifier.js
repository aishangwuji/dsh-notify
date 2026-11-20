/**
 * Spawn one delivery plan without a shell and without capturing output.
 *
 * `stdio: 'ignore'` prevents a notification helper from holding DSH open.
 * Do not use `detached: true` on Windows: a DETACHED_PROCESS PowerShell 5.1
 * exits 0 without executing `-EncodedCommand`, so the toast is never posted.
 * `unref()` is enough to let DSH exit without waiting for the helper.
 *
 * Delivery failure must never fail a turn, so every error is contained and
 * logged.
 */

import { spawn } from 'node:child_process'

/**
 * @param {{ command: string, args: string[], env?: Record<string, string> } | null} plan
 * @param {{ logger?: { warn?: (message: string, error?: unknown) => void }, spawnImpl?: typeof spawn }} [options]
 */
export function sendNotification(plan, options = {}) {
  if (!plan) return false
  const logger = options.logger
  const spawnImpl = options.spawnImpl ?? spawn
  try {
    const child = spawnImpl(plan.command, plan.args, {
      env: plan.env ? { ...process.env, ...plan.env } : process.env,
      stdio: 'ignore',
      windowsHide: true,
      detached: false,
    })
    child.on?.('error', (error) => {
      logger?.warn?.(`[dsh-notify] could not start "${plan.command}"`, error)
    })
    child.unref?.()
    return true
  } catch (error) {
    logger?.warn?.(`[dsh-notify] could not send a notification with "${plan.command}"`, error)
    return false
  }
}
