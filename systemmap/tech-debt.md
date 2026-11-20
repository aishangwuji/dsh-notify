---
scope: dsh-notify
covered_paths:
  - dsh-notify/index.js
  - dsh-notify/host/
  - dsh-notify/test/
last_verified_commit: 66ceafb
verified_at: 2026-11-20
status: current
note: 技术债/未接入模块的持久记录；AGENTS.md 只保留边界、结构、约束、命令、坑、仓库状态。
---

# dsh-notify 技术债与未决项

## 已知问题

### 通知不能点击回到 DSH

OS 命令通道没有可用的 URL scheme；点通知只按系统默认行为处理。

### 没有设置 UI

配置只能改 profile 的 `cordis.patch.yml`；没有控制台开关。

### macOS 通知归属不是 DeepSeek Harness

`osascript` 的 `display notification` 通常显示为 Script Editor；要完全归属需要签名 helper。

### 真实端到端只在 Windows 验证过

macOS/Linux 只有命令计划单测；没有在真实 macOS/Linux 上执行。

## 未接入模块 / 待评估

无。

## 处理约定

新增技术债写本文件，并在 `AGENTS.md` §2 只保留一句指针；状态变化时更新本文件，不要回写 AGENTS。
