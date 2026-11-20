# @aishangwuji/dsh-notify

DeepSeek Harness 插件：对话任务完成、失败或会话结束时，发送一条系统桌面通知。支持 Windows、macOS、Linux。

![Windows toast](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-4f7cff)

## 它解决什么

长任务跑起来后，人通常会切走。DSH 的回合结束发生在后台，屏幕上没有任何反馈；这个插件把「任务完成」「任务失败」「会话结束」变成系统通知栏里的一条记录。

触发点来自 Host 的公开事件，不轮询、不读界面：

- `agent/turn-stopping` → 任务完成（回合即将关闭的权威信号）
- `agent/error` + `agent/status: idle` → 任务失败（同一轮只报一次）
- `agent/disposed` → 会话结束（默认关闭）

子代理会话不会弹窗；目标自动续跑期间只报最终那一轮。

## 平台通道

| 平台 | 命令 | 通知归属 |
|---|---|---|
| Windows | `powershell.exe` + WinRT `ToastNotificationManager` | `com.deepseek.dsh`（DeepSeek Harness），未注册时回退 PowerShell |
| macOS | `/usr/bin/osascript` `display notification` | 通常显示为 Script Editor（osascript 宿主） |
| Linux | `notify-send` / `kdialog` / `zenity` | 当前桌面通知守护进程 |

三条通道都使用 argv + 环境变量，不经过 shell；标题和正文里的引号、`$`、反引号、换行不会变成命令语法。

## 安装

在 DSH 的 **设置 → 插件 → 添加插件** 选择本目录，或由 `plugin_manager` 以 `install_bundle` 安装本目录。宿主插件需要 profile 重新装载：重启 DSH，或在插件页关闭再启用本 bundle。

## 配置

默认开箱即用。覆盖 profile `cordis.patch.yml` 中同一行即可：

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
| `notifyOnTurnComplete` | `true` | 回合正常结束通知 |
| `notifyOnError` | `true` | 回合失败通知 |
| `notifyOnSessionEnd` | `false` | agent 销毁时通知；退出应用也会触发，默认关闭 |
| `sound` | `true` | Windows 静音 toast / macOS Glass 音；Linux 由通知守护进程决定 |
| `minDurationMs` | `0` | 短于该值的回合不报完成 |
| `suppressWhenGoalActive` | `true` | 目标自动续跑期间合并中间提醒 |
| `language` | `auto` | `auto` / `zh` / `en` |
| `appName` | `DeepSeek Harness` | macOS 通知副标题与 Linux 应用名；Windows 归属由 AppUserModelID 决定 |
| `appId` | `com.deepseek.dsh` | Windows Toast AppUserModelID |
| `linuxIcon` | `dialog-information` | Linux 通知图标 |

## 验证

```powershell
node scripts/notify-test.mjs   # 直接发一条测试通知
npm test                       # 单元测试 + 不变量测试
```

安装后在任意会话发一句「回复 ok」，回合结束时通知栏应出现「任务完成」。

## 已知边界

- 通知不可点击跳回 DSH（没有可用的 OS 命令 URL scheme）。
- macOS 通知归属受 osascript 限制，可能显示为 Script Editor。
- 系统勿扰模式会在系统层拦截，插件无法绕过。
- Linux 需要桌面通知守护进程；headless 环境不会送达。

## 开发

```
index.js            事件接线与生命周期
host/config.js      配置默认值与边界校验
host/messages.js    中英文案与时长格式
host/platform.js    三平台命令计划（纯数据）
host/notifier.js    无 shell 的 spawn
host/policy.js      子代理过滤、目标合并、会话标题
host/tracker.js     每 agent 的回合去重状态机
test/               node:test 套件
```

`npm test` 使用 Node 内置测试运行器，没有第三方依赖。

## License

MIT
