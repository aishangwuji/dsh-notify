import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildText,
  formatDuration,
  normalizeText,
  resolveLanguage,
  truncate,
} from '../host/messages.js'

test('buildText produces localized completion copy with duration', () => {
  const zh = buildText('completion', {
    language: 'zh',
    appName: 'DeepSeek Harness',
    sessionTitle: '修复登录问题',
    sessionId: 'abc12345',
    durationMs: 65_000,
  })
  assert.equal(zh.title, '任务完成')
  assert.equal(zh.body, '「修复登录问题」已完成 · 用时 1 分 5 秒')

  const en = buildText('completion', {
    language: 'en',
    sessionTitle: 'Fix login',
    durationMs: 65_000,
  })
  assert.equal(en.title, 'Task complete')
  assert.equal(en.body, '"Fix login" finished · took 1m 5s')
})

test('buildText falls back to a short session label', () => {
  const zh = buildText('completion', { language: 'zh', sessionId: 'abc12345' })
  assert.equal(zh.body, '「会话 abc12345」已完成')
  const en = buildText('completion', { language: 'en', sessionId: 'abc12345' })
  assert.equal(en.body, '"Session abc12345" finished')
})

test('failure and session-end copy stay concise', () => {
  const failed = buildText('failure', {
    language: 'zh',
    sessionTitle: '迁移数据',
    error: 'provider returned 500',
  })
  assert.equal(failed.title, '任务失败')
  assert.equal(failed.body, '「迁移数据」运行出错：provider returned 500')

  const ended = buildText('ended', {
    language: 'zh',
    sessionTitle: '迁移数据',
  })
  assert.equal(ended.title, '会话已结束')
  assert.equal(ended.body, '「迁移数据」已关闭')
})

test('formatDuration covers seconds, minutes, and hours', () => {
  assert.equal(formatDuration(0, 'zh'), '不到 1 秒')
  assert.equal(formatDuration(42_000, 'zh'), '42 秒')
  assert.equal(formatDuration(65_000, 'zh'), '1 分 5 秒')
  assert.equal(formatDuration(3_600_000, 'zh'), '1 小时')
  assert.equal(formatDuration(3_900_000, 'zh'), '1 小时 5 分')
  assert.equal(formatDuration(42_000, 'en'), '42 seconds')
  assert.equal(formatDuration(65_000, 'en'), '1m 5s')
})

test('normalizeText strips control characters and collapses whitespace', () => {
  assert.equal(normalizeText('  a\n\tb\u0000c  '), 'a b c')
  assert.equal(normalizeText(undefined), '')
  assert.equal(normalizeText(42), '42')
})

test('truncate never splits a surrogate pair', () => {
  const text = '😀😀😀😀'
  const cut = truncate(text, 2)
  assert.equal(Array.from(cut).length, 2)
  assert.ok(cut.endsWith('…'))
  assert.equal(Array.from(cut)[0], '😀')
})

test('resolveLanguage accepts overrides and reads the host locale otherwise', () => {
  assert.equal(resolveLanguage('zh'), 'zh')
  assert.equal(resolveLanguage('en'), 'en')
  assert.ok(['zh', 'en'].includes(resolveLanguage('auto')))
})
