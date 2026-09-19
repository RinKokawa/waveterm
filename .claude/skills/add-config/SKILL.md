---
name: add-config
description: Guide for adding new configuration values to Wave Terminal. Use when introducing new settings, adding config keys, or working with the hierarchical config system (block → connection → global → default).
---

# Wave Terminal Configuration System

This document explains how Wave Terminal's configuration system works and provides step-by-step instructions for adding new configuration values.

## Overview

Wave Terminal uses a hierarchical configuration system with the following components:

1. **Go Struct Definitions** - Type-safe configuration structure in Go
2. **JSON Schema** - Validation schema for configuration files
3. **Default Values** - Built-in default configuration
4. **User Configuration** - User-customizable settings in `~/.config/waveterm/settings.json`
5. **Documentation** - User-facing documentation

## Configuration File Structure

```
waveterm/
├── pkg/wconfig/                          # Go configuration package
│   ├── settingsconfig.go                 # Main settings struct definitions
│   ├── defaultconfig/
│   │   ├── settings.json                 # Default settings values
│   │   ├── termthemes.json
│   │   ├── presets.json
│   │   └── widgets.json
├── schema/                               # JSON Schema definitions
│   └── settings.json                     # Settings validation schema
└── ~/.config/waveterm/                   # User config directory (runtime)
    ├── settings.json
    ├── connections.json
    └── ...
```

**Key Files:**
- `pkg/wconfig/settingsconfig.go` - Defines the `SettingsType` struct
- `schema/settings.json` - JSON Schema for validation (auto-generated)
- `pkg/wconfig/defaultconfig/settings.json` - Default values for all settings

## Configuration Hierarchy

1. **Built-in Defaults** (`pkg/wconfig/defaultconfig/settings.json`)
2. **User Settings** (`~/.config/waveterm/settings.json`)
3. **Block-level Overrides** (stored in block metadata)

Settings cascade from defaults → user settings → block overrides.

### Block-Level Metadata Override System

Wave Terminal supports block-level configuration overrides. Settings can be applied globally, per-connection, or per-block:

1. **Global Settings** (`~/.config/waveterm/settings.json`) - Apply to all blocks by default
2. **Connection Settings** (in connections config) - Apply to all blocks using a specific connection
3. **Block Metadata** - Override settings for individual blocks

**Frontend Usage:**

```typescript
import { useAtomValue } from "jotai";
import { getOverrideConfigAtom } from "@/store/global";

// Use getOverrideConfigAtom for hierarchical config resolution
const settingValue = useAtomValue(getOverrideConfigAtom(blockId, "namespace:setting"));
// Auto-resolves: block metadata → connection config → global settings → default
```

**Setting Block Metadata:**

```bash
# Set for current block
wsh setmeta namespace:setting=value

# Set for specific block
wsh setmeta --block BLOCK_ID namespace:setting=value
```

## How to Add a New Configuration Value

### Step 1: Add to Go Struct Definition

Edit `pkg/wconfig/settingsconfig.go` and add your new field to the `SettingsType` struct:

```go
type SettingsType struct {
    // ... existing fields ...

    // Add your new field with appropriate JSON tag
    MyNewSetting string `json:"mynew:setting,omitempty"`

    // For different types:
    MyBoolSetting   bool    `json:"mynew:boolsetting,omitempty"`
    MyNumberSetting float64 `json:"mynew:numbersetting,omitempty"`
    MyIntSetting    *int64  `json:"mynew:intsetting,omitempty"`    // Use pointer for optional ints
    MyArraySetting  []string `json:"mynew:arraysetting,omitempty"`
}
```

**Naming Conventions:**
- Use namespace prefixes (e.g., `term:`, `window:`, `ai:`, `web:`)
- Use lowercase with colons as separators
- Field names should be descriptive and follow Go naming conventions
- Use `omitempty` tag to exclude empty values from JSON

**Type Guidelines:**
- Use `*int64` and `*float64` for optional numeric values
- Use `*bool` for optional boolean values
- Use `string` for text values
- Use `[]string` for arrays
- Use `float64` for numbers that can be decimals

### Step 1.5: Add to Block Metadata (Optional)

If your setting should support block-level overrides, also add it to `pkg/waveobj/wtypemeta.go`:

```go
type MetaTSType struct {
    // ... existing fields ...

    // Add your new field with matching JSON tag and type
    MyNewSetting *string `json:"mynew:setting,omitempty"`  // Use pointer for optional values

    // For different types:
    MyBoolSetting   *bool    `json:"mynew:boolsetting,omitempty"`
    MyNumberSetting *float64 `json:"mynew:numbersetting,omitempty"`
    MyIntSetting    *int     `json:"mynew:intsetting,omitempty"`
    MyArraySetting  []string `json:"mynew:arraysetting,omitempty"`
}
```

**Block Metadata Guidelines:**
- Use pointer types (`*string`, `*bool`, `*int`, `*float64`) for optional overrides
- JSON tags should exactly match the corresponding settings field
- This enables the hierarchical config system

### Step 2: Set Default Value (Optional)

If your setting should have a default value, add it to `pkg/wconfig/defaultconfig/settings.json`:

```json
{
  "mynew:setting": "default value",
  "mynew:boolsetting": true,
  "mynew:numbersetting": 42.5,
  "mynew:intsetting": 100
}
```

Only add defaults for settings that should have non-zero/non-empty initial values.

### Step 3: Regenerate Schema and TypeScript Types

Run the generate task to automatically regenerate the JSON schema and TypeScript types:

```bash
task generate
```

**What this does:**
- Generates JSON schema from Go structs
- Generates TypeScript type definitions in `frontend/types/gotypes.d.ts`
- Generates RPC client APIs
- Generates metadata constants

The JSON schema in `schema/settings.json` is **automatically generated** from the Go struct definitions - you don't need to edit it manually.

### Step 4: Use in Frontend Code

Access your new setting in React components:

```typescript
import { getOverrideConfigAtom, useAtomValue } from "@/store/global";

const MyComponent = ({ blockId }: { blockId: string }) => {
    // Use override config atom for hierarchical resolution
    const mySettingAtom = getOverrideConfigAtom(blockId, "mynew:setting");
    const mySetting = useAtomValue(mySettingAtom) ?? "fallback value";

    // For global-only settings (no block overrides)
    const globalOnlySetting = useAtomValue(getSettingsKeyAtom("mynew:globalsetting")) ?? "fallback";

    return <div>Setting value: {mySetting}</div>;
};
```

**Frontend Configuration Patterns:**

```typescript
// 1. Settings with block-level overrides (recommended)
const termFontSize = useAtomValue(getOverrideConfigAtom(blockId, "term:fontsize")) ?? 12;

// 2. Global-only settings
const appGlobalHotkey = useAtomValue(getSettingsKeyAtom("app:globalhotkey")) ?? "";

// 3. Connection-specific settings
const connStatus = useAtomValue(getConnStatusAtom(connectionName));
```

### Step 5: Use in Backend Code

Access settings in Go code:

```go
// Get the full config
fullConfig := wconfig.GetWatcher().GetFullConfig()

// Access your setting
myValue := fullConfig.Settings.MyNewSetting
```

## Quick Reference: Setting and Reading Config Variables

### Setting a Config Variable

Use `RpcApi.SetConfigCommand` to update a configuration:

```ts
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";

await RpcApi.SetConfigCommand(TabRpcClient, { "web:defaulturl": url });
```

For block-level overrides, use `SetMetaCommand` instead:

```ts
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { WOS } from "@/store/global";

await RpcApi.SetMetaCommand(TabRpcClient, {
    oref: WOS.makeORef("block", blockId),
    meta: { "mynew:setting": "block-specific value" },
});
```

### Reading a Config Value

To read a configuration value, retrieve the corresponding atom using `getSettingsKeyAtom` and use `globalStore.get`:

```ts
import { getSettingsKeyAtom, useSettingsKeyAtom, globalStore } from "@/app/store/global";

// Outside React (imperative)
const configAtom = getSettingsKeyAtom("app:defaultnewblock");
const configValue = globalStore.get(configAtom) ?? "default value";

// Inside React component
const configValue = useSettingsKeyAtom("app:defaultnewblock") ?? "default value";
```

## Configuration Patterns

### Namespace Organization

Settings are organized by namespace using colon separators:
- `app:*` - Application-level settings
- `term:*` - Terminal-specific settings
- `window:*` - Window and UI settings
- `ai:*` - AI-related settings
- `web:*` - Web browser settings
- `editor:*` - Code editor settings
- `conn:*` - Connection settings

### Clear/Reset Pattern

Each namespace can have a "clear" field for resetting all settings in that namespace:

```go
AppClear  bool `json:"app:*,omitempty"`
TermClear bool `json:"term:*,omitempty"`
```

### Optional vs Required Settings

- Use pointer types (`*bool`, `*int64`, `*float64`) for truly optional settings
- Use regular types for settings that should always have a value
- Provide sensible defaults for important settings

## Example: Adding a New Terminal Setting

Here's a complete example adding `term:bellsound`:

### 1. Go Struct (`settingsconfig.go`)

```go
type SettingsType struct {
    // ... existing fields ...
    TermBellSound string `json:"term:bellsound,omitempty"`
}
```

### 2. Block Metadata (`wtypemeta.go`)

```go
type MetaTSType struct {
    // ... existing fields ...
    TermBellSound *string `json:"term:bellsound,omitempty"`  // Pointer for optional override
}
```

### 3. Default Value (`defaultconfig/settings.json` - optional)

```json
{
  "term:bellsound": "default"
}
```

### 4. Regenerate Types

```bash
task generate
```

### 5. Frontend Usage

```typescript
const bellSoundAtom = getOverrideConfigAtom(blockId, "term:bellsound");
const bellSound = useAtomValue(bellSoundAtom) ?? "default";
```

### 6. Usage Examples

```bash
# Set globally
wsh setconfig term:bellsound="custom.wav"

# Set for current block only
wsh setmeta term:bellsound="none"
```

## Testing Your Configuration

1. **Build and run** Wave Terminal with your changes
2. **Test default behavior** - Ensure the default value works
3. **Test user override** - Add your setting to `~/.config/waveterm/settings.json`
4. **Test block override** - Set block-specific metadata
5. **Verify schema validation** - Ensure invalid values are rejected