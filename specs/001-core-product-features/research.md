# Research: Core Product Features

**Phase**: 0 (Outline & Research)  
**Date**: 2026-01-31  
**Feature**: [spec.md](spec.md)

## Overview

This document consolidates research findings for implementing the core Gerensee platform features, focusing on multi-tenant architecture, RBAC patterns, real-time updates for Kanban boards, and document locking mechanisms.

---

## 1. Multi-Tenancy Architecture with Prisma

### Decision
Implement **Row-Level Multi-Tenancy** using organization_id foreign keys on all tenant-scoped tables, enforced via Prisma middleware for automatic query scoping.

### Rationale
- **Data Isolation**: Each organization's data is completely isolated at the database level
- **Scalability**: Single database instance sufficient for initial scale (~100 orgs, ~1000 users)
- **Simplicity**: Aligns with Constitution Principle VI (start simple, evolve as needed)
- **Prisma Support**: Middleware allows automatic injection of WHERE clauses for all queries

### Implementation Pattern
```typescript
// Prisma middleware to enforce organization scoping
prisma.$use(async (params, next) => {
  if (params.model && isTenantModel(params.model)) {
    if (params.action === 'findMany' || params.action === 'findFirst') {
      params.args.where = {
        ...params.args.where,
        organizationId: currentOrganizationId
      };
    }
  }
  return next(params);
});
```

### Alternatives Considered
- **Schema-per-tenant**: Rejected due to complexity and migration overhead
- **Database-per-tenant**: Rejected as over-engineering for current scale
- **Discriminator column only**: Rejected as insufficient isolation (could leak data via bugs)

### Best Practices
- Always retrieve organizationId from authenticated JWT token context
- Never accept organizationId from client requests
- Use database foreign key constraints to enforce referential integrity
- Implement fail-safe: queries without org context should throw errors

---

## 2. Role-Based Access Control (RBAC)

### Decision
Implement **Enum-Based RBAC** with three roles (OWNER, ADMIN, MEMBER) stored on Member entity, enforced at service layer with NestJS Guards as secondary defense.

### Rationale
- **Domain-First**: Aligns with Constitution Principle IV (authorization is domain concern)
- **Explicit**: Clear role definitions match business requirements (FR-010)
- **Enforceable**: Guards prevent controller execution, services enforce business rules

### Implementation Pattern
```typescript
// Domain service enforcement
class ProjectsService {
  async addMember(user: User, projectId: string, memberToAdd: User) {
    const membership = await this.getMembership(user, projectId);
    
    if (membership.role === 'MEMBER') {
      throw new ForbiddenException('Members cannot add other members');
    }
    
    // Proceed with business logic...
  }
}

// Guard as secondary defense
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'OWNER')
async addMemberEndpoint() { }
```

### Alternatives Considered
- **Permission-based system**: Rejected as over-engineering for 3 simple roles
- **Controller-only guards**: Rejected - violates Constitution (not domain-enforced)
- **Casbin/external authz**: Rejected as unnecessary complexity for initial MVP

### Best Practices
- Store role on Member entity (organization membership) and ProjectMember (project membership)
- Organization-level roles: OWNER (1 per org), ADMIN (many), MEMBER (many)
- Project-level access: Implicit via ProjectMember entity
- Always check organization role before project operations

---

## 3. Real-Time Kanban Board Updates

### Decision
Implement **WebSocket-based updates** using NestJS WebSocket Gateway (Socket.io) with room-based subscriptions per project board.

### Rationale
- **Performance**: Meets SC-002 requirement (2-second reflection of updates)
- **Efficient**: Only users viewing a board receive updates (room-based)
- **NestJS Integration**: Native support via @nestjs/websockets
- **Fallback**: Can degrade to polling if WebSocket unavailable

### Implementation Pattern
```typescript
@WebSocketGateway()
export class BoardGateway {
  @SubscribeMessage('joinBoard')
  handleJoinBoard(client: Socket, projectId: string) {
    client.join(`board:${projectId}`);
  }
  
  // Called from TasksService after task update
  notifyBoardUpdate(projectId: string, taskUpdate: TaskDto) {
    this.server.to(`board:${projectId}`).emit('taskUpdated', taskUpdate);
  }
}
```

### Alternatives Considered
- **Server-Sent Events (SSE)**: Rejected as one-way (can't send client actions)
- **Polling**: Rejected as inefficient and may not meet 2s requirement
- **GraphQL Subscriptions**: Rejected as unnecessary (not using GraphQL)

### Best Practices
- Authenticate WebSocket connections via JWT in handshake
- Verify project membership before allowing room join
- Emit fine-grained events (taskMoved, taskCreated) not full board state
- Implement reconnection logic on client side

---

## 4. Document Locking Mechanism

### Decision
Implement **Explicit Lock-Based Concurrency Control** with timeout (15 minutes) and manual unlock, using DocumentLock table tracking user_id, document_id, locked_at, expires_at.

### Rationale
- **Requirement**: FR-009.1 mandates explicit check-out/locking
- **Data Integrity**: Prevents conflicts on rich text documents
- **User Awareness**: Clear UX when document is locked by another user
- **Timeout Safety**: Auto-unlock after 15 min prevents permanent locks

### Implementation Pattern
```typescript
// DocumentsService
async lockDocument(userId: string, documentId: string): Promise<void> {
  const existingLock = await this.findActiveLock(documentId);
  
  if (existingLock && existingLock.userId !== userId) {
    if (existingLock.expiresAt > new Date()) {
      throw new ConflictException(`Document locked by ${existingLock.user.name}`);
    }
    // Lock expired, remove it
    await this.removeLock(existingLock.id);
  }
  
  await this.createLock(userId, documentId, expiresAt: addMinutes(now, 15));
}
```

### Alternatives Considered
- **Operational Transform (OT)**: Rejected as complex and not required by spec
- **CRDT-based**: Rejected as over-engineering for MVP
- **Last-write-wins**: Rejected - violates explicit locking requirement

### Best Practices
- Store DocumentLock as separate entity for audit trail
- Clean up expired locks via cron job (every 5 minutes)
- Allow lock owner to manually unlock (edit complete) or extend timeout
- Emit WebSocket event when document locked/unlocked for real-time UX

---

## 5. Rich Text Document Storage

### Decision
Store rich text content as **JSON (Tiptap/ProseMirror format)** in PostgreSQL JSONB column, rendered in frontend via Tiptap editor.

### Rationale
- **Flexibility**: JSONB allows structured content with formatting metadata
- **Query Support**: Can query document structure if needed (future search feature)
- **Editor Support**: Tiptap is modern, extensible, and well-maintained
- **PostgreSQL Native**: JSONB is first-class type with indexing support

### Implementation Pattern
```typescript
// Prisma schema
model Document {
  id             String   @id @default(cuid())
  title          String
  content        Json     @db.JsonB  // Tiptap JSON structure
  organizationId String
  projectId      String
  // ...
}
```

### Alternatives Considered
- **HTML Storage**: Rejected due to XSS risks and parsing complexity
- **Markdown**: Rejected as insufficient for WYSIWYG requirement
- **Plain Text**: Rejected - doesn't meet rich text requirement

### Best Practices
- Validate JSON structure on API layer before persisting
- Sanitize HTML output on frontend (Tiptap handles this)
- Version document changes for future audit/history feature
- Consider compression for large documents (future optimization)

---

## 6. Task Priority and Due Date Handling

### Decision
Implement **Priority as Enum** (LOW, MEDIUM, HIGH, URGENT) and **DueDate as DateTime** field with optional values.

### Rationale
- **Requirement**: FR-006 mandates priority and due date
- **Simple**: Enum prevents invalid values, nullable DateTime allows optional
- **Sortable**: Can order tasks by priority or due date on board

### Implementation Pattern
```typescript
enum TaskPriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

model Task {
  priority  TaskPriority @default(MEDIUM)
  dueDate   DateTime?
  // ...
}
```

### Best Practices
- Default priority to MEDIUM for new tasks
- Allow null due dates (not all tasks have deadlines)
- Visual indicators on Kanban board (color-coded priority, due date badges)
- Sort tasks within column by priority then due date

---

## 7. Custom Task Status (Kanban Columns)

### Decision
Implement **Project-scoped TaskStatus entity** with position ordering, allowing each project to define custom columns.

### Rationale
- **Requirement**: FR-008 mandates custom statuses per project
- **Flexibility**: Different projects may use different workflows
- **Ordering**: Position field allows drag-to-reorder columns

### Implementation Pattern
```typescript
model TaskStatus {
  id          String  @id @default(cuid())
  name        String  // "To Do", "In Progress", "Done"
  position    Int     // 0, 1, 2 for ordering
  color       String? // Optional hex color
  projectId   String
  project     Project @relation(fields: [projectId])
  
  @@unique([projectId, position])
}

model Task {
  statusId    String
  status      TaskStatus @relation(fields: [statusId])
}
```

### Best Practices
- Create default statuses on project creation: "To Do" (0), "In Progress" (1), "Done" (2)
- Allow admins to add/remove/reorder statuses
- When deleting status, require moving tasks to another status first
- Enforce unique position per project

---

## 8. Organization Ownership Constraints

### Decision
Enforce **one OWNER per Organization** via database unique constraint and **one organization ownership per User** via application logic.

### Rationale
- **Constitution**: Principle III mandates explicit ownership rules
- **Business Rule**: Prevents ambiguous ownership scenarios
- **Enforcement**: Database prevents multiple owners, service prevents user owning multiple orgs

### Implementation Pattern
```typescript
model Member {
  id             String   @id @default(cuid())
  userId         String
  organizationId String
  role           MemberRole
  
  @@unique([organizationId, role]) // where role == OWNER
  @@unique([userId, organizationId])
}

// Service layer
async createOrganization(userId: string, name: string) {
  const existingOwnership = await this.findOwnershipByUser(userId);
  if (existingOwnership) {
    throw new ConflictException('User already owns an organization');
  }
  // Create organization and set user as OWNER
}
```

### Best Practices
- Use database partial unique index: `WHERE role = 'OWNER'` (PostgreSQL supports this)
- Transfer ownership requires current OWNER approval
- Deleting organization requires being OWNER
- OWNER cannot be removed from organization (must transfer first)

---

## Summary of Technology Choices

| Concern | Technology/Pattern | Rationale |
|---------|-------------------|-----------|
| Backend Framework | NestJS | TypeScript, modular, extensive ecosystem |
| ORM | Prisma | Type-safe, migration support, excellent DX |
| Database | PostgreSQL | JSONB support, multi-tenancy, reliability |
| Authentication | JWT (jsonwebtoken) | Stateless, scalable, industry standard |
| Real-time | Socket.io (NestJS WS) | Bidirectional, room-based, fallback support |
| Rich Text Storage | JSONB (Tiptap format) | Structured, queryable, editor-compatible |
| Authorization | RBAC (Enum-based) | Simple, domain-enforced, meets requirements |
| Multi-tenancy | Row-level with middleware | Isolated, scalable, simple implementation |
| Document Locking | Explicit lock table | Meets FR-009.1, timeout safety |
| Testing | Jest + Supertest | NestJS default, comprehensive |

---

## Open Questions for Phase 1

1. **Email Invitations**: Should invite emails be sent immediately or queued? → Recommend immediate for MVP, queue later if scale requires
2. **Document Version History**: Should we track document revisions from day 1? → Out of scope for initial MVP, can add later
3. **Task Assignment Notifications**: Should assignees receive notifications? → Out of scope for initial MVP, add in future iteration
4. **File Attachments**: Support uploading files to tasks/documents? → Not in current spec, defer to future feature

---

## 9. JWT Token Strategy

### Decision
Implement **dual-token authentication** with short-lived access tokens (15 minutes) and long-lived refresh tokens (30 days) stored in database for revocation capability.

### Rationale
- **Security**: Short access token lifetime limits damage from token theft
- **User Experience**: Refresh tokens allow seamless reauthentication without login
- **Revocation**: Database-stored refresh tokens enable logout and security breach response
- **Compliance**: Aligns with OWASP recommendations for JWT security

### Implementation Pattern

**Access Token (JWT)**:
- Lifetime: 15 minutes
- Payload: `{ sub: userId, email, organizationId, role }`
- Storage: Client memory/state (not localStorage for XSS protection)
- Validation: Signature verification only (no database lookup)

**Refresh Token**:
- Lifetime: 30 days
- Storage: Database (RefreshToken table)
- Format: Cryptographically random string (32 bytes)
- Rotation: Issue new refresh token on each use, invalidate old one
- Revocation: Delete from database on logout or security event

```typescript
// RefreshToken entity
interface RefreshToken {
  id: string;
  token: string; // hashed value stored
  userId: string;
  expiresAt: DateTime;
  createdAt: DateTime;
}

// Refresh flow
POST /auth/refresh
Body: { refreshToken: string }
Response: { accessToken: string, refreshToken: string }
```

### Security Measures
1. **Token Hashing**: Store bcrypt hash of refresh token, not plaintext
2. **Rotation**: Single-use refresh tokens (invalidate after exchange)
3. **Family Detection**: Track token lineage to detect replay attacks
4. **Device Binding**: Optional IP/User-Agent fingerprinting
5. **Cleanup**: Cron job to delete expired tokens (>30 days old)

### Alternatives Considered
- **Access-only tokens (long-lived)**: Rejected due to security risk (no revocation)
- **Session-based auth**: Rejected due to stateful nature (poor for microservices)
- **OAuth2 with external provider**: Deferred to future (adds complexity for MVP)

### Edge Cases Handled
1. **Concurrent refresh requests**: Use optimistic locking (check token not already used)
2. **Token replay after rotation**: Detect and invalidate entire token family
3. **User logout**: Delete all refresh tokens for that user
4. **Password change**: Invalidate all refresh tokens (force reauth)
5. **Suspicious activity**: Admin can revoke all tokens for a user

### Best Practices
- Never send refresh tokens in URL parameters (use HTTP-only cookies or request body)
- Log all token refresh events for audit trail
- Rate-limit refresh endpoint (max 10 requests/minute per user)
- Monitor for anomalous refresh patterns (multiple devices, rapid succession)

---

**Research Complete**: All technical unknowns resolved. Ready for Phase 1 (Design & Contracts).
