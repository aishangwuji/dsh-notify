# 任务完成提醒

对话任务结束时，用一条系统桌面通知告诉你结果。它补的是「人离开屏幕后，模型还在跑」这一段：你切去浏览器、编辑器或会议，任务完成、失败或会话关闭时，系统通知栏会留下一条记录。

## 触发时机

| 时机 | 通知 | 说明 |
|---|---|---|
| 一轮对话正常结束 | **任务完成** | 监听 `agent/turn-stopping`，这是 DSH 在回合即将关闭、模型不再欠回复时发出的权威信号 |
| 一轮对话失败 | **任务失败** | 监听 `agent/error` + `idle`，同一轮只报一次；失败后若又正常收尾，只保留「完成」 |
| 会话被关闭 | **会话已结束** | 默认关闭，需要显式开启 `notifyOnSessionEnd` |
| 子代理结束 | 不通知 | `origin: subagent` 或 delegation depth > 0 的内部会话被过滤 |
| 目标自动续跑 | 合并 | 目标处于 active + armed 时跳过中间回合，等目标完成/阻塞的那一轮再报 |

同一轮不会重复弹窗：插件按 agent 维护 running 周期，完成、失败各自最多一条。用户主动停止（cancel）不产生通知。

## 三平台实现

| 平台 | 通道 | 说明 |
|---|---|---|
| Windows 10/11 | Windows PowerShell 5.1 + WinRT Toast | 使用 `com.deepseek.dsh` 应用标识，通知归属 DeepSeek Harness；未注册时回退到 PowerShell 自己的 AppUserModelID |
| macOS | `/usr/bin/osascript` | `display notification`，默认带 Glass 提示音；通知中心里可能显示为 Script Editor（osascript 的宿主），这是无额外依赖方案的固有限制 |
| Linux | `notify-send` → `kdialog` → `zenity` | 按顺序探测，全部缺失时只写一条 Host 警告，不影响任务 |

三条通道都不经过 shell：Windows/macOS 把标题和正文放进环境变量，Linux 作为 argv 传入。会话标题里的引号、`$`、反引号、换行都不会变成命令语法或 XML 结构。

## 配置

默认值写在插件里，开箱即用。需要调整时，在 profile 的 `cordis.patch.yml` 覆盖同一行：

```yaml
- insert:
    - id: dsh-notify
      name: '@aishangwuji/dsh-notify'
      config:
        notifyOnSessionEnd: true
        sound: false
        minDurationMs: 2000
        language: zh
```

| 字段 | 默认 | 含义 |
|---|---|---|
| `enabled` | `true` | 总开关 |
| `notifyOnTurnComplete` | `true` | 回合正常结束时通知 |
| `notifyOnError` | `true` | 回合失败时通知 |
| `notifyOnSessionEnd` | `false` | agent 被销毁时通知；退出应用也会销毁，所以默认关闭 |
| `sound` | `true` | Windows 静音 toast / macOS Glass 提示音；Linux 由通知守护进程决定 |
| `minDurationMs` | `0` | 短于该毫秒数的回合不报完成，避免"你好"也弹窗 |
| `suppressWhenGoalActive` | `true` | 目标自动续跑期间合并中间提醒 |
| `language` | `auto` | `auto` / `zh` / `en`，`auto` 跟随系统区域 |
| `appName` | `DeepSeek Harness` | macOS 通知副标题与 Linux 应用名；Windows 归属由 AppUserModelID 决定 |
| `appId` | `com.deepseek.dsh` | Windows Toast 的 AppUserModelID |
| `linuxIcon` | `dialog-information` | Linux 通知图标（主题图标名或绝对路径） |

## 安装

- 已安装的 DSH：设置 → 插件 → 添加插件，选择本目录；或用 `plugin_manager` 的 `install_bundle` 指向本目录。
- 本地开发：`~/.dsh/profiles/desktop/package.json` 里用 `link:` 指向本目录后重启 DSH。

宿主插件只在 profile 装载时读取，安装后如果没有立即生效，重启 DSH 或关闭再启用本 bundle。

## 验证

```powershell
cd dsh-notify
node scripts/notify-test.mjs   # 直接发一条测试通知，验证通道
npm test                       # 规则与单元测试
```

端到端验证：安装后在任意会话发一句「回复 ok」，等回合结束，系统通知栏应出现「任务完成」。

## 已知边界

- 通知不可点击跳回 DSH：OS 命令通道没有可用的 URL scheme；点通知只会按系统默认行为处理。
- macOS 的通知归属受 osascript 限制，图标与名称可能显示为 Script Editor；要完全归属 DSH 需要额外签名 helper。
- 系统「专注助手 / 勿扰模式」会在系统层拦截通知，插件无法绕过。
- Linux 需要桌面通知守护进程；无图形会话（纯 SSH、headless）时不会送达。
