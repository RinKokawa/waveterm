@.claude/rules/rules.md

---

## Skill Guides

This project uses a set of "skill" guides — focused how-to documents for common implementation tasks. When your task matches one of the descriptions below, **read the linked SKILL.md file before proceeding** and follow its instructions precisely.

| Skill                      | File | Description |
| ------------------------- | ---- | ----------- |
| add-config                | `.claude/skills/add-config/SKILL.md` | Guide for adding new configuration settings to Wave Terminal. Use when adding a new setting, implementing a new config key, or working with the hierarchical config system (block → connection → global → default). |
| aimodesconfig             | `.claude/skills/aimodesconfig/SKILL.md` | Architecture reference for AI modes configuration. Use when working on waveai.json, AI provider setup (OpenAI/Anthropic/Azure/Google), or designing the modes visual editor. |
| blockcontroller-lifecycle | `.claude/skills/blockcontroller-lifecycle/SKILL.md` | Guide for Wave Terminal's block controller lifecycle. Use when working on terminal/process controllers, restarting shells, or handling controller status events. |
| connection-architecture   | `.claude/skills/connection-architecture/SKILL.md` | Architecture reference for connection system (Local/SSH/WSL/S3). Use when working on connection controllers, file operations over connections, or connstatus events. |
| context-menu              | `.claude/skills/context-menu/SKILL.md` | Guide for creating and displaying right-click context menus. Use when implementing context menus, adding menu items, submenus, or checkbox interactions. |
| create-view               | `.claude/skills/create-view/SKILL.md` | Guide for implementing a new view type. Use when creating a new view component, implementing the ViewModel interface, or registering a new view type in BlockRegistry. |
| focus-system              | `.claude/skills/focus-system/SKILL.md` | Guide for Wave Terminal's focus system. Use when working on focus management, block selection, terminal focus, visual focus rings, or DOM focus coordination. |
| layout-system             | `.claude/skills/layout-system/SKILL.md` | Architecture reference for the tile-based layout system. Use when working on drag-and-drop layouts, resize operations, or layout state management. |
| tsunami-builder           | `.claude/skills/tsunami-builder/SKILL.md` | Architecture reference for the Tsunami AI Builder. Use when working on the split-screen chat/preview/code editor for building Tsunami apps. |
| usechat-backend           | `.claude/skills/usechat-backend/SKILL.md` | Design doc for useChat()-compatible backend. Use when implementing chat streaming endpoints or migrating from RPC to AI SDK. |
| viewmodel-pattern         | `.claude/skills/viewmodel-pattern/SKILL.md` | Guide for ViewModel/ViewComponent pattern. Use when implementing new block types, designing UI with Jotai atoms, or building model-view components. |
| waveai-architecture       | `.claude/skills/waveai-architecture/SKILL.md` | Architecture reference for the Wave AI chat feature. Use when working on AI providers (OpenAI, Anthropic, Perplexity, Google, Wave Cloud), chat streaming, or the waveai block view. |
| wps-events                | `.claude/skills/wps-events/SKILL.md` | Guide for using the WPS (Wave PubSub) event system. Use when adding new event types, publishing events, subscribing to events, or designing event-driven communication. |