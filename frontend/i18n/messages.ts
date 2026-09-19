// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import type { Locale } from "./locale";

type MessageDict = Record<string, Record<Locale, string>>;

export const messages: MessageDict = {
    // ── Common ─────────────────────────────────────────────
    "common.cancel": { en: "Cancel", "zh-CN": "取消" },
    "common.ok": { en: "Ok", "zh-CN": "确定" },
    "common.default": { en: "Default", "zh-CN": "默认" },
    "common.on": { en: "On", "zh-CN": "开" },
    "common.off": { en: "Off", "zh-CN": "关" },
    "common.none": { en: "None", "zh-CN": "无" },
    "common.close": { en: "Close", "zh-CN": "关闭" },

    // ── App-level context menu ─────────────────────────────
    "menu.cut": { en: "Cut", "zh-CN": "剪切" },
    "menu.copy": { en: "Copy", "zh-CN": "复制" },
    "menu.paste": { en: "Paste", "zh-CN": "粘贴" },
    "menu.openClipboardUrl": { en: "Open Clipboard URL", "zh-CN": "打开剪贴板链接" },

    // ── Block header context menu ──────────────────────────
    "block.magnify": { en: "Magnify Block", "zh-CN": "放大块" },
    "block.unmagnify": { en: "Un-Magnify Block", "zh-CN": "取消放大" },
    "block.copyBlockId": { en: "Copy BlockId", "zh-CN": "复制块 ID" },
    "block.close": { en: "Close Block", "zh-CN": "关闭块" },

    // ── Terminal right-click menu ──────────────────────────
    "term.menu.copy": { en: "Copy", "zh-CN": "复制" },
    "term.menu.sendToAI": { en: "Send to Wave AI", "zh-CN": "发送到 Wave AI" },
    "term.menu.openUrl": { en: "Open URL", "zh-CN": "打开链接" },
    "term.menu.openUrlWith": { en: "Open URL ({hostname})", "zh-CN": "打开链接（{hostname}）" },
    "term.menu.openUrlExternal": { en: "Open URL in External Browser", "zh-CN": "在外部浏览器打开链接" },
    "term.menu.paste": { en: "Paste", "zh-CN": "粘贴" },
    "term.menu.splitHoriz": { en: "Split Horizontally", "zh-CN": "水平分屏" },
    "term.menu.splitVert": { en: "Split Vertically", "zh-CN": "垂直分屏" },
    "term.menu.fileBrowser": { en: "File Browser", "zh-CN": "文件浏览器" },
    "term.menu.saveSessionAs": { en: "Save Session As...", "zh-CN": "将会话另存为..." },
    "term.menu.themes": { en: "Themes", "zh-CN": "主题" },
    "term.menu.fontSize": { en: "Font Size", "zh-CN": "字号" },
    "term.menu.fontSizeDefault": { en: "Default ({n}px)", "zh-CN": "默认（{n}px）" },
    "term.menu.cursor": { en: "Cursor", "zh-CN": "光标" },
    "term.menu.transparency": { en: "Transparency", "zh-CN": "透明度" },
    "term.menu.transparentBg": { en: "Transparent Background", "zh-CN": "透明背景" },
    "term.menu.noTransparency": { en: "No Transparency", "zh-CN": "不透明" },
    "term.menu.advanced": { en: "Advanced", "zh-CN": "高级" },
    "term.menu.allowBracketedPaste": { en: "Allow Bracketed Paste Mode", "zh-CN": "允许括号粘贴模式" },
    "term.menu.forceRestart": { en: "Force Restart Controller", "zh-CN": "强制重启控制器" },
    "term.menu.clearOnRestart": { en: "Clear Output On Restart", "zh-CN": "重启时清空输出" },
    "term.menu.runOnStartup": { en: "Run On Startup", "zh-CN": "启动时运行" },
    "term.menu.debugConnection": { en: "Debug Connection", "zh-CN": "调试连接" },
    "term.menu.sessionDurability": { en: "Session Durability", "zh-CN": "会话持久化" },
    "term.menu.restartDurable": { en: "Restart Session in Durable Mode", "zh-CN": "以持久化模式重启会话" },
    "term.menu.restartStandard": { en: "Restart Session in Standard Mode", "zh-CN": "以标准模式重启会话" },
    "term.menu.closeToolbar": { en: "Close Toolbar", "zh-CN": "关闭工具栏" },

    // ── Tab bar / context menu ─────────────────────────────
    "tab.tooltip.toggleAi": { en: "Toggle Wave AI Panel", "zh-CN": "切换 Wave AI 面板" },
    "tab.tooltip.workspaceSwitcher": { en: "Workspace Switcher", "zh-CN": "工作区切换器" },
    "tab.tooltip.addTab": { en: "Add Tab", "zh-CN": "新建标签" },
    "tab.tooltip.closeTab": { en: "Close Tab", "zh-CN": "关闭标签" },
    "tab.aria.tabName": { en: "Tab name", "zh-CN": "标签名称" },
    "tab.aria.closeTab": { en: "Close tab", "zh-CN": "关闭标签" },
    "tab.aria.newTab": { en: "New Tab", "zh-CN": "新建标签" },
    "tab.newTab": { en: "New Tab", "zh-CN": "新建标签" },

    "tab.menu.rename": { en: "Rename Tab", "zh-CN": "重命名标签" },
    "tab.menu.copyTabId": { en: "Copy TabId", "zh-CN": "复制标签 ID" },
    "tab.menu.flagTab": { en: "Flag Tab", "zh-CN": "标签标记色" },
    "tab.menu.backgrounds": { en: "Backgrounds", "zh-CN": "背景" },
    "tab.menu.closeTab": { en: "Close Tab", "zh-CN": "关闭标签" },
    "tab.menu.tabBarPosition": { en: "Tab Bar Position", "zh-CN": "标签栏位置" },
    "tab.menu.tabBarTop": { en: "Top", "zh-CN": "顶部" },
    "tab.menu.tabBarLeft": { en: "Left", "zh-CN": "左侧" },

    "tab.color.green": { en: "Green", "zh-CN": "绿色" },
    "tab.color.teal": { en: "Teal", "zh-CN": "青色" },
    "tab.color.blue": { en: "Blue", "zh-CN": "蓝色" },
    "tab.color.purple": { en: "Purple", "zh-CN": "紫色" },
    "tab.color.red": { en: "Red", "zh-CN": "红色" },
    "tab.color.orange": { en: "Orange", "zh-CN": "橙色" },
    "tab.color.yellow": { en: "Yellow", "zh-CN": "黄色" },

    // ── Workspace switcher ──────────────────────────────────
    "ws.switch": { en: "Switch workspace", "zh-CN": "切换工作区" },
    "ws.open": { en: "Open workspace", "zh-CN": "打开工作区" },
    "ws.createNew": { en: "Create new workspace", "zh-CN": "新建工作区" },
    "ws.save": { en: "Save workspace", "zh-CN": "保存工作区" },
    "ws.edit": { en: "Edit workspace", "zh-CN": "编辑工作区" },
    "ws.current": { en: "This is your current workspace", "zh-CN": "这是当前工作区" },
    "ws.active": { en: "This workspace is open", "zh-CN": "该工作区已打开" },

    // ── Settings floating window (gear popup) ──────────────
    "settings.floating.title": { en: "Settings & Help", "zh-CN": "设置与帮助" },
    "settings.floating.configErrors": { en: "Config Errors", "zh-CN": "配置错误" },
    "settings.floating.settings": { en: "Settings", "zh-CN": "设置" },
    "settings.floating.tips": { en: "Tips", "zh-CN": "提示" },
    "settings.floating.secrets": { en: "Secrets", "zh-CN": "密钥" },
    // FORK: releaseNotes removed — see FORK.md (UpgradeOnboardingPatch modal deleted)
    "settings.floating.help": { en: "Help", "zh-CN": "帮助" },

    // ── Settings page (WaveConfig) ─────────────────────────
    "settings.configFiles": { en: "Config Files", "zh-CN": "配置文件" },
    "settings.save": { en: "Save", "zh-CN": "保存" },
    "settings.saving": { en: "Saving...", "zh-CN": "保存中..." },
    "settings.unsaved": { en: "Unsaved changes", "zh-CN": "有未保存的修改" },
    "settings.visual": { en: "Visual", "zh-CN": "可视化" },
    "settings.rawJson": { en: "Raw JSON", "zh-CN": "原始 JSON" },
    "settings.loading": { en: "Loading...", "zh-CN": "加载中..." },
    "settings.configErrorPrefix": { en: "Config Error: ", "zh-CN": "配置错误：" },
    "settings.deprecated": { en: "deprecated", "zh-CN": "已废弃" },
    "settings.viewDocs": { en: "View documentation", "zh-CN": "查看文档" },
    "settings.saveShortcut": { en: "Save ({shortcut})", "zh-CN": "保存（{shortcut}）" },
    "settings.discardConfirm": {
        en: "You have unsaved changes. Discard and continue?",
        "zh-CN": "有未保存的修改，确定要放弃并继续吗？",
    },
    "settings.language": { en: "Language", "zh-CN": "语言" },
    "settings.language.en": { en: "English", "zh-CN": "English" },
    "settings.language.zh-CN": { en: "简体中文", "zh-CN": "简体中文" },

    // ── Settings: config file names ────────────────────────
    "settings.file.general": { en: "General", "zh-CN": "通用" },
    "settings.file.connections": { en: "Connections", "zh-CN": "连接" },
    "settings.file.connectionsDesc.win": { en: "SSH hosts and WSL distros", "zh-CN": "SSH 主机和 WSL 发行版" },
    "settings.file.connectionsDesc": { en: "SSH hosts", "zh-CN": "SSH 主机" },
    "settings.file.widgets": { en: "Sidebar Widgets", "zh-CN": "侧栏小部件" },
    "settings.file.waveai": { en: "Wave AI Modes", "zh-CN": "Wave AI 模式" },
    "settings.file.waveaiDesc": { en: "Local models and BYOK", "zh-CN": "本地模型与自带密钥" },
    "settings.file.backgrounds": { en: "Tab Backgrounds", "zh-CN": "标签背景" },
    "settings.file.secrets": { en: "Secrets", "zh-CN": "密钥" },
    "settings.file.presets": { en: "Presets", "zh-CN": "预设" },
    "settings.file.aiPresets": { en: "AI Presets", "zh-CN": "AI 预设" },

    // ── Cursor type labels (terminal menu) ─────────────────
    "term.cursor.block": { en: "Block", "zh-CN": "方块" },
    "term.cursor.blockBlink": { en: "Block (Blinking)", "zh-CN": "方块（闪烁）" },
    "term.cursor.bar": { en: "Bar", "zh-CN": "竖线" },
    "term.cursor.barBlink": { en: "Bar (Blinking)", "zh-CN": "竖线（闪烁）" },
    "term.cursor.underline": { en: "Underline", "zh-CN": "下划线" },
    "term.cursor.underlineBlink": { en: "Underline (Blinking)", "zh-CN": "下划线（闪烁）" },

    // ── Debug levels ───────────────────────────────────────
    "debug.info": { en: "Info", "zh-CN": "信息" },
    "debug.verbose": { en: "Verbose", "zh-CN": "详细" },
};

export type MessageKey = keyof typeof messages;