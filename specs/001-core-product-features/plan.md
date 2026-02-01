# Implementation Plan: Core Product Features

**Branch**: `001-core-product-features` | **Date**: 2026-01-31 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-core-product-features/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Build the foundational multi-tenant project management platform enabling organizations to manage projects, tasks (via Kanban boards), and documents. Primary requirement is enforcing multi-tenancy, role-based access control (Owner/Admin/Member), and ensuring proper data isolation per organization. Backend REST API built with NestJS, Prisma ORM, PostgreSQL, and JWT authentication will serve a future frontend application.

## Technical Context

**Language/Version**: TypeScript / Node.js (Latest LTS)  
**Primary Dependencies**: NestJS, Prisma ORM, JWT (jsonwebtoken/passport-jwt), class-validator, class-transformer  
**Storage**: PostgreSQL (multi-tenant with organization-scoped queries)  
**Testing**: Jest (unit tests), Supertest (e2e tests)  
**Target Platform**: Linux server (containerized via Docker)  
**Project Type**: Web (Backend REST API)  
**Performance Goals**: <500ms p95 for API endpoints, support concurrent board updates within 2s (SC-002)  
**Constraints**: Strict multi-tenancy isolation, all queries MUST be organization-scoped, RBAC enforced at domain level  
**Scale/Scope**: Initial target ~100 organizations, ~1000 users, extensible to larger scale

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: Product-First, Domain-Driven ✓
- **Status**: PASS
- **Compliance**: Features serve clear product needs (organization/project/task management). Domain language (Organization, Project, Task, Member, Document) is explicit and consistent with business requirements.

### Principle II: Multi-Tenancy by Default ✓
- **Status**: PASS
- **Compliance**: All data will be scoped to Organization (tenant). Cross-tenant access forbidden. Multi-tenancy is a core invariant (FR-010, Constitution principle).
- **Implementation**: Prisma middleware to enforce organization-scoped queries, organization_id foreign keys on all tenant data.

### Principle III: Explicit Ownership and Membership ✓
- **Status**: PASS
- **Compliance**: Organizations have exactly one OWNER at creation (FR-002). User may belong to multiple orgs but own at most one. Enforced at domain level.
- **Implementation**: Database constraints + domain service validation.

### Principle IV: Authorization Is a Domain Concern ✓
- **Status**: PASS
- **Compliance**: RBAC (Owner/Admin/Member) enforced in domain/service layer, not only in controllers (FR-010).
- **Implementation**: Guards + domain authorization checks in services.

### Principle V: Explicit Invariants Over Implicit Behavior ✓
- **Status**: PASS
- **Compliance**: Business rules (ownership, membership, RBAC, multi-tenancy) will be explicit and enforced via database constraints and domain logic, not relying on ORM defaults.

### Principle VI: Simplicity and Intentional Complexity ✓
- **Status**: PASS
- **Compliance**: Starting simple with NestJS modules for each domain (organizations, projects, tasks, documents). Repository pattern used intentionally to isolate data access and enforce invariants, not for abstraction sake.

**GATE RESULT**: ✅ ALL CHECKS PASSED - Proceed to Phase 0

---

**POST-DESIGN RE-EVALUATION** (2026-01-31):

All Constitution principles remain satisfied after Phase 1 design:
- ✅ Data model enforces multi-tenancy via organizationId + Prisma middleware
- ✅ RBAC implemented at service layer with Guards as secondary defense
- ✅ Ownership constraints enforced via partial unique index + service validation
- ✅ Business invariants explicit in data model (see data-model.md)
- ✅ Repository pattern justified for multi-tenant query scoping
- ✅ No unnecessary abstraction - simple modular NestJS structure

**FINAL GATE RESULT**: ✅ DESIGN APPROVED - Proceed to Phase 2 (Tasks)

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── main.ts                    # Application entry point
├── app.module.ts              # Root module
├── core/
│   ├── database/
│   │   ├── database.module.ts
│   │   └── prisma.service.ts  # Prisma client + multi-tenant middleware
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.service.ts    # JWT authentication
│   │   ├── strategies/        # Passport JWT strategy
│   │   └── guards/            # Auth guards + RBAC guards
│   └── common/
│       ├── decorators/        # Custom decorators (CurrentUser, Roles)
│       ├── filters/           # Exception filters
│       └── interceptors/      # Logging, transformation
├── modules/
│   ├── users/
│   │   ├── users.module.ts
│   │   ├── users.service.ts
│   │   ├── users.controller.ts
│   │   ├── dto/
│   │   └── repositories/
│   ├── organizations/
│   │   ├── organizations.module.ts
│   │   ├── organizations.service.ts
│   │   ├── organizations.controller.ts
│   │   ├── dto/
│   │   └── repositories/
│   ├── projects/
│   │   ├── projects.module.ts
│   │   ├── projects.service.ts
│   │   ├── projects.controller.ts
│   │   ├── dto/
│   │   └── repositories/
│   ├── tasks/
│   │   ├── tasks.module.ts
│   │   ├── tasks.service.ts
│   │   ├── tasks.controller.ts
│   │   ├── dto/
│   │   └── repositories/
│   └── documents/
│       ├── documents.module.ts
│       ├── documents.service.ts
│       ├── documents.controller.ts
│       ├── dto/
│       └── repositories/
└── generated/
    └── prisma/                # Prisma generated types

prisma/
├── schema.prisma              # Database schema
├── migrations/                # Migration history
└── seed.ts                    # Seed data

test/
├── app.e2e-spec.ts
└── [module].e2e-spec.ts       # E2E tests per module
```

**Structure Decision**: Backend-only NestJS application. Using modular structure organized by domain entity (users, organizations, projects, tasks, documents). Repository pattern isolates Prisma queries and enforces multi-tenant scoping. Core module contains cross-cutting concerns (database, auth, RBAC).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
