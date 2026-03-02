# Data Model: Core Product Features

**Phase**: 1 (Design & Contracts)  
**Date**: 2026-01-31  
**Feature**: [spec.md](spec.md)

## Overview

This document defines the complete data model for the Gerensee platform core features, including all entities, relationships, validation rules, and state transitions. The model enforces multi-tenancy, RBAC, and business invariants as defined in the Constitution.

---

## Entity Relationship Diagram

```
User
  |
  +--< Member >--< Organization
                    |
                    +--< Project
                           |
                           +--< TaskStatus
                           +--< Task >--< TaskAssignment
                           +--< Document >--< DocumentLock
                           +--< ProjectMember >-- User
```

---

## Entities

### 1. User

**Purpose**: Represents a person who can access the platform across multiple organizations.

**Fields**:
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | String (CUID) | PK, Required | Unique identifier |
| email | String | Unique, Required | User email for authentication |
| name | String | Required | Full name |
| passwordHash | String | Required | Bcrypt hashed password |
| createdAt | DateTime | Auto | Account creation timestamp |
| updatedAt | DateTime | Auto | Last update timestamp |

**Relationships**:
- User → Member (1:N): A user can be member of multiple organizations
- User → ProjectMember (1:N): A user can be assigned to multiple projects

**Validation Rules**:
- Email must be valid format (RFC 5322)
- Email must be unique across platform
- Name must be 2-100 characters
- Password must be minimum 8 characters (enforced pre-hash)

**Indexes**:
- Unique index on `email`

---

### 2. Organization

**Purpose**: Top-level tenant container for all organizational data.

**Fields**:
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | String (CUID) | PK, Required | Unique identifier |
| name | String | Required, Unique | Organization name |
| createdAt | DateTime | Auto | Creation timestamp |
| updatedAt | DateTime | Auto | Last update timestamp |

**Relationships**:
- Organization → Member (1:N): Organization has members
- Organization → Project (1:N): Organization contains projects

**Validation Rules**:
- Name must be 2-100 characters
- Name must be unique across platform
- Organization must have exactly one OWNER member at all times

**Invariants**:
- **CRITICAL**: Must have exactly one OWNER member (enforced at creation and transfer)
- Cannot be deleted if has projects (must archive/delete projects first)

**Indexes**:
- Unique index on `name`

---

### 3. Member

**Purpose**: Represents a user's membership in an organization with a specific role.

**Fields**:
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | String (CUID) | PK, Required | Unique identifier |
| userId | String | FK, Required | Reference to User |
| organizationId | String | FK, Required | Reference to Organization |
| role | MemberRole | Required | OWNER, ADMIN, or MEMBER |
| joinedAt | DateTime | Auto | Timestamp when added to org |

**Enums**:
```typescript
enum MemberRole {
  OWNER   // Full control, exactly one per org
  ADMIN   // Full control, can be many
  MEMBER  // Restricted access
}
```

**Relationships**:
- Member → User (N:1): Links to user account
- Member → Organization (N:1): Links to organization

**Validation Rules**:
- userId + organizationId must be unique (one membership per user per org)
- Exactly one OWNER role per organization
- User can be OWNER of at most one organization

**Invariants**:
- **CRITICAL**: Only one OWNER per organizationId (partial unique index: `WHERE role = 'OWNER'`)
- **CRITICAL**: User can own maximum one organization (service-layer check)
- OWNER cannot be removed (must transfer ownership first)

**Indexes**:
- Unique composite index on `(userId, organizationId)`
- Unique partial index on `(organizationId, role)` WHERE `role = 'OWNER'`
- Index on `organizationId` for tenant queries

**State Transitions**:
- MEMBER → ADMIN: Allowed by OWNER or ADMIN
- ADMIN → MEMBER: Allowed by OWNER or ADMIN
- OWNER → ADMIN: Only via ownership transfer
- MEMBER/ADMIN → OWNER: Only via ownership transfer

---

### 4. Project

**Purpose**: Container for tasks and documents within an organization.

**Fields**:
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | String (CUID) | PK, Required | Unique identifier |
| name | String | Required | Project name |
| description | String? | Optional | Project description |
| organizationId | String | FK, Required | Reference to Organization (tenant) |
| createdById | String | FK, Required | User who created the project |
| createdAt | DateTime | Auto | Creation timestamp |
| updatedAt | DateTime | Auto | Last update timestamp |

**Relationships**:
- Project → Organization (N:1): Belongs to one organization
- Project → User (N:1): Created by user
- Project → TaskStatus (1:N): Has custom task statuses
- Project → Task (1:N): Contains tasks
- Project → Document (1:N): Contains documents
- Project → ProjectMember (1:N): Has assigned members

**Validation Rules**:
- Name must be 2-200 characters
- Name + organizationId must be unique (project names unique within org)
- Description max 1000 characters

**Invariants**:
- **CRITICAL**: organizationId must match creator's organization membership
- Must have at least 3 TaskStatus entities (To Do, In Progress, Done) on creation
- Cannot be deleted if has tasks (must archive/delete tasks first)

**Indexes**:
- Unique composite index on `(name, organizationId)`
- Index on `organizationId` for tenant queries

**Default Behavior on Creation**:
```typescript
// Auto-create default task statuses
TaskStatus[] = [
  { name: "To Do", position: 0, projectId },
  { name: "In Progress", position: 1, projectId },
  { name: "Done", position: 2, projectId }
]
```

---

### 5. ProjectMember

**Purpose**: Links users to projects they can access (implicit team membership).

**Fields**:
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | String (CUID) | PK, Required | Unique identifier |
| projectId | String | FK, Required | Reference to Project |
| userId | String | FK, Required | Reference to User |
| addedAt | DateTime | Auto | When added to project |

**Relationships**:
- ProjectMember → Project (N:1): Belongs to project
- ProjectMember → User (N:1): Links to user

**Validation Rules**:
- userId + projectId must be unique
- User must be member of project's organization (validated at service layer)

**Invariants**:
- **CRITICAL**: User must have Member record in project's organization
- Project creator is automatically added as ProjectMember

**Indexes**:
- Unique composite index on `(userId, projectId)`
- Index on `projectId` for project queries

---

### 6. TaskStatus

**Purpose**: Defines custom Kanban columns for a project.

**Fields**:
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | String (CUID) | PK, Required | Unique identifier |
| name | String | Required | Status name (e.g., "In Review") |
| position | Int | Required | Order position (0, 1, 2...) |
| color | String? | Optional | Hex color code (#RRGGBB) |
| projectId | String | FK, Required | Reference to Project |
| createdAt | DateTime | Auto | Creation timestamp |

**Relationships**:
- TaskStatus → Project (N:1): Belongs to one project
- TaskStatus → Task (1:N): Tasks reference this status

**Validation Rules**:
- Name must be 1-50 characters
- Position must be >= 0
- projectId + position must be unique
- Color must be valid hex format if provided

**Invariants**:
- Position must be unique within project
- Cannot delete status if tasks reference it (must move tasks first)
- Must maintain sequential positions (0, 1, 2... no gaps)

**Indexes**:
- Unique composite index on `(projectId, position)`
- Index on `projectId`

**State Transitions**:
- Position can be updated to reorder columns
- Name and color can be updated freely
- Deletion requires no tasks in this status

---

### 7. Task

**Purpose**: Represents a unit of work in a project.

**Fields**:
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | String (CUID) | PK, Required | Unique identifier |
| title | String | Required | Task title |
| description | String? | Optional | Detailed description |
| priority | TaskPriority | Required, Default: MEDIUM | Task priority |
| dueDate | DateTime? | Optional | Due date |
| statusId | String | FK, Required | Current TaskStatus |
| projectId | String | FK, Required | Reference to Project |
| organizationId | String | FK, Required | Reference to Organization (denormalized for queries) |
| createdById | String | FK, Required | User who created |
| createdAt | DateTime | Auto | Creation timestamp |
| updatedAt | DateTime | Auto | Last update timestamp |

**Enums**:
```typescript
enum TaskPriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}
```

**Relationships**:
- Task → Project (N:1): Belongs to project
- Task → Organization (N:1): Denormalized for multi-tenant queries
- Task → TaskStatus (N:1): Current status
- Task → User (N:1): Created by
- Task → TaskAssignment (1:N): Assigned users

**Validation Rules**:
- Title must be 1-500 characters
- Description max 5000 characters
- Priority must be valid enum value
- statusId must reference TaskStatus in same project

**Invariants**:
- **CRITICAL**: organizationId must match project's organizationId (enforced at creation)
- TaskStatus must belong to same project
- Creator must be ProjectMember

**Indexes**:
- Index on `projectId`
- Index on `organizationId` for tenant queries
- Index on `statusId` for board queries
- Composite index on `(projectId, statusId)` for board views
- Index on `dueDate` for sorting

---

### 8. TaskAssignment

**Purpose**: Links tasks to assigned users (many-to-many relationship).

**Fields**:
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | String (CUID) | PK, Required | Unique identifier |
| taskId | String | FK, Required | Reference to Task |
| userId | String | FK, Required | Assigned user |
| assignedAt | DateTime | Auto | Assignment timestamp |
| assignedById | String | FK, Required | User who made assignment |

**Relationships**:
- TaskAssignment → Task (N:1): Belongs to task
- TaskAssignment → User (N:1): Assigned to user
- TaskAssignment → User (N:1): Assigned by user

**Validation Rules**:
- taskId + userId must be unique (can't assign same user twice)
- Assigned user must be ProjectMember of task's project

**Invariants**:
- **CRITICAL**: Assigned user must be in task's project (validated at service layer)
- Assigner must be in task's project

**Indexes**:
- Unique composite index on `(taskId, userId)`
- Index on `userId` for "my tasks" queries
- Index on `taskId`

---

### 9. Document

**Purpose**: Rich text document within a project.

**Fields**:
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | String (CUID) | PK, Required | Unique identifier |
| title | String | Required | Document title |
| content | Json (JSONB) | Required | Tiptap/ProseMirror JSON |
| projectId | String | FK, Required | Reference to Project |
| organizationId | String | FK, Required | Reference to Organization (denormalized) |
| createdById | String | FK, Required | User who created |
| createdAt | DateTime | Auto | Creation timestamp |
| updatedAt | DateTime | Auto | Last edit timestamp |

**Relationships**:
- Document → Project (N:1): Belongs to project
- Document → Organization (N:1): Denormalized for queries
- Document → User (N:1): Created by
- Document → DocumentLock (1:1?): Optional active lock

**Validation Rules**:
- Title must be 1-200 characters
- Content must be valid JSON (Tiptap format validated at API layer)
- Content size limit: 10MB

**Invariants**:
- **CRITICAL**: organizationId must match project's organizationId
- Creator must be ProjectMember
- Content must not be null (can be empty JSON structure)

**Indexes**:
- Index on `projectId`
- Index on `organizationId` for tenant queries
- GIN index on `content` for future full-text search

**State Transitions**:
- Content can only be edited when document is locked by editing user
- Lock expires after 15 minutes of inactivity

---

### 10. DocumentLock

**Purpose**: Manages exclusive edit locks on documents.

**Fields**:
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | String (CUID) | PK, Required | Unique identifier |
| documentId | String | FK, Required, Unique | Reference to Document |
| userId | String | FK, Required | User holding lock |
| lockedAt | DateTime | Auto | When lock acquired |
| expiresAt | DateTime | Required | When lock expires (lockedAt + 15min) |

**Relationships**:
- DocumentLock → Document (1:1): One active lock per document
- DocumentLock → User (N:1): Held by user

**Validation Rules**:
- documentId must be unique (only one active lock)
- expiresAt must be > lockedAt
- User must be ProjectMember of document's project

**Invariants**:
- Only one active lock per document at a time
- Lock holder must be in document's project
- Expired locks are automatically removed by cron job

**Indexes**:
- Unique index on `documentId`
- Index on `expiresAt` for cleanup queries
- Index on `userId`

**State Transitions**:
```typescript
// Lock lifecycle
NO_LOCK → LOCKED (user acquires lock)
LOCKED → NO_LOCK (user unlocks or timeout expires)
LOCKED → LOCKED (user extends lock before expiry)

// Conflict handling
if (existingLock && existingLock.userId !== requestingUserId) {
  if (existingLock.expiresAt > now) {
    throw ConflictException("Document locked by another user");
  }
  // Lock expired, allow takeover
  removeLock(existingLock);
}
```

**Cleanup Strategy**:
- Cron job runs every 5 minutes
- Deletes all DocumentLock records where `expiresAt < NOW()`

---

## Multi-Tenancy Enforcement

### Tenant-Scoped Entities
All entities except `User` are tenant-scoped via `organizationId`:

| Entity | Tenant Field | Enforcement |
|--------|--------------|-------------|
| Organization | N/A (is tenant) | N/A |
| Member | organizationId | FK constraint |
| Project | organizationId | FK constraint + middleware |
| TaskStatus | via projectId | Transitive via Project |
| Task | organizationId (denormalized) | FK + middleware |
| TaskAssignment | via taskId | Transitive via Task |
| Document | organizationId (denormalized) | FK + middleware |
| DocumentLock | via documentId | Transitive via Document |
| ProjectMember | via projectId | Transitive via Project |

### Prisma Middleware Pattern
```typescript
prisma.$use(async (params, next) => {
  const tenantModels = ['Project', 'Task', 'Document'];
  const orgId = getCurrentOrganizationId(); // From JWT context
  
  if (tenantModels.includes(params.model)) {
    if (['findMany', 'findFirst', 'findUnique'].includes(params.action)) {
      params.args.where = {
        ...params.args.where,
        organizationId: orgId
      };
    }
    
    if (['create', 'update'].includes(params.action)) {
      params.args.data = {
        ...params.args.data,
        organizationId: orgId
      };
    }
  }
  
  return next(params);
});
```

---

## Referential Integrity & Cascades

### Cascade Delete Rules

```prisma
// Organization deleted → cascade delete all related data
Organization {
  members      Member[]     @relation(onDelete: Cascade)
  projects     Project[]    @relation(onDelete: Cascade)
}

// Project deleted → cascade delete tasks, docs, statuses
Project {
  tasks        Task[]          @relation(onDelete: Cascade)
  documents    Document[]      @relation(onDelete: Cascade)
  statuses     TaskStatus[]    @relation(onDelete: Cascade)
  members      ProjectMember[] @relation(onDelete: Cascade)
}

// Task deleted → cascade delete assignments
Task {
  assignments  TaskAssignment[] @relation(onDelete: Cascade)
}

// Document deleted → cascade delete lock
Document {
  lock         DocumentLock?    @relation(onDelete: Cascade)
}

// User deleted → restrict (must remove from orgs first)
User {
  members      Member[]         @relation(onDelete: Restrict)
  projectMembers ProjectMember[] @relation(onDelete: Restrict)
}
```

**Rationale**: 
- Organization deletion is destructive (requires explicit confirmation)
- Project deletion removes all contained data
- User deletion is restricted to prevent orphaned memberships

---

## Validation Summary

### Database-Level Constraints
- Foreign key constraints on all relationships
- Unique constraints on composite keys
- Partial unique index for OWNER role
- NOT NULL constraints on required fields
- Check constraints on enums (via Prisma)

### Service-Level Validation
- User can own max one organization
- User must be org member before project assignment
- Task assignees must be project members
- Document editors must lock document first
- RBAC checks before mutations

### API-Level Validation (DTOs)
- Email format validation
- String length constraints
- JSON structure validation (Tiptap documents)
- Date range validation
- Enum value validation

---

## Performance Considerations

### Denormalized Fields
- `Task.organizationId`: Enables fast tenant-scoped queries without JOIN
- `Document.organizationId`: Same rationale

### Composite Indexes
```sql
-- Kanban board query optimization
CREATE INDEX idx_task_board ON Task(projectId, statusId);

-- User's organizations
CREATE INDEX idx_member_user ON Member(userId);

-- Tenant queries
CREATE INDEX idx_project_org ON Project(organizationId);
CREATE INDEX idx_task_org ON Task(organizationId);
```

### Query Patterns
```typescript
// Optimized board query (single query with includes)
const board = await prisma.project.findUnique({
  where: { id: projectId, organizationId },
  include: {
    statuses: {
      orderBy: { position: 'asc' },
      include: {
        tasks: {
          include: {
            assignments: { include: { user: true } }
          }
        }
      }
    }
  }
});
```

---

## Migration Strategy

### Initial Migration Order
1. Create User table
2. Create Organization table
3. Create Member table (with OWNER constraint)
4. Create RefreshToken table
5. Create Project table
6. Create TaskStatus table
7. Create Task table
8. Create TaskAssignment table
9. Create ProjectMember table
10. Create Document table
11. Create DocumentLock table

### Seed Data
```typescript
// Default first organization for development
{
  organization: "Demo Organization",
  owner: {
    email: "admin@gerensee.com",
    name: "Admin User"
  }
}
```

---

## 11. RefreshToken

**Purpose**: Store refresh tokens for JWT authentication with revocation capability.

**Fields**:
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | String (CUID) | PK, Required | Unique identifier |
| tokenHash | String | Unique, Required | Bcrypt hash of refresh token |
| userId | String | FK, Required | Reference to User |
| expiresAt | DateTime | Required | Token expiration (30 days from creation) |
| createdAt | DateTime | Auto | Token creation timestamp |
| lastUsedAt | DateTime? | Optional | Last time token was used for refresh |

**Relationships**:
- RefreshToken → User (N:1): Each token belongs to one user

**Validation Rules**:
- tokenHash must be unique (prevents duplicate tokens)
- expiresAt must be future date
- Token must be invalidated after single use (rotation strategy)

**Invariants**:
- A user can have multiple active refresh tokens (multi-device support)
- Tokens are single-use (deleted or marked used after refresh operation)
- Expired tokens (>30 days) are deleted by cron job

**Indexes**:
- Unique index on `tokenHash` for fast lookup
- Index on `userId` for bulk invalidation (logout all devices)
- Index on `expiresAt` for cleanup job performance

**State Transitions**:
- Created → Active: On login or registration
- Active → Used: On refresh (token exchanged for new one)
- Active → Expired: After 30 days (cron cleanup)
- Active → Revoked: On logout or security event (manual deletion)

**Lifecycle**:
1. **Creation**: Generate random 32-byte token, hash with bcrypt, store with 30-day expiration
2. **Refresh**: Verify hash matches, check not expired, issue new access + refresh token, delete old token
3. **Logout**: Delete token by hash
4. **Logout All Devices**: Delete all tokens for userId
5. **Password Change**: Delete all tokens for userId (force reauth)
6. **Cleanup**: Cron job deletes tokens where `expiresAt < NOW()` (runs daily)

**Security Considerations**:
- Store bcrypt hash, never plaintext token
- Use cryptographically secure random token generation (crypto.randomBytes)
- Rate-limit refresh endpoint to prevent brute force
- Log all refresh operations for audit trail
- Detect token replay attacks (token used after deletion indicates compromise)

---

## Future Considerations

### Potential Schema Extensions (Out of Scope for MVP)
- **TaskComment**: Comments on tasks
- **DocumentVersion**: Version history for documents
- **Notification**: User notifications for assignments
- **AuditLog**: Track all mutations for compliance
- **Label/Tag**: Categorize tasks
- **Attachment**: File uploads on tasks/documents

These are **NOT** implemented in the initial release but should be considered in the schema design (e.g., avoid column names that conflict with future entities).

---

**Data Model Complete**: Schema ready for Prisma implementation and API contract generation.
