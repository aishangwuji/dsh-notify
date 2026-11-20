import test from 'node:test'
import assert from 'node:assert/strict'

import {
  MACOS_SCRIPT,
  WINDOWS_TOAST_SCRIPT,
  buildPlan,
  encodePowerShell,
  which,
} from '../host/platform.js'

test('Windows plan uses an encoded PowerShell toast with environment payload', () => {
  const plan = buildPlan({
    platform: 'win32',
    title: '任务完成 · DeepSeek Harness',
    body: '「带 "引号" 和 $符号」已完成',
    appId: 'com.deepseek.dsh',
    sound: false,
  })
  assert.ok(plan)
  assert.match(plan.command, /powershell\.exe$/i)
  assert.ok(plan.args.includes('-EncodedCommand'))
  const encoded = plan.args.at(-1)
  assert.equal(encoded, encodePowerShell(WINDOWS_TOAST_SCRIPT))
  const decoded = Buffer.from(encoded, 'base64').toString('utf16le')
  assert.match(decoded, /ToastGeneric/)
  assert.match(decoded, /DSH_NOTIFY_TITLE/)
  assert.match(decoded, /CreateToastNotifier/)
  assert.equal(plan.env.DSH_NOTIFY_TITLE, '任务完成 · DeepSeek Harness')
  assert.equal(plan.env.DSH_NOTIFY_BODY, '「带 "引号" 和 $符号」已完成')
  assert.equal(plan.env.DSH_NOTIFY_SILENT, '1')
})

test('macOS plan passes payload through the environment, not AppleScript quoting', () => {
  const plan = buildPlan({
    platform: 'darwin',
    title: 'Task complete · DeepSeek Harness',
    body: 'He said "hi" and \\ left',
    sound: true,
  })
  assert.ok(plan)
  assert.equal(plan.command, '/usr/bin/osascript')
  assert.deepEqual(plan.args, ['-e', MACOS_SCRIPT])
  assert.equal(plan.env.DSH_NOTIFY_TITLE, 'Task complete · DeepSeek Harness')
  assert.equal(plan.env.DSH_NOTIFY_BODY, 'He said "hi" and \\ left')
  assert.equal(plan.env.DSH_NOTIFY_APP_NAME, 'DeepSeek Harness')
  assert.equal(plan.env.DSH_NOTIFY_SOUND, '1')
  assert.match(MACOS_SCRIPT, /display notification/)
  assert.match(MACOS_SCRIPT, /subtitle theAppName/)
  assert.match(MACOS_SCRIPT, /system attribute/)
})

test('Linux prefers notify-send and passes text as argv', () => {
  const plan = buildPlan({
    platform: 'linux',
    title: 'Task complete',
    body: '$(rm -rf /) `touch x`',
    which: (command) => (command === 'notify-send' ? '/usr/bin/notify-send' : null),
  })
  assert.ok(plan)
  assert.equal(plan.command, '/usr/bin/notify-send')
  assert.deepEqual(plan.args.slice(-2), ['Task complete', '$(rm -rf /) `touch x`'])
  assert.ok(plan.args.includes('--app-name'))
  assert.ok(plan.args.includes('--icon=dialog-information'))
})

test('Linux falls back to kdialog and zenity, then reports unsupported', () => {
  const kdialog = buildPlan({
    platform: 'linux',
    title: 't',
    body: 'b',
    which: (command) => (command === 'kdialog' ? '/usr/bin/kdialog' : null),
  })
  assert.equal(kdialog.command, '/usr/bin/kdialog')

  const zenity = buildPlan({
    platform: 'linux',
    title: 't',
    body: 'b',
    which: (command) => (command === 'zenity' ? '/usr/bin/zenity' : null),
  })
  assert.equal(zenity.command, '/usr/bin/zenity')

  const none = buildPlan({ platform: 'linux', title: 't', body: 'b', which: () => null })
  assert.equal(none, null)
})

test('unsupported platforms produce no plan', () => {
  assert.equal(buildPlan({ platform: 'aix', title: 't', body: 'b' }), null)
})

test('which scans PATH and respects PATHEXT', () => {
  const env = { PATH: 'C:\\one;C:\\two', PATHEXT: '.EXE;.CMD' }
  const found = which('notify-send', 'win32', env, (candidate) => candidate === 'C:\\two\\notify-send.CMD')
  assert.equal(found, 'C:\\two\\notify-send.CMD')

  const unix = which('notify-send', 'linux', { PATH: '/usr/bin:/bin' }, (candidate) => candidate === '/usr/bin/notify-send')
  assert.equal(unix, '/usr/bin/notify-send')

  assert.equal(which('missing', 'linux', { PATH: '/usr/bin' }, () => false), null)
})
