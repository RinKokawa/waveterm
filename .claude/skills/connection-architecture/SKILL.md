---
name: connection-architecture
description: Architecture reference for Wave Terminal's connection system (Local/SSH/WSL/S3). Use when working on connection controllers, file operations over connections, connstatus events, or the frontend/backend connection flow.
---

# Wave Terminal Connection Architecture

## Overview

Wave Terminal's connection system is designed to provide a unified interface for running shell processes across local, SSH, and WSL environments. The architecture is built in layers, with clear separation of concerns between connection management, shell process execution, and block-level orchestration.

## Backend Architecture Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                    Block Controllers                             │
│  (blockcontroller/blockcontroller.go, shellcontroller.go)       │
│  - Block lifecycle management                                    │
│  - Controller registry and switching                             │
│  - Connection status verification                                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              Connection Controllers (ConnUnion)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Local      │  │     SSH      │  │     WSL      │         │
│  │              │  │ (conncontrol │  │  (wslconn)   │         │
│  │              │  │    ler)      │  │              │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│  - Connection lifecycle (init → connecting → connected)         │
│  - WSH (Wave Shell Extensions) management                       │
│  - Domain socket setup for RPC communication                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                  Shell Process Execution                         │
│                   (shellexec/shellexec.go)                      │
│  - ShellProc wrapper for running processes                       │
│  - PTY management                                                │
│  - Process lifecycle (start, wait, kill)                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              Low-Level Connection Implementation                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   os/exec    │  │golang.org/x/ │  │  pkg/wsl     │         │
│  │              │  │  crypto/ssh  │  │              │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

## Key Backend Components

### 1. Block Controllers (`pkg/blockcontroller/`)

**Primary Files:**
- `blockcontroller.go` - Controller registry and orchestration
- `shellcontroller.go` - Shell/terminal controller implementation

**Responsibilities:**
- **Controller Registry**: Maintains a global map of active block controllers (`controllerRegistry`)
- **Lifecycle Management**: Handles controller creation, starting, stopping, and switching
- **Connection Verification**: Checks connection status before starting shell processes
- **Controller Types**: Supports different controller types (shell, cmd, tsunami)

**Key Functions:**
- `ResyncController()` - Main entry point for synchronizing block state with desired controller
- `registerController()` - Registers a new controller, stopping any existing one
- `getController()` - Retrieves active controller for a block

### 2. SSH Connections (`pkg/remote/conncontroller/`)

**SSHConn Structure:**
```go
type SSHConn struct {
    Lock               *sync.Mutex
    Status             string           // Connection state
    WshEnabled         *atomic.Bool     // WSH availability flag
    Opts               *remote.SSHOpts  // Connection parameters
    Client             *ssh.Client      // Underlying SSH client
    DomainSockName     string           // Unix socket for RPC
    DomainSockListener net.Listener
    ConnController     *ssh.Session     // Runs "wsh connserver"
    Error              string
    WshError           string
    WshVersion         string
    // ...
}
```

**Key Responsibilities:**
1. **SSH Client Management**
   - Establishes SSH connections using `golang.org/x/crypto/ssh`
   - Handles authentication (pubkey, password, keyboard-interactive)
   - Supports ProxyJump for multi-hop connections

2. **Domain Socket Setup**
   - Creates Unix domain socket on remote host (`/tmp/waveterm-*.sock`)
   - Enables bidirectional RPC communication
   - Socket used by both connserver and shell processes

3. **WSH (Wave Shell Extensions) Management**
   - **Version Check**: Runs `wsh version` to check installation
   - **Installation**: Copies appropriate WSH binary to remote
   - **Update**: Updates existing WSH installation
   - **User Prompts**: Asks user for install permission

**Connection Flow:**
```
1. GetConn(opts) - Retrieve or create connection
2. Connect(ctx) - Initiate connection
3. CheckIfNeedsAuth() - Verify authentication needed
4. OpenDomainSocketListener() - Set up RPC channel
5. StartConnServer() - Launch wsh connserver
6. (Install/Update WSH if needed)
7. Status: Connected - Ready for shell processes
```

### 3. WSL Connections (`pkg/wslconn/`)

Similar to SSH but:
- **No Network Socket**: WSL processes run locally
- **Domain Socket Path**: Uses predetermined path
- **Command Execution**: Uses `wsl.exe` command-line tool
- **Simpler Authentication**: No auth needed

Connection naming: `wsl://[distro-name]` (e.g., `wsl://Ubuntu`)

### 4. Shell Process Execution (`pkg/shellexec/`)

**ShellProc Structure:**
```go
type ShellProc struct {
    ConnName  string          // Connection identifier
    Cmd       ConnInterface   // Actual process interface
    CloseOnce *sync.Once      // Ensures single close
    DoneCh    chan any        // Signals process completion
    WaitErr   error           // Process exit status
}
```

**Process Startup Functions:**
- `StartLocalShellProc()` - Local shell processes
- `StartRemoteShellProc()` - SSH remote shells (with WSH)
- `StartRemoteShellProcNoWsh()` - SSH remote shells (no WSH)
- `StartWslShellProc()` - WSL shells (with WSH)
- `StartWslShellProcNoWsh()` - WSL shells (no WSH)

### 5. Generic Connection Interface (`pkg/genconn/`)

Provides abstraction layer for running commands across different connection types.

**Interface Hierarchy:**
```go
ShellClient -> ShellProcessController
```

## Frontend Connection Architecture

The frontend connection architecture provides a reactive interface for managing and interacting with connections.

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Interface                            │
│  - ConnectionButton (displays status)                           │
│  - ChangeConnectionBlockModal (connection picker)               │
│  - ConnStatusOverlay (error states)                             │
└─────────────────────────────────────────────────────────────────┘
                               ↕
┌─────────────────────────────────────────────────────────────────┐
│                      Jotai Reactive State                        │
│  - ConnStatusMapAtom (connection statuses)                      │
│  - View Model Atoms (derived connection state)                  │
│  - Block Metadata (connection selection)                        │
└─────────────────────────────────────────────────────────────────┘
                               ↕
┌─────────────────────────────────────────────────────────────────┐
│                         RPC Commands                             │
│  - ConnListCommand (list connections)                           │
│  - ConnEnsureCommand (ensure connected)                         │
│  - ConnConnectCommand/ConnDisconnectCommand                     │
│  - SetMetaCommand (change block connection)                     │
│  - ControllerInputCommand (send data to shell)                  │
└─────────────────────────────────────────────────────────────────┘
```

## Frontend Connection State Management

**ConnStatusMapAtom:**
```typescript
const ConnStatusMapAtom = atom(new Map<string, PrimitiveAtom<ConnStatus>>())
```

- Global registry of connection status atoms
- One atom per connection (keyed by connection name)
- Backend updates status via wave events
- Frontend components subscribe to individual connection atoms

**getConnStatusAtom():**
```typescript
function getConnStatusAtom(connName: string): PrimitiveAtom<ConnStatus>
```

- Retrieves or creates status atom for a connection
- Returns cached atom if exists
- Creates new atom initialized to default if needed

**ConnStatus Structure:**
```typescript
interface ConnStatus {
    status: "init" | "connecting" | "connected" | "disconnected" | "error"
    connection: string           // Connection name
    connected: boolean           // Is currently connected
    activeconnnum: number        // Color assignment number (1-8)
    wshenabled: boolean         // WSH available on this connection
    error?: string              // Error message if status is "error"
    wsherror?: string           // WSH-specific error
}
```

## Connection Types and Behaviors

### Local Connection

**Connection Names:**
- `""` (empty string)
- `"local"`
- `"local:"`
- `"local:gitbash"` (Windows only)

**Frontend Behavior:**
- No connection modal interaction needed
- ConnectionButton shows laptop icon (grey)
- No ConnStatusOverlay shown (always "connected")
- File paths used directly without connection prefix

### SSH Connection

**Connection Names:**
- Format: `"user@host"`, `"user@host:port"`, or config name
- Examples: `"ubuntu@192.168.1.10"`, `"myserver"`, `"deploy@prod:2222"`

**Frontend Behavior:**
- ConnectionButton shows arrow icon with color
- Color cycles through 8 colors based on `activeconnnum`
- ConnStatusOverlay shown during connecting/error states
- File paths prefixed with connection: `user@host:~/file.txt`

### WSL Connection

**Connection Names:**
- Format: `"wsl://[distro]"`
- Examples: `"wsl://Ubuntu"`, `"wsl://Debian"`

**Frontend Behavior:**
- Similar to SSH (colored arrow icon)
- Listed under "Local" section in modal
- No authentication prompts
- File paths: `wsl://Ubuntu:~/file.txt`

### S3 Connection (Preview Only)

**Connection Names:**
- Format: `"aws:[profile]"`
- Only available in Preview view
- No shell/terminal support
- File paths: `aws:profile:/bucket/key`

## Connection Selection Modal

**ChangeConnectionBlockModal Component** (`frontend/app/modals/conntypeahead.tsx`)

**Data Fetching:**
```typescript
useEffect(() => {
    if (!changeConnModalOpen) return;

    RpcApi.ConnListCommand(TabRpcClient, { timeout: 2000 }).then(setConnList);
    RpcApi.WslListCommand(TabRpcClient, { timeout: 2000 }).then(setWslList);
    RpcApi.ConnListAWSCommand(TabRpcClient, { timeout: 2000 }).then(setS3List);
}, [changeConnModalOpen]);
```

**Connection Change Handler:**
```typescript
const changeConnection = async (connName: string) => {
    await RpcApi.SetMetaCommand(TabRpcClient, {
        oref: WOS.makeORef("block", blockId),
        meta: {
            connection: connName,
            file: newFile,        // Reset file path for new connection
            "cmd:cwd": null      // Clear working directory
        }
    });

    await RpcApi.ConnEnsureCommand(TabRpcClient, {
        connname: connName,
        logblockid: blockId
    }, { timeout: 60000 });
};
```

## RPC Interface

### Connection Management Commands

**ConnListCommand** - Returns list of configured SSH connection names
**WslListCommand** - Returns list of installed WSL distribution names (Windows only)
**ConnListAWSCommand** - Returns list of AWS profile names from config
**ConnEnsureCommand** - Ensures connection is in "connected" state, triggers connection if not
**ConnConnectCommand** - Explicitly connects to specified connection
**ConnDisconnectCommand** - Disconnects active connection

### File Operations (Connection-Aware)

**FileInfoCommand** - Gets file metadata (size, type, permissions, etc.)
- Path format: `[connName]:[filepath]` (e.g., `user@host:~/file.txt`)

**FileReadCommand** - Reads file content as base64
- Supports streaming for large files
- Remote files read via connection's WSH

### Controller Commands

**ControllerInputCommand** - Sends input to block's controller (shell)
- Base64-encoded to handle binary data

**ControllerRestartCommand** - Restarts block's controller

## Event-Driven Updates

### Wave Event Subscriptions

**Connection Status Updates:**
```typescript
waveEventSubscribe({
    eventType: "connstatus",
    handler: (event) => {
        const status: ConnStatus = event.data;
        updateConnStatusAtom(status.connection, status);
    }
});
```

**Configuration Updates:**
```typescript
waveEventSubscribe({
    eventType: "config",
    handler: (event) => {
        const fullConfig = event.data.fullconfig;
        globalStore.set(atoms.fullConfigAtom, fullConfig);
    }
});
```

## Hierarchical Configuration System

Wave uses a three-level config hierarchy for connections:

1. **Global Settings** (`settings`)
2. **Connection-Level Config** (`connections[connName]`)
3. **Block-Level Overrides** (`block.meta`)

**Override Resolution:**
```typescript
function getOverrideConfigAtom<T>(blockId: string, key: T): Atom<T> {
    return atom((get) => {
        // 1. Check block metadata
        const metaKeyVal = get(getBlockMetaKeyAtom(blockId, key));
        if (metaKeyVal != null) return metaKeyVal;

        // 2. Check connection config
        const connName = get(getBlockMetaKeyAtom(blockId, "connection"));
        const connConfigKeyVal = get(getConnConfigKeyAtom(connName, key));
        if (connConfigKeyVal != null) return connConfigKeyVal;

        // 3. Fall back to global settings
        const settingsVal = get(getSettingsKeyAtom(key));
        return settingsVal ?? null;
    });
}
```

### Common Connection Settings

- `conn:wshenabled` - Enable/disable WSH for this connection
- `conn:wshpath` - Custom WSH binary path
- `display:hidden` - Hide connection from selector
- `display:order` - Sort order in connection list
- `term:fontsize` - Font size for terminals on this connection
- `term:theme` - Color theme for terminals on this connection

## Error Handling

### Connection Errors
- **Authentication Failures**: Backend prompts for credentials via `userinput` events
- **Network Errors**: ConnStatus.status becomes "error"
- **WSH Installation Errors**: ConnStatus.wsherror contains message

### Recovery Mechanisms
- `conn.Reconnect(ctx)` - Close and re-establish connection
- `conn.WaitForConnect(ctx)` - Block until connected
- Automatic fallback to no-WSH mode on installation failure

## View Model Integration

View models integrate connection state into their reactive data flow:

```typescript
class TermViewModel implements ViewModel {
    manageConnection = atom((get) => {
        const termMode = get(this.termMode);
        if (termMode == "vdom") return false;

        const isCmd = get(this.isCmdController);
        if (isCmd) return false;

        return true;
    });

    connStatus = atom((get) => {
        const blockData = get(this.blockAtom);
        const connName = blockData?.meta?.connection;
        const connAtom = getConnStatusAtom(connName);
        return get(connAtom);
    });
}
```

## Thread Safety

**SSHConn/WslConn:**
```go
conn.Lock.Lock()
defer conn.Lock.Unlock()
// ... modify connection state
```

**Atomic Flags:**
```go
conn.WshEnabled.Load()    // Read WSH enabled status
conn.WshEnabled.Store(v)  // Update atomically
```

**Controller Registry:**
```go
registryLock.RLock()       // Read lock for lookups
registryLock.Lock()        // Write lock for modifications
```

## Summary

The connection architecture provides:
- **Layered Architecture**: Clear separation between block management, connection management, and process execution
- **Connection Abstraction**: ConnUnion pattern allows uniform handling of Local/SSH/WSL
- **WSH Optional**: System works with and without Wave Shell Extensions
- **Thread Safety**: Defensive locking, atomic flags prevent race conditions
- **Error Recovery**: Multiple retry mechanisms, fallback modes
- **Configuration Hierarchy**: Global → Connection-Specific → Runtime overrides
- **Event-Driven Updates**: Real-time status updates via pub/sub system