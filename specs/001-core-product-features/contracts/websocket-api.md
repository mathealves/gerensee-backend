# WebSocket API Contract

**Version**: 1.0.0  
**Protocol**: Socket.io  
**Base URL**: `ws://localhost:3000` (dev) / `wss://api.gerensee.com` (prod)

## Overview

Real-time updates for Kanban boards and document editing using Socket.io over WebSocket. Clients authenticate via JWT token in handshake.

---

## Connection

### Authentication

```typescript
// Client connects with JWT token
const socket = io('ws://localhost:3000', {
  auth: {
    token: 'Bearer <JWT_TOKEN>'
  }
});
```

### Connection Events

#### `connect`
Emitted when connection established.

**Client receives**:
```typescript
socket.on('connect', () => {
  console.log('Connected:', socket.id);
});
```

#### `disconnect`
Emitted when connection closed.

**Client receives**:
```typescript
socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});
```

#### `error`
Emitted on authentication or other errors.

**Client receives**:
```typescript
socket.on('error', (error) => {
  // error: { message: string, code: string }
});
```

**Error codes**:
- `AUTH_FAILED`: Invalid or expired JWT token
- `FORBIDDEN`: User lacks project access
- `INTERNAL_ERROR`: Server error

---

## Board Updates (Real-time Kanban)

### Room Subscription

Clients join project-specific rooms to receive board updates.

#### `joinBoard`

**Client emits**:
```typescript
socket.emit('joinBoard', { projectId: 'clx123...' });
```

**Server validates**:
- User is authenticated
- User is ProjectMember of specified project
- User's organization matches project's organization

**Server response**:
```typescript
// On success
socket.on('boardJoined', (data) => {
  // data: { projectId: string, message: string }
});

// On failure
socket.on('error', (error) => {
  // error: { message: 'Not a member of this project', code: 'FORBIDDEN' }
});
```

#### `leaveBoard`

**Client emits**:
```typescript
socket.emit('leaveBoard', { projectId: 'clx123...' });
```

**Server response**:
```typescript
socket.on('boardLeft', (data) => {
  // data: { projectId: string }
});
```

---

### Board Events (Server → Client)

All events are sent only to users in the specific board room (`board:${projectId}`).

#### `taskCreated`

Emitted when a new task is created.

**Payload**:
```typescript
{
  event: 'taskCreated',
  data: {
    projectId: string,
    task: {
      id: string,
      title: string,
      description: string | null,
      priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',
      dueDate: string | null,
      statusId: string,
      createdById: string,
      createdAt: string
    }
  }
}
```

**Client handler**:
```typescript
socket.on('taskCreated', (data) => {
  // Add task to board UI in appropriate column
});
```

---

#### `taskUpdated`

Emitted when task is updated (moved between columns, edited, etc.).

**Payload**:
```typescript
{
  event: 'taskUpdated',
  data: {
    projectId: string,
    task: {
      id: string,
      title: string,
      description: string | null,
      priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',
      dueDate: string | null,
      statusId: string,  // May have changed (task moved)
      updatedAt: string,
      updatedBy: {
        id: string,
        name: string
      }
    }
  }
}
```

**Client handler**:
```typescript
socket.on('taskUpdated', (data) => {
  // Update task in board UI
  // If statusId changed, move task to new column
});
```

---

#### `taskDeleted`

Emitted when task is deleted.

**Payload**:
```typescript
{
  event: 'taskDeleted',
  data: {
    projectId: string,
    taskId: string,
    deletedBy: {
      id: string,
      name: string
    }
  }
}
```

**Client handler**:
```typescript
socket.on('taskDeleted', (data) => {
  // Remove task from board UI
});
```

---

#### `taskAssigned`

Emitted when user is assigned to task.

**Payload**:
```typescript
{
  event: 'taskAssigned',
  data: {
    projectId: string,
    taskId: string,
    assignment: {
      id: string,
      userId: string,
      user: {
        id: string,
        name: string,
        email: string
      },
      assignedById: string,
      assignedAt: string
    }
  }
}
```

---

#### `taskUnassigned`

Emitted when user is unassigned from task.

**Payload**:
```typescript
{
  event: 'taskUnassigned',
  data: {
    projectId: string,
    taskId: string,
    userId: string
  }
}
```

---

#### `statusCreated`

Emitted when new task status/column is added to board.

**Payload**:
```typescript
{
  event: 'statusCreated',
  data: {
    projectId: string,
    status: {
      id: string,
      name: string,
      position: number,
      color: string | null
    }
  }
}
```

---

#### `statusUpdated`

Emitted when status is renamed, reordered, or color changed.

**Payload**:
```typescript
{
  event: 'statusUpdated',
  data: {
    projectId: string,
    status: {
      id: string,
      name: string,
      position: number,
      color: string | null
    }
  }
}
```

**Note**: Position changes may require re-rendering column order.

---

#### `statusDeleted`

Emitted when status/column is deleted.

**Payload**:
```typescript
{
  event: 'statusDeleted',
  data: {
    projectId: string,
    statusId: string
  }
}
```

---

## Document Locking Updates

### Room Subscription

Clients viewing a document join document-specific rooms.

#### `joinDocument`

**Client emits**:
```typescript
socket.emit('joinDocument', { documentId: 'clx123...' });
```

**Server validates**:
- User is authenticated
- User is ProjectMember of document's project

**Server response**:
```typescript
socket.on('documentJoined', (data) => {
  // data: { documentId: string, currentLock: DocumentLock | null }
});
```

#### `leaveDocument`

**Client emits**:
```typescript
socket.emit('leaveDocument', { documentId: 'clx123...' });
```

---

### Document Events (Server → Client)

All events sent to users in document room (`document:${documentId}`).

#### `documentLocked`

Emitted when user acquires edit lock.

**Payload**:
```typescript
{
  event: 'documentLocked',
  data: {
    documentId: string,
    lock: {
      id: string,
      userId: string,
      user: {
        id: string,
        name: string,
        email: string
      },
      lockedAt: string,
      expiresAt: string
    }
  }
}
```

**Client handler**:
```typescript
socket.on('documentLocked', (data) => {
  // Show "Locked by [user.name]" banner
  // Disable editor if locked by someone else
});
```

---

#### `documentUnlocked`

Emitted when lock is released (manual unlock or timeout).

**Payload**:
```typescript
{
  event: 'documentUnlocked',
  data: {
    documentId: string,
    unlockedBy: string | null,  // null if timeout expiry
    unlockedAt: string
  }
}
```

**Client handler**:
```typescript
socket.on('documentUnlocked', (data) => {
  // Remove lock banner
  // Enable "Lock for editing" button
});
```

---

#### `documentUpdated`

Emitted when document content is saved (not real-time collaborative editing).

**Payload**:
```typescript
{
  event: 'documentUpdated',
  data: {
    documentId: string,
    updatedBy: {
      id: string,
      name: string
    },
    updatedAt: string
  }
}
```

**Client handler**:
```typescript
socket.on('documentUpdated', (data) => {
  // Show "Document updated by [user]" notification
  // Optionally refresh content if not currently editing
});
```

---

#### `lockExpiring`

Emitted 2 minutes before lock expires (warning to extend).

**Payload**:
```typescript
{
  event: 'lockExpiring',
  data: {
    documentId: string,
    expiresAt: string,
    remainingSeconds: number
  }
}
```

**Client handler**:
```typescript
socket.on('lockExpiring', (data) => {
  // Show warning: "Lock expires in 2 minutes. Extend?"
  // Offer button to call PATCH /documents/{id}/lock
});
```

---

## Performance Requirements

Per **SC-002**: Board updates must be reflected within **2 seconds**.

**Implementation Notes**:
- WebSocket events are emitted synchronously after database writes
- No queuing or batching of real-time events
- Server measures latency: `emitTime - mutationTime < 100ms`

---

## Error Handling

### Client-Side Reconnection

```typescript
socket.on('disconnect', (reason) => {
  if (reason === 'io server disconnect') {
    // Server disconnected client, do not reconnect
  } else {
    // Network issue, auto-reconnect
    socket.connect();
  }
});

socket.on('reconnect', () => {
  // Re-join boards/documents
  socket.emit('joinBoard', { projectId: currentProjectId });
});
```

### Server-Side Validation

All emitted events validated:
- JWT token valid and not expired
- User has membership in relevant organization
- User is ProjectMember for project-scoped events

**Invalid events are silently dropped** (no broadcast to malicious clients).

---

## Testing

### Example Client (for testing)

```typescript
import { io } from 'socket.io-client';

const socket = io('ws://localhost:3000', {
  auth: { token: 'Bearer eyJhbGc...' }
});

socket.on('connect', () => {
  console.log('✅ Connected');
  
  // Join board
  socket.emit('joinBoard', { projectId: 'clx123' });
});

socket.on('boardJoined', ({ projectId }) => {
  console.log('✅ Joined board:', projectId);
});

socket.on('taskUpdated', ({ task }) => {
  console.log('📝 Task updated:', task.title);
});

socket.on('error', (error) => {
  console.error('❌ Error:', error);
});
```

---

## Security Considerations

1. **Authentication**: All connections require valid JWT token
2. **Authorization**: Users can only join boards/documents they have access to
3. **Multi-tenancy**: Events filtered by organization context
4. **Rate Limiting**: Max 100 events/minute per client (prevents spam)
5. **Validation**: All payloads validated before broadcast

---

**WebSocket Contract Complete**: Ready for client and server implementation.
