#!/usr/bin/env node
/**
 * Send one real notification through the same plan the plugin uses.
 * Useful after install to separate "plugin wiring" from "platform delivery".
 */

import { buildPlan } from '../host/platform.js'
import { sendNotification } from '../host/notifier.js'

const plan = buildPlan({
  platform: process.platform,
  title: '任务完成',
  body: '这是一条测试通知：dsh-notify 的投递通道可用。',
  sound: true,
})

if (!plan) {
  console.error(`No supported notification command on ${process.platform}.`)
  process.exit(1)
}

console.log(`Sending via ${plan.command} ${plan.args.join(' ').slice(0, 120)}…`)
const started = sendNotification(plan, {
  logger: { warn: (message, error) => console.error(message, error ?? '') },
})
if (!started) process.exit(1)
console.log('Notification dispatched. Check the system notification center.')
