/**
 * Pure notification copy and duration formatting.
 *
 * Every value that reaches a platform command is normalized here first:
 * control characters are removed, whitespace is collapsed, and long text is
 * truncated on code-point boundaries. The platform layer never interpolates
 * this text into a shell command (Windows/macOS receive it through environment
 * variables, Linux receives it as argv), so this is presentation hygiene
 * rather than command escaping.
 */

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/g

/** @param {unknown} value */
export function normalizeText(value, max = 160) {
  const source = typeof value === 'string' ? value : value == null ? '' : String(value)
  const cleaned = source
    .replace(CONTROL_CHARACTERS, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return truncate(cleaned, max)
}

/** @param {string} text */
export function truncate(text, max) {
  const characters = Array.from(text)
  if (characters.length <= max) return text
  return `${characters.slice(0, Math.max(0, max - 1)).join('')}…`
}

/**
 * Resolve `auto` against the runtime locale. DSH itself is bilingual, so the
 * notification follows the host locale instead of forcing one language.
 * @param {string | undefined} requested
 */
export function resolveLanguage(requested) {
  if (requested === 'zh' || requested === 'en') return requested
  const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? ''
  return locale.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

/** @param {number} milliseconds */
export function formatDuration(milliseconds, language = 'zh') {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return ''
  const seconds = Math.floor(milliseconds / 1000)
  if (language === 'en') {
    if (seconds < 1) return 'under a second'
    if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'}`
    const minutes = Math.floor(seconds / 60)
    const rest = seconds % 60
    if (minutes < 60) return rest ? `${minutes}m ${rest}s` : `${minutes} minute${minutes === 1 ? '' : 's'}`
    const hours = Math.floor(minutes / 60)
    const restMinutes = minutes % 60
    return restMinutes ? `${hours}h ${restMinutes}m` : `${hours} hour${hours === 1 ? '' : 's'}`
  }
  if (seconds < 1) return '不到 1 秒'
  if (seconds < 60) return `${seconds} 秒`
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  if (minutes < 60) return rest ? `${minutes} 分 ${rest} 秒` : `${minutes} 分钟`
  const hours = Math.floor(minutes / 60)
  const restMinutes = minutes % 60
  return restMinutes ? `${hours} 小时 ${restMinutes} 分` : `${hours} 小时`
}

const STRINGS = {
  zh: {
    completionTitle: '任务完成',
    failureTitle: '任务失败',
    endedTitle: '会话已结束',
    sessionLabel: (id) => (id ? `会话 ${id}` : '当前会话'),
    completionBody: (label, duration) => `「${label}」已完成${duration ? ` · 用时 ${duration}` : ''}`,
    failureBody: (label, error) => error
      ? `「${label}」运行出错：${error}`
      : `「${label}」运行出错，请回到 DeepSeek Harness 查看`,
    endedBody: (label) => `「${label}」已关闭`,
  },
  en: {
    completionTitle: 'Task complete',
    failureTitle: 'Task failed',
    endedTitle: 'Session ended',
    sessionLabel: (id) => (id ? `Session ${id}` : 'Current session'),
    completionBody: (label, duration) => `"${label}" finished${duration ? ` · took ${duration}` : ''}`,
    failureBody: (label, error) => error
      ? `"${label}" failed: ${error}`
      : `"${label}" failed. Return to DeepSeek Harness for details.`,
    endedBody: (label) => `"${label}" closed`,
  },
}

/**
 * Build one platform-neutral notification.
 * @param {'completion' | 'failure' | 'ended'} kind
 * @param {{
 *   language?: string,
 *   sessionTitle?: string,
 *   sessionId?: string,
 *   durationMs?: number,
 *   error?: string,
 * }} options
 */
export function buildText(kind, options = {}) {
  const language = resolveLanguage(options.language)
  const strings = STRINGS[language]
  const sessionTitle = normalizeText(options.sessionTitle, 72)
  const sessionId = normalizeText(options.sessionId, 8)
  const label = sessionTitle || strings.sessionLabel(sessionId)
  const duration = kind === 'completion' && typeof options.durationMs === 'number'
    ? formatDuration(options.durationMs, language)
    : ''
  const error = kind === 'failure' ? normalizeText(options.error, 100) : ''

  const title = kind === 'completion'
    ? strings.completionTitle
    : kind === 'failure'
      ? strings.failureTitle
      : strings.endedTitle

  const body = kind === 'completion'
    ? strings.completionBody(label, duration)
    : kind === 'failure'
      ? strings.failureBody(label, error)
      : strings.endedBody(label)

  return {
    title,
    body: truncate(body, 220),
  }
}
