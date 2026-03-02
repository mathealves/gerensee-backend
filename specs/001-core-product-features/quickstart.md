# Quickstart Guide: Core Product Features

**Feature**: Core Product Features  
**Branch**: `001-core-product-features`  
**Date**: 2026-01-31

## Overview

This guide provides a quick reference for implementing the Gerensee core platform features. Follow these steps to build the multi-tenant project management backend with organizations, projects, tasks (Kanban), and documents.

---

## Prerequisites

- Node.js 18+ (LTS)
- PostgreSQL 14+
- pnpm (package manager)
- Docker & Docker Compose (optional, for local PostgreSQL)

---

## Project Structure

```
gerensee-backend/
├── src/
│   ├── main.ts                      # Application entry
│   ├── app.module.ts                # Root module
│   ├── core/
│   │   ├── database/                # Prisma service + middleware
│   │   ├── auth/                    # JWT authentication + guards
│   │   └── common/                  # Decorators, filters, interceptors
│   └── modules/
│       ├── users/                   # User management
│       ├── organizations/           # Organizations + members
│       ├── projects/                # Projects + project members
│       ├── tasks/                   # Tasks + Kanban + WebSocket
│       └── documents/               # Documents + locking
├── prisma/
│   ├── schema.prisma                # Database schema
│   ├── migrations/                  # Migration history
│   └── seed.ts                      # Seed data
├── test/
│   └── *.e2e-spec.ts                # E2E tests
├── specs/
│   └── 001-core-product-features/   # This feature's documentation
└── .env                             # Environment variables
```

---

## Step 1: Environment Setup

Create `.env` file in repository root:

```bash
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/gerensee?schema=public"

# JWT Authentication
JWT_ACCESS_SECRET="your-super-secret-jwt-access-key-change-in-production"
JWT_ACCESS_EXPIRATION="15m"  # 15 minutes
JWT_REFRESH_SECRET="your-super-secret-jwt-refresh-key-change-in-production"
JWT_REFRESH_EXPIRATION="30d"  # 30 days

# Server
PORT=3000
NODE_ENV="development"
```

**Start PostgreSQL** (via Docker):
```bash
docker-compose up -d postgres
```

---

## Step 2: Install Dependencies

```bash
pnpm install
```

**Key dependencies**:
- `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`
- `@prisma/client`, `prisma`
- `@nestjs/passport`, `@nestjs/jwt`, `passport-jwt`
- `@nestjs/websockets`, `@nestjs/platform-socket.io`
- `bcrypt`, `class-validator`, `class-transformer`

---

## Step 3: Database Schema

See [data-model.md](data-model.md) for complete entity definitions.

**Run Prisma migrations**:
```bash
# Generate Prisma client
pnpm prisma generate

# Run migrations
pnpm prisma migrate deploy

# Seed database (optional)
pnpm prisma db seed
```

**Key schema features**:
- Multi-tenant via `organizationId` on all tenant data
- Partial unique index for OWNER role (one per org)
- Cascade deletes for hierarchical data
- JSONB column for document content (Tiptap format)

---

## Step 4: Prisma Multi-Tenant Middleware

**File**: `src/core/database/prisma.service.ts`

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
    
    // Multi-tenant middleware
    this.$use(async (params, next) => {
      const tenantModels = ['Project', 'Task', 'Document'];
      
      if (tenantModels.includes(params.model)) {
        const orgId = this.getCurrentOrganizationId();
        
        if (['findMany', 'findFirst', 'findUnique'].includes(params.action)) {
          params.args.where = { ...params.args.where, organizationId: orgId };
        }
        
        if (['create', 'update'].includes(params.action)) {
          params.args.data = { ...params.args.data, organizationId: orgId };
        }
      }
      
      return next(params);
    });
  }
  
  private getCurrentOrganizationId(): string {
    // Retrieved from request context (AsyncLocalStorage)
    // Implementation in auth module
    throw new Error('Organization context not set');
  }
}
```

---

## Step 5: Authentication (JWT)

### Auth Module Structure

```
src/core/auth/
├── auth.module.ts
├── auth.service.ts              # Login, register, validate user, refresh tokens
├── strategies/
│   └── jwt.strategy.ts          # Passport JWT strategy
├── guards/
│   ├── jwt-auth.guard.ts        # Protect routes with JWT
│   └── roles.guard.ts           # RBAC enforcement
└── decorators/
    ├── current-user.decorator.ts
    └── roles.decorator.ts
```

### JWT Token Strategy

**Two-Token System** (see [research.md](research.md) §9):

1. **Access Token** (15 min lifetime):
   - Short-lived for security
   - Stored in client memory/state
   - Contains user context (organizationId, role)
   - Stateless verification (no DB lookup)

2. **Refresh Token** (30 day lifetime):
   - Long-lived for UX
   - Stored in database (hashed)
   - Single-use with rotation
   - Enables revocation (logout, security events)

### JWT Access Token Payload

```typescript
interface JwtPayload {
  sub: string;              // User ID
  email: string;
  organizationId: string;   // Current organization context
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
}
```

### Auth Service Implementation

```typescript
@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(email: string, password: string) {
    // 1. Validate credentials
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // 2. Get user's organization membership
    const membership = await this.prisma.member.findFirst({
      where: { userId: user.id },
      include: { organization: true },
    });

    if (!membership) {
      throw new UnauthorizedException('User not member of any organization');
    }

    // 3. Generate access token (15 min)
    const accessToken = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        organizationId: membership.organizationId,
        role: membership.role,
      },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '15m' },
    );

    // 4. Generate refresh token (30 days)
    const refreshToken = crypto.randomBytes(32).toString('hex');
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

    await this.prisma.refreshToken.create({
      data: {
        tokenHash: refreshTokenHash,
        userId: user.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, name: user.name },
    };
  }

  async refreshAccessToken(refreshToken: string) {
    // 1. Find and validate refresh token
    const tokens = await this.prisma.refreshToken.findMany({
      where: { expiresAt: { gte: new Date() } },
      include: { user: { include: { memberships: true } } },
    });

    // Compare hashes (protect against timing attacks)
    let validToken = null;
    for (const token of tokens) {
      if (await bcrypt.compare(refreshToken, token.tokenHash)) {
        validToken = token;
        break;
      }
    }

    if (!validToken) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // 2. Check token not already used (detect replay)
    if (validToken.lastUsedAt) {
      // Token already used - possible replay attack
      await this.prisma.refreshToken.deleteMany({ where: { userId: validToken.userId } });
      throw new UnauthorizedException('Refresh token already used (possible replay attack)');
    }

    // 3. Delete old refresh token (rotation)
    await this.prisma.refreshToken.delete({ where: { id: validToken.id } });

    // 4. Get user's current org membership
    const membership = validToken.user.memberships[0];

    // 5. Generate new access token
    const newAccessToken = this.jwtService.sign(
      {
        sub: validToken.userId,
        email: validToken.user.email,
        organizationId: membership.organizationId,
        role: membership.role,
      },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '15m' },
    );

    // 6. Generate new refresh token
    const newRefreshToken = crypto.randomBytes(32).toString('hex');
    const newRefreshTokenHash = await bcrypt.hash(newRefreshToken, 10);

    await this.prisma.refreshToken.create({
      data: {
        tokenHash: newRefreshTokenHash,
        userId: validToken.userId,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(refreshToken: string) {
    // Find and delete refresh token
    const tokens = await this.prisma.refreshToken.findMany();
    
    for (const token of tokens) {
      if (await bcrypt.compare(refreshToken, token.tokenHash)) {
        await this.prisma.refreshToken.delete({ where: { id: token.id } });
        return;
      }
    }
  }

  async logoutAllDevices(userId: string) {
    // Delete all refresh tokens for user (e.g., on password change)
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
  }
}
```

### Cleanup Job for Expired Tokens

```typescript
// src/core/auth/auth.scheduler.ts
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class AuthScheduler {
  constructor(private prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupExpiredTokens() {
    const result = await this.prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    console.log(`Cleaned up ${result.count} expired refresh tokens`);
  }
}
```

### Usage in Controllers

```typescript
@Controller('projects')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectsController {
  @Post()
  @Roles('OWNER', 'ADMIN')
  async createProject(
    @CurrentUser() user: User,
    @Body() dto: CreateProjectDto
  ) {
    return this.projectsService.create(user, dto);
  }
}
```

---

## Step 6: RBAC Implementation

### Role-Based Access Control

**Three Roles** (Constitution Principle III):
1. **OWNER**: One per organization, full control
2. **ADMIN**: Many per organization, full control
3. **MEMBER**: Restricted to assigned projects

### Service-Layer Enforcement

```typescript
@Injectable()
export class ProjectsService {
  async addMember(user: User, projectId: string, memberDto: AddMemberDto) {
    // 1. Check user's organization role
    const membership = await this.getMembership(user.id, user.organizationId);
    
    if (membership.role === 'MEMBER') {
      throw new ForbiddenException('Members cannot add project members');
    }
    
    // 2. Validate target user is in organization
    const targetMember = await this.findOrgMember(memberDto.userId, user.organizationId);
    if (!targetMember) {
      throw new BadRequestException('User not in organization');
    }
    
    // 3. Create project membership
    return this.prisma.projectMember.create({
      data: {
        projectId,
        userId: memberDto.userId
      }
    });
  }
}
```

---

## Step 7: WebSocket Gateway (Real-time Board Updates)

**File**: `src/modules/tasks/board.gateway.ts`

```typescript
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: true })
export class BoardGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;
  
  async handleConnection(client: Socket) {
    // Authenticate via JWT token in handshake
    const token = client.handshake.auth.token;
    const user = await this.authService.validateToken(token);
    
    if (!user) {
      client.disconnect();
      return;
    }
    
    client.data.user = user;
  }
  
  @SubscribeMessage('joinBoard')
  async handleJoinBoard(client: Socket, payload: { projectId: string }) {
    const { user } = client.data;
    
    // Verify user is project member
    const isMember = await this.verifyProjectMember(user.id, payload.projectId);
    if (!isMember) {
      client.emit('error', { code: 'FORBIDDEN', message: 'Not project member' });
      return;
    }
    
    client.join(`board:${payload.projectId}`);
    client.emit('boardJoined', { projectId: payload.projectId });
  }
  
  // Called from TasksService after update
  notifyTaskUpdate(projectId: string, task: Task) {
    this.server.to(`board:${projectId}`).emit('taskUpdated', { task });
  }
}
```

---

## Step 8: Document Locking

### Lock Lifecycle

```typescript
@Injectable()
export class DocumentsService {
  async lockDocument(userId: string, documentId: string): Promise<DocumentLock> {
    const existingLock = await this.prisma.documentLock.findUnique({
      where: { documentId },
      include: { user: true }
    });
    
    // Check if locked by another user
    if (existingLock && existingLock.userId !== userId) {
      if (existingLock.expiresAt > new Date()) {
        throw new ConflictException(
          `Document locked by ${existingLock.user.name} until ${existingLock.expiresAt}`
        );
      }
      // Lock expired, remove it
      await this.prisma.documentLock.delete({ where: { id: existingLock.id } });
    }
    
    // Create or update lock
    return this.prisma.documentLock.upsert({
      where: { documentId },
      create: {
        documentId,
        userId,
        lockedAt: new Date(),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
      },
      update: {
        lockedAt: new Date(),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000)
      }
    });
  }
}
```

### Cron Job for Expired Locks

```typescript
@Injectable()
export class DocumentLockCleanupService {
  @Cron('*/5 * * * *') // Every 5 minutes
  async cleanupExpiredLocks() {
    const deleted = await this.prisma.documentLock.deleteMany({
      where: {
        expiresAt: { lt: new Date() }
      }
    });
    
    this.logger.log(`Cleaned up ${deleted.count} expired locks`);
  }
}
```

---

## Step 9: API Endpoints

See [contracts/](contracts/) for complete OpenAPI specs:

### Core Endpoints

| Endpoint | Method | Description | Auth | RBAC |
|----------|--------|-------------|------|------|
| `/auth/register` | POST | Register user | None | - |
| `/auth/login` | POST | Login (get JWT) | None | - |
| `/organizations` | POST | Create org (become OWNER) | JWT | - |
| `/organizations/{id}/members` | POST | Add member | JWT | OWNER/ADMIN |
| `/projects` | POST | Create project | JWT | OWNER/ADMIN |
| `/projects/{id}/members` | POST | Add project member | JWT | OWNER/ADMIN |
| `/projects/{id}/tasks` | POST | Create task | JWT | Project Member |
| `/tasks/{id}` | PATCH | Update task (move column) | JWT | Project Member |
| `/documents/{id}/lock` | POST | Lock document | JWT | Project Member |
| `/documents/{id}` | PATCH | Edit document (requires lock) | JWT | Lock Holder |

---

## Step 10: Testing

### Unit Tests

```bash
pnpm test
```

**Example**:
```typescript
describe('OrganizationsService', () => {
  it('should enforce one OWNER per organization', async () => {
    // Attempt to create second OWNER
    await expect(
      service.addMember(org.id, { userId: user2.id, role: 'OWNER' })
    ).rejects.toThrow('Organization already has an OWNER');
  });
});
```

### E2E Tests

```bash
pnpm test:e2e
```

**Example** (from spec acceptance scenarios):
```typescript
describe('User Story 1: Organization Setup (e2e)', () => {
  it('should create organization and set user as owner', async () => {
    const response = await request(app.getHttpServer())
      .post('/organizations')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Acme Corp' })
      .expect(201);
    
    expect(response.body.name).toBe('Acme Corp');
    
    // Verify user is OWNER
    const members = await request(app.getHttpServer())
      .get(`/organizations/${response.body.id}/members`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    
    const owner = members.body.find(m => m.role === 'OWNER');
    expect(owner.userId).toBe(user.id);
  });
});
```

---

## Step 11: Running the Application

### Development Mode

```bash
pnpm run start:dev
```

API available at: `http://localhost:3000`

### Production Build

```bash
pnpm run build
pnpm run start:prod
```

### Docker

```bash
docker-compose up -d
```

---

## Development Workflow

### 1. Feature Development

Follow module structure:
```
src/modules/[feature]/
├── [feature].module.ts
├── [feature].service.ts         # Business logic
├── [feature].controller.ts      # HTTP endpoints
├── [feature].gateway.ts         # WebSocket (if needed)
├── dto/
│   ├── create-[feature].dto.ts
│   └── update-[feature].dto.ts
└── repositories/
    └── [feature].repository.ts  # Prisma queries (optional)
```

### 2. Database Changes

```bash
# 1. Update prisma/schema.prisma
# 2. Create migration
pnpm prisma migrate dev --name add_new_field

# 3. Generate Prisma client
pnpm prisma generate
```

### 3. Add New Endpoint

1. Create DTO with validation:
   ```typescript
   export class CreateTaskDto {
     @IsString()
     @MinLength(1)
     @MaxLength(500)
     title: string;
   }
   ```

2. Implement service method:
   ```typescript
   async createTask(user: User, dto: CreateTaskDto): Promise<Task> {
     // Validate project membership
     // Create task
     // Emit WebSocket event
   }
   ```

3. Add controller endpoint:
   ```typescript
   @Post()
   @UseGuards(JwtAuthGuard)
   async create(@CurrentUser() user: User, @Body() dto: CreateTaskDto) {
     return this.service.createTask(user, dto);
   }
   ```

4. Write tests
5. Update OpenAPI contract (if public API)

---

## Common Patterns

### Multi-Tenant Query

```typescript
// Always include organizationId in queries
const projects = await this.prisma.project.findMany({
  where: {
    organizationId: user.organizationId  // From JWT
  }
});
```

### RBAC Check

```typescript
// Service-layer authorization
private async requireRole(userId: string, orgId: string, roles: MemberRole[]) {
  const member = await this.prisma.member.findUnique({
    where: { userId_organizationId: { userId, organizationId: orgId } }
  });
  
  if (!member || !roles.includes(member.role)) {
    throw new ForbiddenException('Insufficient permissions');
  }
  
  return member;
}
```

### Transaction for Invariants

```typescript
// Ensure organization has exactly one OWNER
await this.prisma.$transaction(async (tx) => {
  // Transfer ownership
  await tx.member.update({
    where: { id: currentOwner.id },
    data: { role: 'ADMIN' }
  });
  
  await tx.member.update({
    where: { id: newOwner.id },
    data: { role: 'OWNER' }
  });
});
```

---

## Performance Tips

1. **Use Prisma `select` and `include`** to avoid over-fetching:
   ```typescript
   const tasks = await this.prisma.task.findMany({
     select: { id: true, title: true, statusId: true }  // Only needed fields
   });
   ```

2. **Optimize board queries** with single query + includes:
   ```typescript
   const board = await this.prisma.project.findUnique({
     where: { id: projectId },
     include: {
       statuses: {
         orderBy: { position: 'asc' },
         include: {
           tasks: { include: { assignments: { include: { user: true } } } }
         }
       }
     }
   });
   ```

3. **Index frequently queried fields** (see data-model.md)

4. **Use WebSocket for real-time**, not polling

---

## Troubleshooting

### Migration Errors

```bash
# Reset database (development only!)
pnpm prisma migrate reset

# Regenerate Prisma client
pnpm prisma generate
```

### JWT Authentication Issues

- Verify `JWT_SECRET` in `.env`
- Check token expiration
- Ensure `Authorization: Bearer <token>` header format

### WebSocket Connection Fails

- Check CORS settings in gateway
- Verify JWT token in `auth.token` handshake
- Ensure Socket.io client version matches server

---

## Next Steps

After implementing core features:

1. **Phase 2**: Generate tasks (see `/speckit.tasks` command)
2. **Implement endpoints** following contracts in `contracts/`
3. **Write E2E tests** for all acceptance scenarios
4. **Deploy** to staging environment
5. **Frontend integration** using API contracts

---

## Resources

- **Data Model**: [data-model.md](data-model.md)
- **Research**: [research.md](research.md)
- **API Contracts**: [contracts/](contracts/)
- **Feature Spec**: [spec.md](spec.md)
- **NestJS Docs**: https://docs.nestjs.com
- **Prisma Docs**: https://www.prisma.io/docs

---

**Quickstart Complete**: Ready for implementation!
