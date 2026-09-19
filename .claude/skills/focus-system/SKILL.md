---
name: focus-system
description: Guide for understanding Wave Terminal's focus system. Use when working on focus management, block selection, terminal focus, visual focus rings, or DOM focus coordination.
---

# Wave Terminal Focus System

Wave Terminal uses a multi-layered focus system that coordinates between:
- **Layout Focus State**: Jotai atoms tracking which block is focused (`nodeModel.isFocused`)
- **Visual Focus Ring**: CSS styling showing the focused block
- **DOM Focus**: Actual browser focus on interactive elements
- **View-Specific Focus**: Custom focus handling by view models (e.g., XTerm terminal focus)

## Focus Flow on Block Click

When you click on a terminal block, this sequence occurs:

### 1. Click Handler Setup

```typescript
const blockModel: BlockComponentModel2 = {
    onClick: setBlockClickedTrue,
    onFocusCapture: handleChildFocus,
    blockRef: blockRef,
};
```

### 2. Click Triggers State Change

When clicked, `setBlockClickedTrue` sets the `blockClicked` state to true.

### 3. useLayoutEffect Responds

```typescript
useLayoutEffect(() => {
    if (!blockClicked) {
        return;
    }
    setBlockClicked(false);
    const focusWithin = focusedBlockId() == nodeModel.blockId;
    if (!focusWithin) {
        setFocusTarget();
    }
    if (!isFocused) {
        nodeModel.focusNode();
    }
}, [blockClicked, isFocused]);
```

### 4. Focus Target Decision

```typescript
const setFocusTarget = useCallback(() => {
    const ok = viewModel?.giveFocus?.();
    if (ok) {
        return;
    }
    focusElemRef.current?.focus({ preventScroll: true });
}, []);
```

The `setFocusTarget` function:
1. First attempts to call the view model's `giveFocus()` method
2. If that succeeds (returns true), we're done
3. Otherwise, falls back to focusing a dummy input element

### 5. Terminal-Specific Focus

```typescript
giveFocus(): boolean {
    if (this.searchAtoms && globalStore.get(this.searchAtoms.isOpen)) {
        return true;
    }
    let termMode = globalStore.get(this.termMode);
    if (termMode == "term") {
        if (this.termRef?.current?.terminal) {
            this.termRef.current.terminal.focus();
            return true;
        }
    }
    return false;
}
```

The terminal's `giveFocus()` calls XTerm's `terminal.focus()` to grant actual DOM focus.

## Selection Protection

A critical feature is that text selections are preserved when clicking within the same block.

### The Protection Mechanism

```typescript
const focusWithin = focusedBlockId() == nodeModel.blockId;
if (!focusWithin) {
    setFocusTarget();
}
```

The key is `focusedBlockId()` which checks:

1. **Active Element**: Is there a focused DOM element within this block?
2. **Selection**: Is there a text selection within this block?

```typescript
export function focusedBlockId(): string {
    const focused = document.activeElement;
    if (focused instanceof HTMLElement) {
        const blockId = findBlockId(focused);
        if (blockId) {
            return blockId;
        }
    }
    const sel = document.getSelection();
    if (sel && sel.anchorNode && sel.rangeCount > 0 && !sel.isCollapsed) {
        let anchor = sel.anchorNode;
        if (anchor instanceof Text) {
            anchor = anchor.parentElement;
        }
        if (anchor instanceof HTMLElement) {
            const blockId = findBlockId(anchor);
            if (blockId) {
                return blockId;
            }
        }
    }
    return null;
}
```

**When making a text selection within a block:**
- `focusWithin` returns true (selection exists in the block)
- `setFocusTarget()` is **skipped**
- Selection is preserved
- Only `nodeModel.focusNode()` is called to update layout state

## Visual Focus vs DOM Focus

There's an important separation between visual focus (the focus ring) and actual DOM focus.

### Visual Focus (Immediate)

```typescript
const handleChildFocus = useCallback(
    (event: React.FocusEvent<HTMLDivElement, Element>) => {
        if (!isFocused) {
            nodeModel.focusNode();  // Updates layout state immediately
        }
    },
    [isFocused]
);
```

This `onFocusCapture` handler fires on **mousedown** (capture phase), immediately updating the visual focus ring.

### DOM Focus (On Click Complete)

The actual DOM focus via `giveFocus()` only happens after click completion, through the onClick → useLayoutEffect path.

### Selection Example: Two Terminals

When making a selection in terminal 2 while terminal 1 is focused:

1. **Mousedown** → `onFocusCapture` fires → `nodeModel.focusNode()` updates focus ring
   - Terminal 2 now shows the focus ring
   - Layout state updated
2. **Drag** → Selection is made in terminal 2
3. **Mouseup** → Selection completes
4. **Click handler** → `onClick` fires → `setBlockClickedTrue` → triggers useLayoutEffect
5. **useLayoutEffect** → Checks `focusWithin` (now true because selection exists)
6. **Protected** → Skips `setFocusTarget()`, preserving the selection

**Result:** Focus ring updates immediately, but DOM focus is only granted after the selection is made, and is protected by the `focusWithin` check.

## Layout State Flow

When layout operations modify focus state, a straightforward chain of updates occurs:
1. **Visual feedback** - The focus ring updates immediately
2. **Physical DOM focus** - The terminal (or other view) receives actual browser focus

The system uses local atoms as the source of truth with async persistence to the backend.

### 1. Setting Focus in Layout Operations

Throughout `layoutTree.ts`, operations directly mutate `layoutState.focusedNodeId`:

```typescript
if (action.magnified) {
    layoutState.magnifiedNodeId = action.node.id;
    layoutState.focusedNodeId = action.node.id;
}
if (action.focused) {
    layoutState.focusedNodeId = action.node.id;
}
```

This happens in ~10 places: insertNode, insertNodeAtIndex, deleteNode, focusNode, magnifyNodeToggle, etc.

### 2. Committing to Local Atom

The `LayoutModel.treeReducer()` commits changes:

```typescript
treeReducer(action: LayoutTreeAction, setState = true): boolean {
    focusNode(this.treeState, action);

    if (setState) {
        this.updateTree();
        this.setter(this.localTreeStateAtom, { ...this.treeState });  // Sync update
        this.persistToBackend();  // Async persistence
    }
}
```

The key is `{ ...this.treeState }` creating a new object reference, triggering Jotai reactivity.

### 3. Derived Atoms Recalculate

Each block's `NodeModel` has an `isFocused` atom:

```typescript
isFocused: atom((get) => {
    const treeState = get(this.localTreeStateAtom);
    const isFocused = treeState.focusedNodeId === nodeid;
    const waveAIFocused = get(atoms.waveAIFocusedAtom);
    return isFocused && !waveAIFocused;
})
```

When `localTreeStateAtom` updates, all `isFocused` atoms recalculate. Only the matching node returns `true`.

### 4. React Components Re-render

**Visual Focus Ring** - Components subscribe to `isFocused`:

```typescript
const isFocused = useAtomValue(nodeModel.isFocused);
```

CSS classes update immediately, showing the focus ring.

**Physical DOM Focus** - Two-step effect chain:

```typescript
// Step 1: isFocused → blockClicked
useLayoutEffect(() => {
    setBlockClicked(isFocused);
}, [isFocused]);

// Step 2: blockClicked → physical focus
useLayoutEffect(() => {
    if (!blockClicked) return;
    setBlockClicked(false);
    const focusWithin = focusedBlockId() == nodeModel.blockId;
    if (!focusWithin) {
        setFocusTarget();  // Calls viewModel.giveFocus()
    }
}, [blockClicked, isFocused]);
```

The terminal's `giveFocus()` method grants actual browser focus:

```typescript
giveFocus(): boolean {
    if (termMode == "term" && this.termRef?.current?.terminal) {
        this.termRef.current.terminal.focus();
        return true;
    }
    return false;
}
```

### 5. Background Persistence

While the UI updates synchronously, persistence happens asynchronously:

```typescript
private persistToBackend() {
    setTimeout(() => {
        waveObj.rootnode = this.treeState.rootNode;
        waveObj.focusednodeid = this.treeState.focusedNodeId;
        waveObj.magnifiednodeid = this.treeState.magnifiedNodeId;
        waveObj.leaforder = this.treeState.leafOrder;
        this.setter(this.waveObjectAtom, waveObj);
    }, 100);
}
```

The WaveObject is used purely for persistence (tab restore, uncaching).

## Terminal-Specific Focus Events

The terminal view has three useEffects that call `giveFocus()`:

1. **Search Close** - When the search panel closes, focus returns to the terminal
2. **Terminal Recreation** - When a terminal is recreated while focused, focus is restored
3. **Mode Switch** - When switching from vdom mode back to term mode, the terminal receives focus

## Key Components

- `frontend/app/block/block.tsx` - Manages the BlockFull component, handles click/focus events
- `frontend/app/block/blocktypes.ts` - Defines `BlockNodeModel` interface
- `frontend/util/focusutil.ts` - `focusedBlockId()`, `hasSelection()`, `findBlockId()`

```typescript
export interface BlockNodeModel {
    blockId: string;
    isFocused: Atom<boolean>;
    onClose: () => void;
    focusNode: () => void;
}
```

## Summary

The focus system elegantly separates concerns:
- **Visual feedback** updates immediately on mousedown
- **DOM focus** is deferred until after user interaction completes
- **Selections are protected** by checking focus state before granting focus
- **View-specific focus** is delegated to view models via `giveFocus()`

This design allows for responsive UI (immediate focus ring updates) while preventing disruption of user interactions like text selection.