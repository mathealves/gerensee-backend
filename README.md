# Gerensee Backend

**Gerensee** is a stripped-down project management tool focused on clarity, simplicity, and low cognitive overhead.

This repository contains the backend application, built with **NestJS** and **Prisma**, supporting a multi-tenant project management domain with Kanban boards and collaborative document editing.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 18+ LTS |
| Framework | NestJS 11 |
| ORM | Prisma 7 with `extends PrismaClient` |
| Database | PostgreSQL 14+ |
| Auth | JWT dual-token (access 15m / refresh 30d) |
| Real-time | Socket.io (WebSocket) |
| Package manager | pnpm |

---

## Quickstart

### 1. Prerequisites

- Node.js 18+ LTS
- pnpm (`npm install -g pnpm`)
- Docker & Docker Compose (for local PostgreSQL)

### 2. Clone & install dependencies

```bash
git clone git@github.com:mathealves/gerensee-backend.git && cd gerensee-backend
pnpm install
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env with your secrets
```

### 4. Start PostgreSQL

```bash
docker compose up -d
```

### 5. Apply database migrations

```bash
pnpm prisma:migrate:dev
```

### 6. (Optional) Seed demo data

```bash
pnpm prisma:seed
```

This creates:
- Demo organization: **Gerensee Demo**
- Owner account: `owner@demo.gerensee.io` / `Demo@1234`
- Sample project with default Kanban statuses (To Do, In Progress, Done)

### 7. Start the development server

```bash
pnpm start:dev
```

The API will be available at `http://localhost:3000/api/v1`.

---

## API Documentation

Swagger UI is available at `http://localhost:3000/api/docs` after starting the server.

---

## Key API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/auth/register` | Register a new user |
| POST | `/api/v1/auth/login` | Login, returns access + refresh tokens |
| POST | `/api/v1/auth/refresh` | Refresh access token (rate-limited: 10/min) |
| POST | `/api/v1/auth/logout` | Revoke refresh token |
| GET | `/api/v1/auth/me` | Get current user profile |
| POST | `/api/v1/organizations` | Create organization |
| GET | `/api/v1/organizations/me` | Get current user's organization |
| POST | `/api/v1/organizations/:id/members` | Invite member to organization |
| GET | `/api/v1/organizations/:id/projects` | List organization projects |
| POST | `/api/v1/projects` | Create project |
| GET | `/api/v1/projects/:id` | Get project details |
| POST | `/api/v1/projects/:id/tasks` | Create task in project |
| GET | `/api/v1/projects/:id/board` | Get Kanban board view |
| POST | `/api/v1/documents/:id/lock` | Acquire exclusive document lock (15 min) |

---

## WebSocket Events

Connect to the Socket.io server with JWT auth token:

```javascript
const socket = io('http://localhost:3000', {
  auth: { token: '<JWT_ACCESS_TOKEN>' }
});

// Join a project board room
socket.emit('joinBoard', { projectId: '<id>', organizationId: '<id>' });

// Listen for task updates
socket.on('taskCreated', (task) => { /* ... */ });
socket.on('taskUpdated', (data) => { /* ... */ });
socket.on('taskDeleted', (data) => { /* ... */ });
```

---

## Running Tests

```bash
# Unit tests
pnpm test

# Unit tests with coverage
pnpm test:cov

# E2E tests
pnpm test:e2e
```

---

## Project Structure

```
src/
├── main.ts                    # Bootstrap (Swagger config)
├── app.module.ts              # Root module (Throttler, Scheduler, etc.)
├── core/
│   ├── auth/                  # JWT auth, guards, decorators, strategies
│   ├── database/              # PrismaService (extends PrismaClient)
│   └── common/                # Filters, interceptors, pipes
└── modules/
    ├── organizations/         # Organizations + member management (US1)
    ├── projects/              # Projects + task statuses + members (US2)
    ├── tasks/                 # Tasks + Kanban + WebSocket gateway (US3)
    └── documents/             # Documents + locking + scheduler (US4)
prisma/
├── schema.prisma              # Database schema
├── migrations/                # Migration history
└── seed.ts                    # Demo data seed script
```

