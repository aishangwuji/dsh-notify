/**
 * Cross-platform delivery plans.
 *
 * A plan is data only: `{ command, args, env }`. The caller spawns it without a
 * shell, so user text never becomes shell syntax. Windows and macOS read the
 * title/body from environment variables; Linux receives them as argv entries.
 *
 * Platform support:
 * - win32: Windows PowerShell 5.1 + WinRT toast (falls back to the PowerShell
 *   AppUserModelID when `com.deepseek.dsh` is not registered).
 * - darwin: `/usr/bin/osascript` Standard Additions `display notification`.
 * - linux: `notify-send` (libnotify), then `kdialog`, then `zenity`.
 */

import { existsSync } from 'node:fs'
import path from 'node:path'

export const WINDOWS_APP_ID = 'com.deepseek.dsh'

export const WINDOWS_TOAST_SCRIPT = `
$ErrorActionPreference = 'Stop'
[void][Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime]
[void][Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime]
$title = [System.Security.SecurityElement]::Escape([string]$env:DSH_NOTIFY_TITLE)
$body = [System.Security.SecurityElement]::Escape([string]$env:DSH_NOTIFY_BODY)
$silent = if ($env:DSH_NOTIFY_SILENT -eq '1') { '<audio silent="true"/>' } else { '' }
$xml = New-Object Windows.Data.Xml.Dom.XmlDocument
$xml.LoadXml("<toast><visual><binding template='ToastGeneric'><text>$title</text><text>$body</text></binding></visual>$silent</toast>")
$toast = New-Object Windows.UI.Notifications.ToastNotification $xml
$appId = if ($env:DSH_NOTIFY_APP_ID) { $env:DSH_NOTIFY_APP_ID } else { 'com.deepseek.dsh' }
try {
  [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($appId).Show($toast)
} catch {
  $fallback = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe'
  [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($fallback).Show($toast)
}
`.trim()

export const MACOS_SCRIPT = `
set theTitle to system attribute "DSH_NOTIFY_TITLE"
set theBody to system attribute "DSH_NOTIFY_BODY"
set theAppName to system attribute "DSH_NOTIFY_APP_NAME"
set theSound to system attribute "DSH_NOTIFY_SOUND"
if theSound is "1" then
  display notification theBody with title theTitle subtitle theAppName sound name "Glass"
else
  display notification theBody with title theTitle subtitle theAppName
end if
`.trim()

/**
 * Locate one executable on PATH. Kept injectable so plan tests never depend on
 * the machine that runs them.
 * @param {string} command
 * @param {string} [platform]
 * @param {NodeJS.ProcessEnv} [env]
 * @param {(candidate: string) => boolean} [exists]
 */
export function which(command, platform = process.platform, env = process.env, exists = existsSync) {
  if (!command) return null
  const hasSeparator = command.includes('/') || command.includes('\\')
  if (hasSeparator) return exists(command) ? command : null

  const pathValue = env.PATH ?? env.Path ?? ''
  const directories = pathValue.split(platform === 'win32' ? ';' : ':').filter(Boolean)
  const extensions = platform === 'win32'
    ? (env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean)
    : ['']
  const joiner = platform === 'win32' ? path.win32.join : path.posix.join

  for (const directory of directories) {
    for (const extension of extensions) {
      const candidate = joiner(directory, `${command}${extension}`)
      if (exists(candidate)) return candidate
    }
  }
  return null
}

/** @param {NodeJS.ProcessEnv} [env] @param {(candidate: string) => boolean} [exists] */
export function powershellPath(platform = process.platform, env = process.env, exists = existsSync) {
  const root = env.SystemRoot ?? env.windir ?? 'C:\\Windows'
  const candidate = path.win32.join(root, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
  return exists(candidate) ? candidate : 'powershell.exe'
}

/** @param {string} script */
export function encodePowerShell(script) {
  return Buffer.from(script, 'utf16le').toString('base64')
}

/**
 * @param {{
 *   platform?: NodeJS.Platform,
 *   title: string,
 *   body: string,
 *   sound?: boolean,
 *   appId?: string,
 *   appName?: string,
 *   linuxIcon?: string,
 *   which?: (command: string) => string | null,
 * }} options
 * @returns {{ command: string, args: string[], env?: Record<string, string> } | null}
 */
export function buildPlan(options) {
  const platform = options.platform ?? process.platform
  const title = String(options.title ?? '')
  const body = String(options.body ?? '')
  const appId = options.appId || WINDOWS_APP_ID
  const appName = options.appName || 'DeepSeek Harness'
  const sound = options.sound !== false
  const find = options.which ?? ((command) => which(command, platform))

  if (platform === 'win32') {
    return {
      command: powershellPath(platform),
      args: [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-EncodedCommand',
        encodePowerShell(WINDOWS_TOAST_SCRIPT),
      ],
      env: {
        DSH_NOTIFY_TITLE: title,
        DSH_NOTIFY_BODY: body,
        DSH_NOTIFY_APP_ID: appId,
        DSH_NOTIFY_SILENT: sound ? '0' : '1',
      },
    }
  }

  if (platform === 'darwin') {
    return {
      command: '/usr/bin/osascript',
      args: ['-e', MACOS_SCRIPT],
      env: {
        DSH_NOTIFY_TITLE: title,
        DSH_NOTIFY_BODY: body,
        DSH_NOTIFY_APP_NAME: appName,
        DSH_NOTIFY_SOUND: sound ? '1' : '0',
      },
    }
  }

  if (platform === 'linux') {
    const icon = options.linuxIcon || 'dialog-information'
    const notifySend = find('notify-send')
    if (notifySend) {
      return {
        command: notifySend,
        args: ['--app-name', appName, '--urgency', 'normal', `--icon=${icon}`, title, body],
      }
    }
    const kdialog = find('kdialog')
    if (kdialog) {
      return { command: kdialog, args: ['--title', title, '--passivepopup', body, '8'] }
    }
    const zenity = find('zenity')
    if (zenity) {
      return { command: zenity, args: ['--notification', `--text=${title}\n${body}`] }
    }
    return null
  }

  return null
}
