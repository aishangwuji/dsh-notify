/**
 * Runtime configuration defaults and boundary validation.
 *
 * The plugin row's `config` is user-authored input, so every field is type
 * checked here and unknown fields are dropped. There is deliberately no
 * `Config` dependency: the plugin keeps working when a profile only carries
 * the defaults from `cordis.patch.yml`.
 */

export const DEFAULTS = Object.freeze({
  enabled: true,
  notifyOnTurnComplete: true,
  notifyOnError: true,
  notifyOnSessionEnd: false,
  sound: true,
  minDurationMs: 0,
  suppressWhenGoalActive: true,
  language: 'auto',
  appName: 'DeepSeek Harness',
  appId: 'com.deepseek.dsh',
  linuxIcon: 'dialog-information',
})

/** @param {unknown} value @param {number} fallback @param {number} min @param {number} max */
function integer(value, fallback, min, max) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(value)))
}

/** @param {unknown} value @param {string} fallback @param {number} max */
function text(value, fallback, max) {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  if (!trimmed) return fallback
  return trimmed.slice(0, max)
}

/** @param {unknown} value @param {boolean} fallback */
function bool(value, fallback) {
  return typeof value === 'boolean' ? value : fallback
}

/** @param {unknown} raw */
export function normalizeConfig(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? /** @type {Record<string, unknown>} */ (raw)
    : {}
  const language = source.language === 'zh' || source.language === 'en' || source.language === 'auto'
    ? source.language
    : DEFAULTS.language

  return {
    enabled: bool(source.enabled, DEFAULTS.enabled),
    notifyOnTurnComplete: bool(source.notifyOnTurnComplete, DEFAULTS.notifyOnTurnComplete),
    notifyOnError: bool(source.notifyOnError, DEFAULTS.notifyOnError),
    notifyOnSessionEnd: bool(source.notifyOnSessionEnd, DEFAULTS.notifyOnSessionEnd),
    sound: bool(source.sound, DEFAULTS.sound),
    minDurationMs: integer(source.minDurationMs, DEFAULTS.minDurationMs, 0, 600_000),
    suppressWhenGoalActive: bool(source.suppressWhenGoalActive, DEFAULTS.suppressWhenGoalActive),
    language,
    appName: text(source.appName, DEFAULTS.appName, 48),
    appId: text(source.appId, DEFAULTS.appId, 128),
    linuxIcon: text(source.linuxIcon, DEFAULTS.linuxIcon, 120),
  }
}
