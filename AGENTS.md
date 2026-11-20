# dsh-notify 项目说明

`@aishangwuji/dsh-notify` 是 DSH 的跨平台任务完成提醒插件：对话回合正常结束、失败或（可选）会话销毁时，发一条系统桌面通知。本文只记录这个插件自己的结构、约束、命令和坑；DSH 插件的通用加载模型见工作区根目录 `AGENTS.md`。

## 1. 边界

- **宿主-only**：没有 `client.js`，不注册面板/插槽；只监听 DSH 的 agent 生命周期事件。
- 支持 Windows、macOS、Linux；通知通道分别是 WinRT Toast、`osascript`、`notify-send`/`kdialog`/`zenity`。
- 不做点击跳转，不做通知历史，不做设置 UI。

## 2. 结构

```
index.js              apply()：事件接线、去重状态机、调用通知
host/config.js        配置默认值与边界校验
host/messages.js      中英文案、时长格式、文本截断
host/platform.js      三平台命令计划（纯数据）
host/notifier.js      无 shell 的 spawn
host/policy.js        子代理过滤、目标合并、会话标题
host/tracker.js       每 agent 的回合去重状态
locale/               zh/en 插件元数据
docs/DETAIL.md        插件详情页
scripts/notify-test.mjs  真实发一条测试通知
test/                 node:test 套件
```

技术债、未接入模块与待评估项见 `systemmap/tech-debt.md`，不要写回本文。

## 3. 项目约束

- **不引第三方依赖**：宿主半只 import `node:*` 和相对路径。
- 通知命令**不经过 shell**：Windows/macOS 把标题正文放进环境变量，Linux 作为 argv；XML 文本必须转义。
- 同一 running 周期最多一条通知；`turn-stopping` 优先于失败；用户主动停止（signal aborted）不通知。
- 子代理会话（`origin: subagent` / `delegationDepth > 0`）不通知。
- 目标 `active + armed` 时跳过中间回合，只在目标完成/阻塞的那一轮提醒。
- 配置在 `host/config.js` 做类型与范围校验，不依赖 schemastery；非法值回落默认。
- `test/invariants.test.mjs` 约束：index < 400 行、host 模块 ≤ 600 行、只 import `node:*`/相对路径、locale 键一致、tarball 不含 test/scripts。

## 4. 命令与验证

```powershell
npm test                       # 42 项 node:test
node scripts/notify-test.mjs   # 真实发一条系统通知
npm pack --dry-run --json      # 核对 tarball
```

端到端：安装后在会话里发一句，回合结束应出现「任务完成」。Windows 以通知中心（Win+N）与注册表 `LastNotificationAddedTime` 为准；macOS/Linux 的命令计划有单测，但未在真实机器上执行。

## 5. 踩过的坑

1. **Windows 上 `spawn(..., { detached: true })` 会静默失败**：PowerShell 5.1 在 `DETACHED_PROCESS` 下退出码 0，但不执行 `-EncodedCommand`，Toast 根本不出现。必须 `detached: false` + `stdio: 'ignore'` + `unref()`。
2. **宿主代码改了要重载**：`index.js` / `host/*` 不会因刷新页面生效；重启 DSH 或在插件页把 bundle 关掉再打开。
3. **`npm publish` 的 `+ pkg@ver` 不代表可安装**：首次发布可能 5–10 分钟才在 registry 可读，期间 404 正常，不要重发。
4. **macOS 通知归属**：`osascript` 的 `display notification` 通常显示为 Script Editor，这是无额外依赖方案的固有限制。
5. **Linux 需要通知守护进程**：headless/SSH 环境没有 `notify-send` 目标，只会在 Host 日志留一条警告。

## 6. 仓库与发布

- GitHub：`aishangwuji/dsh-notify`（public，`main`）
- npm：`@aishangwuji/dsh-notify`，当前 `0.1.0`
- 发布：`npm publish --access public --registry=https://registry.npmjs.org`；通用 npm/2FA/Release 流程见 `D:\Projects\dsh\AGENTS.md` §5。
- 本机 profile 是 `link:D:/Projects/dsh/dsh-notify`（开发用），改宿主代码后重启 DSH。
