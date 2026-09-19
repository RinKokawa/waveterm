# Wave Terminal Fork Modifications

本文档记录本 fork 相对于上游 [`wavetermdev/waveterm`](https://github.com/wavetermdev/waveterm) 的所有改动。
当上游更新后,可通过 `git diff upstream/main -- <file>` 对照本文件判断哪些冲突需要手动合并。

> **Fork 仓库**: <https://github.com/RinKokawa/waveterm>
> **上游基线**: 上次拉取的 commit(本文件初始化时为 `a4447c15`)
> **Fork 目的**: 上游 5 个月未更新,作者计划基于此 base 自用改造

---

## 改动总览

| 模块 | 类型 | 策略 | 主要影响 |
|------|------|------|----------|
| **云遥测 / 分析事件** | 整个禁用 | **stub** (helper 改 no-op) | 不向 waveterm dev 上报任何数据 |
| **自动更新机制** | 完整删除 | **clean delete** | 去掉 electron-updater,自用 fork 不期望自动更新 |
| **Onboarding 弹窗** (welcome / what's new) | 完整删除 | **clean delete** | 首次启动欢迎页 + 版本升级"新功能"页全删 |
| **根目录杂物清理** | 完整删除 | **clean delete** | 删除上游 CI / docs / i18e README / 占位文件,精简 fork 仓库 |
| **aiprompts → .claude/skills** | 转写 + 删除 | 转写为 `.claude/skills/*/SKILL.md` | Claude Code 原生 skills 格式;AI 自动按需加载 |
| **简体中文本地化** | 新增 | 新增 `frontend/i18n/` 目录 | 终端右键菜单 / 设置页 / 标签栏翻译;设置页加语言下拉框 |

---

## 一、已禁用:云遥测 / 分析事件

### 改动原因
fork 自用,不希望任何使用数据上报到 waveterm dev 后端。

### 改动策略: stub (保留调用点,只把 helper 改成 no-op)
- 整个仓库有 **30+ 个** `recordTEvent(...)` / `RecordTEventCommand(...)` 调用点
- 全部删除会导致 diff 巨大、风险点过多
- stub 策略 = 改 1 处 helper 函数即可让所有调用点变成空操作
- revert 容易:只需恢复 helper 函数体

### Go 侧改动

| 文件 | 改动内容 |
|------|----------|
| `pkg/wshrpc/wshserver/wshserver.go` | `RecordTEventCommand` RPC handler body 改为 `return nil` |
| `pkg/wshrpc/wshserver/wshserver.go` | `WaveAIEnableTelemetryCommand` 保留设置写入,但不再触发事件 |
| `pkg/wshrpc/wshserver/wshserver.go` | `SendTelemetryCommand` 改为 `return nil` |
| `cmd/server/main-server.go` | 3 处 `wcloud.Send*` / `CacheAndRemoveEnvVars` 调用整行注释 |
| `pkg/wconfig/defaultconfig/settings.json` | `"telemetry:enabled": true` → `false` |

### 前端改动

| 文件 | 改动内容 |
|------|----------|
| `frontend/app/store/global.ts` | `recordTEvent()` 函数体改为空,只保留签名 + 注释 |

### 构建 / 开发

| 文件 | 改动内容 |
|------|----------|
| `Taskfile.yml` | 4 个 task block (`electron:dev`, `electron:start`, `electron:quickdev`, `electron:winquickdev`) 中的 `WCLOUD_*` 环境变量整块删除 |

### 保留不动 (便于 revert)

- `pkg/wcloud/` 整个目录保留
- `pkg/telemetry/` 整个目录保留
- `schema/settings.json` 中的 `telemetry:*` schema 条目保留
- 所有 `recordTEvent(...)` 调用点保留 (stub 后是 no-op)

### 如何 revert

1. `pkg/wshrpc/wshserver/wshserver.go` — 恢复 `RecordTEventCommand`、`SendTelemetryCommand`、`WaveAIEnableTelemetryCommand` 原 body
2. `cmd/server/main-server.go` — 反注释 3 处 `wcloud.Send*` / `CacheAndRemoveEnvVars` 调用
3. `frontend/app/store/global.ts` — 恢复 `recordTEvent()` 函数体(注释里保留了原 body)
4. `Taskfile.yml` — 恢复 4 个 task block 中的 `WCLOUD_*` 环境变量
5. `pkg/wconfig/defaultconfig/settings.json` — `"telemetry:enabled": false` → `true`

---

## 二、已删除:自动更新机制

### 改动原因
- fork 自用,不期望自动更新 (用户手动升级即可)
- 减少攻击面(不再拉取远程更新 manifest)
- 减少包体积
- 移除一个独立的 `electron-updater` 依赖

### 改动策略: clean delete (删除整个特性)
- 自动更新是边界清晰的独立特性(独立 UI、独立文件、独立 schema、独立依赖)
- 适合完整删除

### 已删除文件 (2 个)

- `emain/updater.ts` — Electron updater 主类(254 行,所有 `electron-updater` API 调用)
- `frontend/app/tab/updatebanner.tsx` — Tab 栏右侧的"有新版本"横幅组件

### 已移除依赖

| 文件 | 改动 |
|------|------|
| `package.json` | 移除 `"electron-updater": "^6.6"` |
| `electron-builder.config.cjs` | `generateUpdatesFilesForAllChannels: false`、移除整个 `publish` block |

### Schema 移除

| 文件 | 改动 |
|------|------|
| `schema/settings.json` | 移除 `autoupdate:*` 系列条目(4-5 个 key) |
| `pkg/wconfig/defaultconfig/settings.json` | 移除 `autoupdate:*` 默认值 |
| `pkg/wconfig/metaconsts.go` | 注释掉 `ConfigKey_AutoUpdate*` 5 个常量 |
| `pkg/wconfig/settingsconfig.go` | 注释掉 `SettingsType.AutoUpdate*` 5 个字段;`CountCustomSettings` 不再排除 `autoupdate:channel` |
| `pkg/telemetry/telemetry.go` | 注释掉 `IsAutoUpdateEnabled()` / `AutoUpdateChannel()` |
| `pkg/telemetry/telemetrydata/telemetrydata.go` | 注释掉 `TEventUserProps.AutoUpdateChannel` / `AutoUpdateEnabled` |
| `pkg/wcloud/wcloud.go` | 注释掉 `TelemetryInputType` 中 `AutoUpdateEnabled` / `AutoUpdateChannel` 的赋值 |
| `pkg/wcloud/wclouddata.go` | 注释掉 `TelemetryInputType` 中 `AutoUpdateEnabled` / `AutoUpdateChannel` 字段定义 |
| `cmd/server/main-server.go` | `startupActivityUpdate` 中相关变量与字段赋值注释掉 |

### 前端类型 / 状态

| 文件 | 改动 |
|------|------|
| `frontend/types/custom.d.ts` | 注释掉 `GlobalAtomsType.updaterStatusAtom`、`ElectronApi.onUpdaterStatusChange/getUpdaterStatus/getUpdaterChannel/installAppUpdate`、`type UpdaterStatus` |
| `frontend/app/store/global-atoms.ts` | 注释掉 `updaterStatusAtom` atom 定义、bootstrap 代码、atoms 导出 |
| `frontend/wave.ts` | 注释掉 `globalStore.set(atoms.updaterStatusAtom, getApi().getUpdaterStatus())` |

### Electron preload (contextBridge API)

| 文件 | 改动 |
|------|------|
| `emain/preload.ts` | 注释掉 `onUpdaterStatusChange` / `getUpdaterStatus` / `getUpdaterChannel` / `installAppUpdate` |

### Electron 主进程

| 文件 | 改动 |
|------|------|
| `emain/emain.ts` | 注释掉 `configureAutoUpdater` import + `configureAutoUpdater()` 调用 + `updater?.stop()` 调用 |
| `emain/emain-menu.ts` | 注释掉 `updater` import + macOS 菜单 "Check for Updates" 项 |
| `emain/emain-wavesrv.ts` | 注释掉 `updater` import + `updater?.status == "installing"` 判断 |
| `emain/emain-window.ts` | 注释掉 `updater` import + 2 处 `updater?.status == "installing"` 判断 |
| `emain/emain-wsh.ts` | 注释掉 `getResolvedUpdateChannel` import + `handle_getupdatechannel` 改为返回固定字符串 `"latest"` |

### 前端组件

| 文件 | 改动 |
|------|------|
| `frontend/app/tab/tabbar.tsx` | 注释掉 `UpdateStatusBanner` import、`appUpdateStatus` useAtomValue、`<UpdateStatusBanner/>` 挂载、useEffect 依赖 |
| `frontend/app/tab/tabbarenv.ts` | 注释掉 `installAppUpdate` / `updaterStatusAtom` env 字段 |
| `frontend/app/tab/vtabbar.tsx` | 注释掉 `UpdateStatusBanner` import + 挂载 |
| `frontend/app/tab/vtabbarenv.ts` | 注释掉 `installAppUpdate` / `updaterStatusAtom` env 字段 |
| `frontend/app/modals/about.tsx` | 移除 About 模态框中的 "Update Channel: ..." 行;移除 `updaterChannel` prop |
| `frontend/preview/previews/modal-about.preview.tsx` | 移除 `updaterChannel` prop |
| `frontend/preview/previews/tabbar.preview.tsx` | 注释掉 "Updater banner" 下拉控件 |
| `frontend/preview/previews/vtabbar.preview.tsx` | 注释掉 "Updater banner" 下拉控件 |
| `frontend/preview/mock/mockwaveenv.ts` | 注释掉 mock env 中的 `updaterStatusAtom` |
| `frontend/preview/mock/preview-electron-api.ts` | 注释掉 4 个 updater mock 方法 |
| `frontend/app/onboarding/fakechat.tsx` | 移除 markdown 中提及 "updater" 的字句 |

### 构建 / 文档(可选清理)

- `electron-builder.config.cjs` 的 `RELEASES_BUCKET` / `WINGET_PACKAGE` 等发布配置保留(只 fork 自己不用,但代码无害)
- `docs/docs/config.mdx`、`docs/docs/faq.mdx`、`docs/docs/releasenotes.mdx` 中的 auto-update 章节保留(文档不是 fork 维护重点)
- `version.cjs` 版本号自增脚本保留(仍需要)

### 关于 `gotypes.d.ts`

`frontend/types/gotypes.d.ts` 是从 Go 类型自动生成的,文件中仍有 `autoupdate:*` 的 type 引用。它们是 `?: T` 可选属性,**不影响编译**。下次运行 `go generate` 后会自动同步本 fork 的 Go 端注释修改。

### 如何 revert

1. 从上游拉取最新
2. 本 fork 中 `// FORK: auto-update disabled — see FORK.md` 标记的行/块,全部恢复为非注释状态
3. 重新创建 `emain/updater.ts` 和 `frontend/app/tab/updatebanner.tsx`(从 upstream copy)
4. `package.json` 加回 `"electron-updater": "^6.6"`
5. `electron-builder.config.cjs` 恢复 `publish` block、`generateUpdatesFilesForAllChannels: true`
6. `schema/settings.json` + `pkg/wconfig/defaultconfig/settings.json` 恢复 `autoupdate:*` 条目
7. `npm install`

---

## 三、已删除:Onboarding 弹窗 (欢迎页 + 版本升级"新功能"页)

### 改动原因
fork 自用,不想要任何引导/营销性质的弹窗。

### 改动策略: clean delete (删除整个特性)

### 已删除文件 (22 个)

**主弹窗组件 (4 个)**
- `frontend/app/onboarding/onboarding.tsx` — `NewInstallOnboardingModal`(首次启动的"Welcome to Wave Terminal / GitHub star / Discord / Telemetry consent / TOS agreement")
- `frontend/app/onboarding/onboarding-upgrade.tsx` — `UpgradeOnboardingModal`(分发器)
- `frontend/app/onboarding/onboarding-upgrade-minor.tsx` — minor 版本升级内容
- `frontend/app/onboarding/onboarding-upgrade-patch.tsx` — patch 版本升级内容

**版本特定升级内容 (10 个)**
- `frontend/app/onboarding/onboarding-upgrade-v0121.tsx`
- `frontend/app/onboarding/onboarding-upgrade-v0122.tsx`
- `frontend/app/onboarding/onboarding-upgrade-v0123.tsx`
- `frontend/app/onboarding/onboarding-upgrade-v0130.tsx`
- `frontend/app/onboarding/onboarding-upgrade-v0131.tsx`
- `frontend/app/onboarding/onboarding-upgrade-v0140.tsx`
- `frontend/app/onboarding/onboarding-upgrade-v0141.tsx`
- `frontend/app/onboarding/onboarding-upgrade-v0142.tsx`
- `frontend/app/onboarding/onboarding-upgrade-v0144.tsx`
- `frontend/app/onboarding/onboarding-upgrade-v0145.tsx`

**功能介绍页 (7 个)**
- `frontend/app/onboarding/onboarding-features.tsx` — 多页功能介绍 (waveai / durable / magnify / files)
- `frontend/app/onboarding/onboarding-features-footer.tsx` — 功能介绍页底部
- `frontend/app/onboarding/onboarding-command.tsx` — 动画打字命令组件
- `frontend/app/onboarding/onboarding-durable.tsx` — Durable session 介绍页
- `frontend/app/onboarding/onboarding-layout.tsx` — FakeBlock 组件
- `frontend/app/onboarding/onboarding-layout-term.tsx` — FakeTermBlock 组件
- `frontend/app/onboarding/onboarding-starask.tsx` — GitHub star 请求页
- `frontend/app/onboarding/onboarding-common.tsx` — 共享 utils (`CurrentOnboardingVersion`, `OnboardingGradientBg`)

**Preview (1 个)**
- `frontend/preview/previews/onboarding.preview.tsx` — onboarding 组件的 Storybook preview

### 保留文件
- `frontend/app/onboarding/fakechat.tsx` — 保留(虽然是 onboarding 目录里的,但只服务于 AI 面板 preview,非弹窗)

### 修改文件

| 文件 | 改动 |
|------|------|
| `frontend/app/modals/modalsrenderer.tsx` | 删除 `NewInstallOnboardingModal` 和 `UpgradeOnboardingModal` 的触发 useEffect、删除 `tosagreed` gate、删除 `ClientModel` / `semver` 引用 |
| `frontend/app/modals/modalregistry.tsx` | 移除 3 个 onboarding modal 的注册(改为注释) |
| `frontend/app/store/modalmodel.ts` | 移除 `newInstallOnboardingOpen` / `upgradeOnboardingOpen` atoms(注释保留) |
| `frontend/app/modals/about.tsx` | 内联 `OnboardingGradientBg` 的 CSS(因为 `onboarding-common.tsx` 删了) |
| `frontend/app/workspace/widgets.tsx` | 移除 floating settings 菜单中的 "Release Notes" 项(原本打开 `UpgradeOnboardingPatch` modal) |
| `frontend/i18n/messages.ts` | 移除 `settings.floating.releaseNotes` 翻译键 |
| `pkg/wcore/workspace.go` | 更新"after onboarding modal dismissal"注释 |

### 涉及但不动的代码

- `frontend/app/store/services.ts` 中 `ClientService.AgreeTos` 保留 — 现在不会被调用,但留着无害
- `pkg/waveobj/wtypemeta.go` 中 `OnboardingGithubStar` / `OnboardingLastVersion` 字段保留 — 现在不会再写入,但留着无害
- `pkg/waveobj/metaconsts.go` 中 `MetaKey_OnboardingGithubStar` / `MetaKey_OnboardingLastVersion` 常量保留
- `pkg/telemetry/telemetrydata/telemetrydata.go` 中 `onboarding:*` 事件保留 — telemetry 已 stub,这些字段永远不会上报
- `pkg/telemetry/telemetry.go` 中 `GetTosAgreedTs` / cohort 计算保留 — 同上

### 如何 revert

1. 从 git history 找回删除的 22 个文件(或者从 upstream pull 后参考)
2. `frontend/app/modals/modalsrenderer.tsx` — 恢复 `ClientModel` / `semver` import + 两个 useEffect(参考 git history)
3. `frontend/app/modals/modalregistry.tsx` — 恢复 3 个 modal 注册行
4. `frontend/app/store/modalmodel.ts` — 恢复 2 个 onboarding atoms
5. `frontend/app/modals/about.tsx` — 把 inline 渐变换成 `<OnboardingGradientBg />` 引用
6. `frontend/app/workspace/widgets.tsx` — 恢复 "Release Notes" 菜单项
7. `frontend/i18n/messages.ts` — 恢复 `settings.floating.releaseNotes` 翻译键
8. `pkg/wcore/workspace.go` — 恢复原注释

---

## 四、已删除:根目录杂物 (CI / docs / 占位文件)

### 改动原因
fork 自用,上游的 CI、docs 网站、Issue 模板、占位 README 对 fork 维护无价值。删掉之后仓库更干净,以后 `git status` 看 diff 时不会被噪声干扰。

### 已删除内容

**GitHub 配置 (16 个文件)**
- `.github/FUNDING.yml`
- `.github/dependabot.yml`
- `.github/copilot-instructions.md`
- `.github/ISSUE_TEMPLATE/bug-report.yml`、`config.yml`、`feature-request.yml`
- `.github/workflows/build-helper.yml`、`bump-version.yml`、`codeql.yml`、`copilot-setup-steps.yml`、`deploy-docsite.yml`、`merge-gatekeeper.yml`、`publish-release.yml`、`testdriver-build.yml`、`testdriver.yml`

**仓库元文件 (7 个)**
- `CNAME` — 文档站域名占位
- `CODE_OF_CONDUCT.md`、`CONTRIBUTING.md`、`SECURITY.md`、`ROADMAP.md`、`RELEASES.md` — 上游社区治理文件,fork 不需要
- `README.ko.md`、`README.zh-TW.md` — 多语言 README 翻译(保留 `README.md` 即可)

**第三方 IDE 配置 (2 个目录)**
- `.roo/` — Roo Code 配置,fork 不用
- `.zed/` — Zed 编辑器配置

**测试相关 (1 个文件 + 整个目录)**
- `testdriver/onboarding.yml` — 上游 onboarding 测试驱动
- `tests/copytests/` — 整个目录(45+ 个 shell 脚本测试用例)

**第三方 Agent 配置 (1 个目录)**
- `.kilocode/skills/` — Kilocode skills,已用 `.claude/skills/` 取代
- `.kilocode/rules/` — 整体迁移到 `.claude/rules/`(更新 CLAUDE.md 引用);`.kilocode/` 目录整体删除

**文档站 (整个 `docs/` 目录)**
- 67 个文件,包括 `docs/.editorconfig`、`.gitignore`、`.prettierignore`、`.remarkrc`、`README.md`、`babel.config.js`
- 所有 `docs/docs/*.mdx` 内容(ai-presets, claude-code, config, connections, customization, customwidgets, durable-sessions, faq, gettingstarted, index, keybindings, layout, releasenotes, secrets, tab-backgrounds)
- 所有 `docs/docs/img/*` 图片资源

### 修改文件

| 文件 | 改动 |
|------|------|
| `package.json` | 移除 `"docs"` workspace,只保留 `"tsunami/frontend"` |
| `Taskfile.yml` | 移除引用 docs / GitHub workflows 的 task(`gen:docs`、`docs:*` 等) |
| `CLAUDE.md` | `@.kilocode/rules/rules.md` → `@.claude/rules/rules.md`(配合 `.kilocode/` 整体迁移) |

### 如何 revert
1. 从 upstream 拉回相应目录(例如 `git checkout upstream/main -- docs/`)
2. `package.json` 恢复 `"docs"` workspace
3. `Taskfile.yml` 恢复 docs 相关 task

---

## 五、aiprompts → `.claude/skills/` 转写

### 改动原因
- 上游 `aiprompts/` 目录下散落 28 份 AI 辅助文档,绝大多数是给 AI agent 看的"如何做 X"操作指南
- 文件散落在目录里,需要 AI 主动探索才知道有这份文档
- Claude Code 原生支持 `.claude/skills/<name>/SKILL.md` 格式,frontmatter 里写 description 即可按需加载

### 改动策略:转写为 skills,删除原文件

### 已新增 skills (13 个)

| Skill | 原 aiprompts 来源 | 用途 |
|-------|------------------|------|
| `add-config` | `config-system.md` + `getsetconfigvar.md` (合并) | 添加新配置项 |
| `aimodesconfig` | `aimodesconfig.md` | waveai.json 配置架构参考 |
| `blockcontroller-lifecycle` | `blockcontroller-lifecycle.md` | 块控制器生命周期 |
| `connection-architecture` | `conn-arch.md` + `fe-conn-arch.md` (合并) | 连接架构(Local/SSH/WSL/S3) |
| `context-menu` | `contextmenu.md` | 右键菜单开发 |
| `create-view` | `newview.md` | 新建视图类型 |
| `focus-system` | `focus.md` + `focus-layout.md` (合并) | 焦点系统 |
| `layout-system` | `layout.md` | 布局系统架构参考 |
| `tsunami-builder` | `tsunami-builder.md` | Tsunami AI Builder V1 架构 |
| `usechat-backend` | `usechat-backend-design.md` | useChat 后端设计 |
| `viewmodel-pattern` | `view-prompt.md` | ViewModel / ViewComponent 模式 |
| `waveai-architecture` | `waveai-architecture.md` | Wave AI 聊天功能架构 |
| `wps-events` | `wps-events.md` | WPS 发布订阅事件系统 |

### 已删除 aiprompts 文件 (15 个)
所有转为 skills 的源文件已删除:
`contextmenu.md`、`newview.md`、`wps-events.md`、`config-system.md`、`getsetconfigvar.md`、`blockcontroller-lifecycle.md`、`conn-arch.md`、`fe-conn-arch.md`、`tsunami-builder.md`、`usechat-backend-design.md`、`layout.md`、`focus.md`、`focus-layout.md`、`view-prompt.md`、`waveai-architecture.md`、`aimodesconfig.md`

### 保留未转写的 aiprompts 文件 (12 个)

这些是**外部 API 库参考**而非本项目操作指南,直接保留为参考更高效,转写为 skill 反而冗余:

- `aisdk-streaming.md` — Vercel AI SDK 流式处理
- `aisdk-uimessage-type.md` — AI SDK UI 消息类型
- `anthropic-messages-api.md` — Anthropic Messages API
- `anthropic-streaming.md` — Anthropic 流式事件
- `monaco-v0.53.md` — Monaco Editor 0.53 升级说明
- `openai-request.md` — OpenAI 请求格式
- `openai-streaming.md`、`openai-streaming-text.md` — OpenAI 流式协议
- `tailwind-container-queries.md` — Tailwind 容器查询
- `layout-simplification.md` — 布局简化设计草稿
- `wave-osc-16162.md` — issue/讨论记录
- `waveai-focus-updates.md` — Wave AI focus 更新设计

### 修改文件

| 文件 | 改动 |
|------|------|
| `CLAUDE.md` | 替换 skills 表格,从 `.kilocode/skills/` 改为 `.claude/skills/`,加入新增的 skills(原表只列了 8 个,新表 13 个) |
| `.claude/skills/` | 新建目录,包含 13 个 `<skill-name>/SKILL.md` |

### 如何 revert
1. 重新从 git history 拉回删除的 15 个 `aiprompts/*.md` 文件
2. `.claude/skills/` 整个目录可以保留(无害)或一并删除
3. `CLAUDE.md` 恢复原 skills 表

---

## 六、已新增:简体中文本地化 (i18n)

### 改动内容
- 新建 `frontend/i18n/` 目录,包含:
  - `messages.ts` — 所有翻译键
  - `locale.ts` — `t()` 函数 + `LocaleAtom`
- 设置页(`frontend/app/view/waveconfig/waveconfig.tsx`)加了一个语言下拉框
- 翻译范围:**终端右键菜单**、**设置页**、**标签栏**

### 改动文件清单 (i18n)
- 新建: `frontend/i18n/messages.ts`、`frontend/i18n/locale.ts`
- 修改: `frontend/wave.ts`、`frontend/app/app.tsx`、`frontend/app/view/term/term-model.ts`、`frontend/app/tab/tabcontextmenu.ts`、`tabbar.tsx`、`vtabbar.tsx`、`tab.tsx`、`vtab.tsx`、`workspaceswitcher.tsx`
- 修改: `frontend/app/view/waveconfig/waveconfig.tsx`、`waveconfig-model.ts`
- 修改: `frontend/app/workspace/widgets.tsx`、`frontend/app/modals/modal.tsx`
- 修改: `tsconfig.json` — 加 `"@/i18n/*": ["frontend/i18n/*"]` 路径别名

### 如何 revert
- 删除 `frontend/i18n/` 目录
- 上述 i18n 修改文件中,所有 `t("...")` 调用恢复为原硬编码字符串
- `tsconfig.json` 中移除 `@/i18n/*` 别名

---

## 七、上游 merge 指南

当上游更新后,推荐流程:

1. **拉取上游**:
   ```bash
   git fetch upstream
   git checkout main
   git merge upstream/main  # 或 rebase
   ```

2. **解决冲突**:
   - 本 fork 的大多数改动是新增行 / 注释行,冲突概率低
   - 主要关注点:
     - `pkg/wshrpc/wshserver/wshserver.go` — telemetry stub 可能与上游改动冲突
     - `cmd/server/main-server.go` — 同上
     - `frontend/app/store/global.ts` — recordTEvent stub
     - 自动更新相关文件 — 如果上游也在改 updater,会有冲突
   - 冲突时,先采用 upstream 版本,然后**重新应用本 fork 的 stub 逻辑**

3. **重新生成类型**:
   ```bash
   # 如果 Go 端有改动
   go generate ./cmd/generate/
   ```

4. **验证**:
   - 启动 dev 看是否能正常启动(无 UpdaterStatus / telemetry 类型错误)
   - `npm run build:prod` 验证能构建

---

## 八、完整改动文件清单 (相对上游)

### 新增文件 (4)
- `FORK.md` (本文件)
- `frontend/i18n/messages.ts`、`frontend/i18n/locale.ts` — i18n 系统
- `.claude/skills/*/SKILL.md` (13 个) — Claude Code skills
- `.claude/rules/rules.md` + `.claude/rules/overview.md` — 从 `.kilocode/rules/` 迁移过来的项目规则

### 删除文件 (大量,按主题分组)

**自动更新 (2)**
- `emain/updater.ts`、`frontend/app/tab/updatebanner.tsx`

**Onboarding (22)** — 见三
- 4 个主弹窗组件、10 个版本升级 v*、8 个功能介绍/工具组件、1 个 preview

**根目录杂物 (90+)** — 见四
- `.github/` 16 个文件、7 个仓库元文件、2 个 IDE 配置目录、`testdriver/onboarding.yml`、整个 `tests/copytests/`、整个 `.kilocode/skills/`、整个 `docs/`

**aiprompts 转写 (16)** — 见五
- 16 个 `aiprompts/*.md` 文件已转写为 skills,原文件删除

**合计 ~130 个文件已删除**

### 修改文件 (按目录分组)

**根目录配置**
- `package.json` — 移除 `electron-updater`、移除 `"docs"` workspace
- `electron-builder.config.cjs` — 移除 publish 块、关闭 update file 生成
- `tsconfig.json` — 加 i18n 路径别名
- `CLAUDE.md` — skills 表从 `.kilocode/skills/` 改 `.claude/skills/`,加入新增的 13 个 skills

**Build / Task**
- `Taskfile.yml` — 移除 4 个 task block 的 `WCLOUD_*` 环境变量;移除 docs / GitHub workflows 相关 task

**Schema / Settings**
- `schema/settings.json` — 移除 `autoupdate:*` 条目
- `pkg/wconfig/defaultconfig/settings.json` — 移除 `autoupdate:*` 默认值、`telemetry:enabled` → false
- `pkg/wconfig/metaconsts.go` — 注释 AutoUpdate 常量
- `pkg/wconfig/settingsconfig.go` — 注释 AutoUpdate 字段、调整 CountCustomSettings

**Go Backend**
- `cmd/server/main-server.go` — 注释 3 处 wcloud 调用、注释 startupActivityUpdate 中的 AutoUpdate;移除 `wcloud.Send*` 后产生的 unused `ctx` 变量
- `pkg/wcore/workspace.go` — 更新 onboarding 相关注释
- `pkg/wshrpc/wshserver/wshserver.go` — RecordTEventCommand / SendTelemetryCommand / WaveAIEnableTelemetryCommand 改 no-op;`wcloud` import 改为 blank import
- `pkg/telemetry/telemetry.go` — 注释 IsAutoUpdateEnabled / AutoUpdateChannel
- `pkg/telemetry/telemetrydata/telemetrydata.go` — 注释 AutoUpdate 字段
- `pkg/wcloud/wcloud.go` — 注释 AutoUpdate 字段赋值
- `pkg/wcloud/wclouddata.go` — 注释 AutoUpdate 字段定义

**Electron Main**
- `emain/emain.ts` — 注释 configureAutoUpdater / updater?.stop()
- `emain/emain-menu.ts` — 注释 macOS "Check for Updates" 菜单 + import
- `emain/emain-wavesrv.ts` — 注释 updater import + installing 判断
- `emain/emain-window.ts` — 注释 updater import + 2 处 installing 判断
- `emain/emain-wsh.ts` — 注释 getResolvedUpdateChannel import + 改 handle_getupdatechannel 返回固定值
- `emain/preload.ts` — 注释 4 个 updater contextBridge 方法

**Frontend - Electron API / 状态**
- `frontend/types/custom.d.ts` — 注释 updater 相关类型 / atoms
- `frontend/types/gotypes.d.ts` — (自动生成,待 `go generate` 重新生成)
- `frontend/app/store/global.ts` — recordTEvent 改 stub
- `frontend/app/store/global-atoms.ts` — 注释 updaterStatusAtom atom
- `frontend/app/store/modalmodel.ts` — 注释 onboarding atoms
- `frontend/wave.ts` — 注释 updaterStatusAtom 初始化;i18n 初始化

**Frontend - UI 组件**
- `frontend/app/tab/tabbar.tsx`、`tabbarenv.ts`、`vtabbar.tsx`、`vtabbarenv.ts` — 注释 updater 相关
- `frontend/app/tab/tab.tsx`、`vtab.tsx`、`tabcontextmenu.ts`、`workspaceswitcher.tsx` — i18n 翻译
- `frontend/app/modals/about.tsx` — 移除 Update Channel 行;内联 OnboardingGradientBg CSS
- `frontend/app/modals/modalregistry.tsx` — 移除 3 个 onboarding modal 注册
- `frontend/app/modals/modalsrenderer.tsx` — 简化,移除 onboarding 触发逻辑 + ClientModel/semver imports
- `frontend/app/modals/modal.tsx` — i18n 翻译
- `frontend/app/workspace/widgets.tsx` — 移除 "Release Notes" 菜单项;i18n 翻译
- `frontend/app/onboarding/fakechat.tsx` — 移除 markdown 中 updater 提及
- `frontend/app/view/waveconfig/waveconfig.tsx`、`waveconfig-model.ts` — i18n + 语言下拉框
- `frontend/app/view/term/term-model.ts` — i18n 翻译
- `frontend/app/app.tsx` — i18n 初始化

**Frontend - Preview / Mock**
- `frontend/preview/previews/modal-about.preview.tsx` — 移除 updaterChannel prop
- `frontend/preview/previews/tabbar.preview.tsx`、`vtabbar.preview.tsx` — 注释 updater banner 下拉
- `frontend/preview/mock/mockwaveenv.ts` — 注释 updaterStatusAtom mock
- `frontend/preview/mock/preview-electron-api.ts` — 注释 4 个 updater mock 方法

---

## 九、保留未改 (评估过但决定不动)

| 模块 | 决定 | 原因 |
|------|------|------|
| **AI 功能** (`pkg/aiusechat/`、`frontend/app/aipanel/`) | 保留 | 用户说"暂时保留",后续若不需要再清理 |
| **Tsunami / WaveApp Builder** (`tsunami/`、`frontend/builder/`、`pkg/waveapp/`) | 保留 | 用户确认"保留" |
| **`pkg/wcloud/` 整个目录** | 保留 | 方便 telemetry revert |
| **`pkg/telemetry/` 整个目录** | 保留 | 方便 telemetry revert |
| **`pkg/wconfig/defaultconfig/settings.json` 中 `telemetry:*` schema** | 保留 | 不影响功能,便于 revert |
| **`emain/emain-activity.ts` 中 `setUserConfirmedQuit` / `getUserConfirmedQuit`** | 保留 | wavesrv 启动错误路径仍需使用 |
| **`AgreeTos` service + `OnboardingGithubStar` / `OnboardingLastVersion` metadata** | 保留 (dead code) | onboarding 弹窗删了但底层 Go service 和 metadata 字段还在,留着无害、便于 revert |
| **`aiprompts/` 剩余 12 个 API 参考文档** | 保留 | 外部库参考(Anthropic / OpenAI / AI SDK / Monaco 等),不适合转 skill |

---

## 十、变更日志

| 日期 | 改动 |
|------|------|
| 2026-09-20 | 完成 telemetry stub、自动更新 clean delete、i18n 增量;创建本 `FORK.md` |
| 2026-09-20 | 完成 onboarding 弹窗 clean delete (22 文件);更新 `FORK.md` |
| 2026-09-20 | 完成根目录杂物清理 (.github / docs / tests / IDE 配置 / 占位文件,~90 文件);完成 16 个 aiprompts 转写为 13 个 `.claude/skills/`;更新 `CLAUDE.md`;更新本 `FORK.md` |
| 2026-09-20 | `.kilocode/rules/` 整体迁移到 `.claude/rules/`,`.kilocode/` 目录整体删除;`CLAUDE.md` 引用路径同步更新 |
