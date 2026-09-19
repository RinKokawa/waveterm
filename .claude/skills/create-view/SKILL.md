---
name: create-view
description: Guide for creating a new view type in Wave Terminal. Use when implementing a new view, adding a new block content component, or building a custom view with ViewModel/ViewComponent pattern.
---

# Creating a New View in Wave Terminal

This guide explains how to implement a new view type in Wave Terminal. Views are the core content components displayed within blocks in the terminal interface.

## Architecture Overview

Wave Terminal uses a **Model-View architecture** where:
- **ViewModel** - Contains all state, logic, and UI configuration as Jotai atoms
- **ViewComponent** - Pure React component that renders the UI using the model
- **BlockFrame** - Wraps views with a header, connection management, and standard controls

The separation between model and component ensures:
- Models can update state without React hooks
- Components remain pure and testable
- State is centralized in Jotai atoms for easy access

## ViewModel Interface

Every view must implement the `ViewModel` interface defined in `frontend/types/custom.d.ts`:

```typescript
interface ViewModel {
    // Required: The type identifier for this view (e.g., "term", "web", "preview")
    viewType: string;

    // Required: The React component that renders this view
    viewComponent: ViewComponent<ViewModel>;

    // Optional: Icon shown in block header (FontAwesome icon name or IconButtonDecl)
    viewIcon?: jotai.Atom<string | IconButtonDecl>;

    // Optional: Display name shown in block header
    viewName?: jotai.Atom<string>;

    // Optional: Additional header elements shown after the name
    viewText?: jotai.Atom<string | HeaderElem[]>;

    // Optional: Icon button shown before the view name in header
    preIconButton?: jotai.Atom<IconButtonDecl>;

    // Optional: Icon buttons shown at the end of the header
    endIconButtons?: jotai.Atom<IconButtonDecl[]>;

    // Optional: Custom background styling for the block
    blockBg?: jotai.Atom<MetaType>;

    // Optional: If true, completely hides the block header
    noHeader?: jotai.Atom<boolean>;

    // Optional: If true, shows connection picker in header for remote connections
    manageConnection?: jotai.Atom<boolean>;

    // Optional: If true, filters out 'nowsh' connections from connection picker
    filterOutNowsh?: jotai.Atom<boolean>;

    // Optional: If true, shows S3 connections in connection picker
    showS3?: jotai.Atom<boolean>;

    // Optional: If true, removes default padding from content area
    noPadding?: jotai.Atom<boolean>;

    // Optional: Atoms for managing in-block search functionality
    searchAtoms?: SearchAtoms;

    // Optional: Returns whether this is a basic terminal
    isBasicTerm?: (getFn: jotai.Getter) => boolean;

    // Optional: Returns context menu items for the settings dropdown
    getSettingsMenuItems?: () => ContextMenuItem[];

    // Optional: Focuses the view when called, returns true if successful
    giveFocus?: () => boolean;

    // Optional: Handles keyboard events, returns true if handled
    keyDownHandler?: (e: WaveKeyboardEvent) => boolean;

    // Optional: Cleanup when block is closed
    dispose?: () => void;
}
```

### Key Concepts

**Atoms**: All UI-related properties must be Jotai atoms. This enables:
- Reactive updates when state changes
- Access from anywhere via `globalStore.get()` / `globalStore.set()`
- Derived atoms that compute values from other atoms

**ViewComponent**: The React component receives these props:

```typescript
type ViewComponentProps<T extends ViewModel> = {
    blockId: string;
    blockRef: React.RefObject<HTMLDivElement>;
    contentRef: React.RefObject<HTMLDivElement>;
    model: T;
};
```

## Step-by-Step Guide

### 1. Create the View Model Class

Create a new file for your view model (e.g., `frontend/app/view/myview/myview-model.ts`):

```typescript
import { BlockNodeModel } from "@/app/block/blocktypes";
import { globalStore } from "@/app/store/jotaiStore";
import { WOS, useBlockAtom } from "@/store/global";
import * as jotai from "jotai";
import { MyView } from "./myview";

export class MyViewModel implements ViewModel {
    viewType: string;
    blockId: string;
    nodeModel: BlockNodeModel;
    blockAtom: jotai.Atom<Block>;

    // Simple field-initial atoms
    viewIcon = jotai.atom<string>("circle");
    viewName = jotai.Atom<string>("My View");
    noPadding = jotai.atom<boolean>(true);

    // Derived atom (declared in constructor)
    viewText!: jotai.Atom<HeaderElem[]>;

    constructor(blockId: string, nodeModel: BlockNodeModel) {
        this.viewType = "myview";
        this.blockId = blockId;
        this.nodeModel = nodeModel;
        this.blockAtom = WOS.getWaveObjectAtom<Block>(`block:${blockId}`);

        this.viewText = jotai.atom((get) => {
            const blockData = get(this.blockAtom);
            const rtn: HeaderElem[] = [];

            rtn.push({
                elemtype: "iconbutton",
                icon: "refresh",
                title: "Refresh",
                click: () => this.refresh(),
            });

            return rtn;
        });
    }

    get viewComponent(): ViewComponent {
        return MyView;
    }

    refresh() {
        // Update state using globalStore. Never use React hooks here.
        console.log("refreshing...");
    }

    giveFocus(): boolean {
        return true;
    }

    dispose() {
        // Cleanup resources
    }
}
```

### 2. Create the View Component

Create your React component (e.g., `frontend/app/view/myview/myview.tsx`):

```typescript
import { ViewComponentProps } from "@/app/block/blocktypes";
import { MyViewModel } from "./myview-model";
import { useAtomValue } from "jotai";
import "./myview.scss";

export const MyView: React.FC<ViewComponentProps<MyViewModel>> = ({
    blockId,
    model,
    contentRef
}) => {
    const blockData = useAtomValue(model.blockAtom);

    return (
        <div className="myview-container" ref={contentRef}>
            <div>Block ID: {blockId}</div>
            <div>View: {model.viewType}</div>
        </div>
    );
};
```

### 3. Register the View

Add your view to the `BlockRegistry` in `frontend/app/block/block.tsx`:

```typescript
const BlockRegistry: Map<string, ViewModelClass> = new Map();
BlockRegistry.set("term", TermViewModel);
BlockRegistry.set("preview", PreviewModel);
BlockRegistry.set("web", WebViewModel);
// ... existing registrations ...
BlockRegistry.set("myview", MyViewModel);  // Add your view here
```

The registry key (e.g., `"myview"`) becomes the view type used in block metadata.

### 4. Create Blocks with Your View

Users can create blocks with your view type:
- Via CLI: `wsh view myview`
- Via RPC: Set block's `meta.view` to `"myview"`

## Header Elements (`HeaderElem`)

The `viewText` atom can return an array of these element types:

```typescript
// Icon button
{ elemtype: "iconbutton", icon: "refresh", title: "Tooltip", click: () => {}, disabled?: boolean, iconColor?: string, iconSpin?: boolean }

// Text element
{ elemtype: "text", text: "Display text", className?: string, noGrow?: boolean, ref?: React.RefObject<HTMLElement>, onClick?: (e: React.MouseEvent) => void }

// Text button
{ elemtype: "textbutton", text: "Button text", className?: string, title: "Tooltip", onClick: (e: React.MouseEvent) => void }

// Input field
{ elemtype: "input", value: string, className?: string, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, ... }

// Container with children
{ elemtype: "div", className?: string, children: HeaderElem[], onMouseOver?: ..., onMouseOut?: ... }

// Menu button (dropdown)
{ elemtype: "menubutton", /* MenuButtonProps */ }
```

## Best Practices

### Jotai Model Pattern

1. **Simple atoms as field initializers**:
   ```typescript
   viewIcon = jotai.atom<string>("circle");
   noPadding = jotai.atom<boolean>(true);
   ```

2. **Derived atoms in constructor** (need dependency on other atoms):
   ```typescript
   this.viewText = jotai.atom((get) => {
       const blockData = get(this.blockAtom);
       return [/* computed based on blockData */];
   });
   ```

3. **Models never use React hooks** - Use `globalStore.get()` / `set()`:
   ```typescript
   refresh() {
       const currentData = globalStore.get(this.blockAtom);
       globalStore.set(this.dataAtom, newData);
   }
   ```

4. **Components use hooks for atoms**:
   ```typescript
   const data = useAtomValue(model.dataAtom);
   const [value, setValue] = useAtom(model.valueAtom);
   ```

### State Management

- All view state should live in atoms on the model
- Use `useBlockAtom()` helper for block-scoped atoms that persist
- Use `globalStore` for imperative access outside React components
- Subscribe to Wave events using `waveEventSubscribe()`

### Connection Management

For views that need remote connections:
```typescript
this.manageConnection = jotai.atom(true);  // Show connection picker
this.filterOutNowsh = jotai.atom(true);    // Hide nowsh connections
this.showS3 = jotai.atom(true);            // Show S3 connections
```

Access connection status:
```typescript
const connStatus = jotai.atom((get) => {
    const blockData = get(this.blockAtom);
    const connName = blockData?.meta?.connection;
    return get(getConnStatusAtom(connName));
});
```

### Configuration Overrides

Wave has a hierarchical config system (global → connection → block):

```typescript
import { getOverrideConfigAtom } from "@/store/global";

this.settingAtom = jotai.atom((get) => {
    return get(getOverrideConfigAtom(this.blockId, "myview:setting")) ?? defaultValue;
});
```

### Updating Block Metadata

```typescript
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { WOS } from "@/store/global";

await RpcApi.SetMetaCommand(TabRpcClient, {
    oref: WOS.makeORef("block", this.blockId),
    meta: { "myview:key": value },
});
```

## Testing Your View

1. Build the frontend: `npm run build:dev` or `npm run dev`
2. Create a block with your view type
3. Test all interactive elements (buttons, inputs, etc.)
4. Test keyboard shortcuts
5. Test focus behavior
6. Test cleanup (close block and check console for errors)
7. Test with different block configurations via metadata

## Additional Resources

- `frontend/app/block/blockframe.tsx` - Block header rendering
- `frontend/app/view/term/term-model.ts` - Complex view example
- `frontend/app/view/webview/webview.tsx` - Navigation UI example
- `frontend/types/custom.d.ts` - Type definitions