---
name: aimodesconfig
description: Architecture reference for Wave Terminal's AI modes configuration system. Use when working on waveai.json, AI provider setup (OpenAI/Anthropic/Azure/Google), or designing the modes visual editor.
---

# Wave AI Modes Configuration - Visual Editor Architecture

## Overview

Wave Terminal's AI modes configuration system allows users to define custom AI assistants with different providers, models, and capabilities. The configuration is stored in `~/.waveterm/config/waveai.json` and provides a flexible way to configure multiple AI modes that appear in the Wave AI panel.

**Key Design Decisions:**
- Visual editor works on **valid JSON only** - if JSON is invalid, fall back to JSON editor
- Default modes (`waveai@quick`, `waveai@balanced`, `waveai@deep`) are **read-only** in visual editor
- Edits modify the **in-memory JSON directly** - changes saved via existing save button
- Mode keys are **auto-generated** from provider + model or random ID (last 4-6 chars)
- Secrets use **fixed naming convention** per provider (e.g., `OPENAI_KEY`, `OPENROUTER_KEY`)
- Quick **inline secret editor** instead of complex secret management

## Current System Architecture

### Data Structure

**Location:** `pkg/wconfig/settingsconfig.go`

```go
type AIModeConfigType struct {
    // Display Configuration
    DisplayName        string   `json:"display:name"`         // Required
    DisplayOrder       float64  `json:"display:order,omitempty"`
    DisplayIcon        string   `json:"display:icon,omitempty"`
    DisplayShortDesc   string   `json:"display:shortdesc,omitempty"`
    DisplayDescription string   `json:"display:description,omitempty"`

    // Provider & Model
    Provider           string   `json:"ai:provider,omitempty"`     // wave, google, openrouter, openai, azure, azure-legacy, custom
    APIType            string   `json:"ai:apitype"`                // Required: anthropic-messages, openai-responses, openai-chat
    Model              string   `json:"ai:model"`                  // Required

    // AI Behavior
    ThinkingLevel      string   `json:"ai:thinkinglevel,omitempty"` // low, medium, high
    Capabilities       []string `json:"ai:capabilities,omitempty"`  // pdfs, images, tools

    // Connection Details
    Endpoint           string   `json:"ai:endpoint,omitempty"`
    APIVersion         string   `json:"ai:apiversion,omitempty"`
    APIToken           string   `json:"ai:apitoken,omitempty"`
    APITokenSecretName string   `json:"ai:apitokensecretname,omitempty"`

    // Azure-Specific
    AzureResourceName  string   `json:"ai:azureresourcename,omitempty"`
    AzureDeployment    string   `json:"ai:azuredeployment,omitempty"`

    // Wave AI Specific
    WaveAICloud        bool     `json:"waveai:cloud,omitempty"`
    WaveAIPremium      bool     `json:"waveai:premium,omitempty"`
}
```

**Storage:** `FullConfigType.WaveAIModes` - `map[string]AIModeConfigType`

Keys follow pattern: `provider@modename` (e.g., `waveai@quick`, `openai@gpt4`)

### Provider Types & Defaults

1. **wave** - Wave AI Cloud service
   - Auto-sets: `waveai:cloud = true`, endpoint from env or default
   - Default endpoint: `https://cfapi.waveterm.dev/api/waveai`

2. **openai** - OpenAI API
   - Auto-sets: endpoint `https://api.openai.com/v1`
   - Auto-detects API type based on model:
     - Legacy models (gpt-4o, gpt-3.5): `openai-chat`
     - New models (gpt-5*, gpt-4.1*, o1*, o3*): `openai-responses`

3. **openrouter** - OpenRouter service
   - Auto-sets: endpoint `https://openrouter.ai/api/v1`, API type `openai-chat`

4. **google** - Google AI (Gemini, etc.)
   - No auto-defaults currently

5. **azure** - Azure OpenAI (new unified API)
   - Auto-sets: API version `v1`, endpoint from resource name

6. **azure-legacy** - Azure OpenAI (legacy chat completions)
   - Auto-sets: API version `2025-04-01-preview`, API type `openai-chat`

7. **custom** - Custom provider
   - No auto-defaults
   - User must specify all fields manually

### Default Configuration

Ships with three Wave AI modes:
- `waveai@quick` - Fast responses (gpt-5-mini, low thinking)
- `waveai@balanced` - Balanced (gpt-5.1, low thinking) [premium]
- `waveai@deep` - Maximum capability (gpt-5.1, medium thinking) [premium]

## Visual Editor Design Plan

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Wave AI Modes Configuration                            │
│  ┌───────────────┐  ┌──────────────────────────────┐   │
│  │  Mode List    │  │    Mode Editor/Viewer        │   │
│  │  [Quick]      │  │  Provider: [wave ▼]         │   │
│  │  [Balanced]   │  │  Display Configuration       │   │
│  │  [Deep]       │  │  Provider Configuration      │   │
│  │  [Custom]     │  │  [Save] [Delete] [Cancel]    │   │
│  │  [+ Add New]  │  │                              │   │
│  └───────────────┘  └──────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Component Structure

```typescript
WaveAIVisualContent
├─ ModeList (left panel)
│  ├─ Header with "Add New Mode" button
│  ├─ List of existing modes (sorted by display:order)
│  └─ Empty state if no modes
│
└─ ModeEditor (right panel)
   ├─ Provider selector dropdown
   ├─ Display section (common to all providers)
   ├─ Provider Configuration section (dynamic based on provider)
   └─ Action buttons (Save, Delete, Cancel)
```

### Provider-Specific Form Fields

**Wave Provider (`wave`):**
- Read-only/Auto-managed: Endpoint, Cloud flag
- User-configurable: Model, API Type, Thinking Level, Capabilities, Premium flag

**OpenAI Provider (`openai`):**
- Auto-managed: Endpoint, API Type (auto-detected), Secret Name (OPENAI_KEY)
- User-configurable: Model, API Key, Thinking Level, Capabilities

**OpenRouter Provider (`openrouter`):**
- Auto-managed: Endpoint, API Type, Secret Name (OPENROUTER_KEY)
- User-configurable: Model, API Key, Thinking Level, Capabilities

**Azure Provider (`azure`):**
- Auto-managed: API Version (v1), Endpoint, API Type, Secret Name (AZURE_KEY)
- User-configurable: Azure Resource Name, Model, API Key, Thinking Level, Capabilities

**Azure Legacy Provider (`azure-legacy`):**
- Auto-managed: API Version (2025-04-01-preview), API Type, Endpoint, Secret Name
- User-configurable: Azure Resource Name, Azure Deployment, Model, API Key

**Google Provider (`google`):**
- Auto-managed: Secret Name (GOOGLE_KEY)
- User-configurable: Model, API Type, Endpoint, API Key, API Version, Thinking Level

**Custom Provider (`custom`):**
- User must specify everything: Model, API Type, Endpoint, Secret Name, etc.

### Data Flow

```
Load JSON → Parse → Render Visual Editor
              ↓
      User Edits Mode → Update fileContentAtom (JSON string)
              ↓
      Click Save → Existing save logic validates & writes
```

**Simplified Operations:**
1. **Load:** Parse `fileContentAtom` JSON string into mode objects
2. **Edit Mode:** Update parsed object → stringify → set `fileContentAtom`
3. **Add Mode:** Generate unique key from provider/model or random ID
4. **Delete Mode:** Remove key from parsed object → stringify → set `fileContentAtom`
5. **Save:** Existing `model.saveFile()` handles validation and write

**Mode Key Generation:**
```typescript
function generateModeKey(provider: string, model: string): string {
    const sanitized = model.toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    const semanticKey = `${provider}@${sanitized}`;

    if (existingModes[semanticKey]) {
        const randomId = crypto.randomUUID().slice(-6);
        return `${provider}@${sanitized}-${randomId}`;
    }
    return semanticKey;
}
// Examples: openai@gpt-4o, openrouter@claude-3-5-sonnet, azure@custom-fb4a2c
```

**Secret Naming Convention:**
```typescript
const SECRET_NAMES = {
    openai: "OPENAI_KEY",
    openrouter: "OPENROUTER_KEY",
    azure: "AZURE_KEY",
    "azure-legacy": "AZURE_KEY",
    google: "GOOGLE_KEY",
} as const;

function getSecretName(provider: string, customSecretName?: string): string {
    if (provider === "custom") {
        return customSecretName || "CUSTOM_API_KEY";
    }
    return SECRET_NAMES[provider];
}
```

### Secret Management UI

**Secret Status Indicator:**
- ✅ Green check icon: Secret exists and is set
- ⚠️ Warning icon (yellow/orange): Secret not set or empty
- Click icon to open secret modal

**Secret Modal:**
- Shows secret name (read-only for non-custom)
- Password input field with show/hide toggle
- Load existing value if secret already exists
- Validates not empty before saving

### Key Features

**1. Mode List**
- Display modes sorted by `display:order`
- Show icon, name, short description
- Badge showing provider type
- Highlight Wave AI premium modes

**2. Add New Mode Flow**
1. Click "Add New Mode"
2. Enter mode key (validated: alphanumeric, @, -, ., _)
3. Select provider from dropdown
4. Form dynamically updates to show provider-specific fields
5. Fill required fields (marked with *)
6. Save → validates → adds to config

**3. Edit Mode Flow**
1. Click mode from list
2. Load mode data into form
3. Edit fields
4. Save → validates → updates config

**4. Delete Mode Flow**
1. Click mode from list
2. Delete button in editor
3. Confirm dialog
4. Remove from config → save → refresh list

**5. Validation**
- **Mode Key:** Must match pattern `^[a-zA-Z0-9_@.-]+$`
- **Required Fields:** `display:name`, `ai:apitype`, `ai:model`
- **Azure Resource Name:** Must match `^[a-z0-9]([a-z0-9-]*[a-z0-9])?$` (1-63 chars)
- **Provider:** Must be one of the valid enum values
- **API Type:** Must be valid enum value
- **Thinking Level:** Must be low/medium/high if present
- **Capabilities:** Must be from valid enum (pdfs, images, tools)

**6. Drag & Drop Reordering**
```typescript
function handleModeReorder(draggedKey: string, targetKey: string) {
    const modes = parseAIModes(fileContent);
    const modesList = Object.entries(modes)
        .sort((a, b) => (a[1]["display:order"] || 0) - (b[1]["display:order"] || 0));

    const draggedIndex = modesList.findIndex(([k]) => k === draggedKey);
    const targetIndex = modesList.findIndex(([k]) => k === targetKey);

    const newOrder = [...modesList];
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, modesList[draggedIndex]);

    newOrder.forEach(([key, mode], index) => {
        modes[key] = { ...mode, "display:order": index * 10 };
    });

    updateFileContent(JSON.stringify(modes, null, 2));
}
```

### Model Extensions (Minimal)

**No new atoms needed!** Visual editor uses existing `fileContentAtom`:

```typescript
function parseAIModes(jsonString: string): Record<string, AIModeConfigType> | null {
    try {
        return JSON.parse(jsonString);
    } catch {
        return null; // Show "invalid JSON" error
    }
}

function updateMode(key: string, mode: AIModeConfigType) {
    const modes = parseAIModes(globalStore.get(model.fileContentAtom));
    if (!modes) return;

    modes[key] = mode;
    const newJson = JSON.stringify(modes, null, 2);
    globalStore.set(model.fileContentAtom, newJson);
    globalStore.set(model.hasEditedAtom, true);
}
```

### UI Components Needed

```typescript
// Main container
WaveAIVisualContent

// Left panel
ModeList ├─ ModeListItem ├─ AddModeButton

// Right panel - viewer
ModeViewer ├─ ModeHeader ├─ DisplaySection ├─ ProviderSection └─ EditButton

// Right panel - editor
ModeEditor ├─ ProviderSelector ├─ DisplayFieldsForm ├─ ProviderFieldsForm (dynamic) └─ ActionButtons

// Modals
RawJSONModal ├─ MonacoEditor ├─ ValidationErrors

// Shared components
SecretSelector
InfoTooltip
ProviderBadge
IconPicker
DragHandle
```

## Implementation Phases

### Phase 1: Foundation & List View
- Parse `fileContentAtom` JSON into modes on render
- Display mode list (left panel, ~300px)
- Built-in modes with 🔒 icon at top, custom modes below
- Sort by `display:order`
- Handle invalid JSON → show error, switch to JSON tab

### Phase 2: Built-in Mode Viewer
- Click built-in mode → show read-only details
- "Built-in Mode" badge/banner
- No edit/delete buttons

### Phase 3: Custom Mode Editor (Basic)
- Click custom mode → load into editor form
- Display fields (name, icon, order, description)
- Provider field (read-only, badge)
- Model field (text input)

### Phase 4: Provider-Specific Fields
- Dynamic form based on provider type
- Info tooltips for auto-configured fields

### Phase 5: Secret Integration
- Check secret existence on mode select
- Display status icon (✅ / ⚠️)
- Click icon → open secret modal

### Phase 6: Add New Mode
- "Add New Mode" button
- Provider dropdown selector
- Auto-generate mode key

### Phase 7: Delete Mode
- Delete button for custom modes only
- Simple confirmation dialog

### Phase 8: Raw JSON Editor
- "Edit Raw JSON" button in mode editor
- Modal with Monaco editor for single mode
- JSON validation before save

### Phase 9: Drag & Drop Reordering
- Drag handle icon to custom mode list items
- Visual feedback during drag
- Recalculate `display:order` on drop

### Phase 10: Polish & UX Refinements
- Field validation with inline error messages
- Empty state when no mode selected
- Icon picker dropdown
- Help tooltips throughout

## Technical Considerations

1. **JSON Sync:** Parse/stringify from `fileContentAtom` on every read/write
2. **Validation:** Validate on blur or before updating JSON
3. **Built-in Detection:** Check if key starts with `waveai@` → read-only
4. **Type Safety:** Use `AIModeConfigType` from gotypes.d.ts
5. **State Management:**
   - Model atoms for shared state (`fileContentAtom`, `hasEditedAtom`)
   - Component useState for UI state (selected mode, modals)
6. **Error Handling:**
   - Invalid JSON → show message, disable visual editor
   - Parse errors → gracefully handle
7. **Performance:**
   - Parse JSON on mount and when `fileContentAtom` changes externally
   - Debounce frequent updates if needed
8. **Secret Checks:**
   - Load secret existence on mode select
   - Cache results to avoid repeated RPC calls