# Changelog

## 0.1.0

### Added

- 对话回合正常结束时发送系统通知，按 agent 去重，短回合可过滤。
- 回合失败时发送失败通知；失败后若同轮正常收尾，只保留完成提醒。
- 可选会话结束通知。
- Windows WinRT Toast（使用 `com.deepseek.dsh` 应用标识）、macOS osascript、Linux notify-send / kdialog / zenity 三条通道。
- 子代理会话过滤，目标自动续跑期间合并中间回合。
- 中英文案、可配置时长、声音、语言、应用名与通知图标。
- 基于 `node:test` 的单元测试与不变量测试，无第三方依赖。
