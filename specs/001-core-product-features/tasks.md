# Tasks: Core Product Features

**Input**: Design documents from `/specs/001-core-product-features/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Not explicitly requested in specification - omitted per speckit.tasks guidelines.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Install NestJS dependencies (@nestjs/core, @nestjs/common, @nestjs/platform-express) per plan.md
- [x] T002 [P] Install Prisma dependencies (@prisma/client, prisma) per plan.md
- [x] T003 [P] Install authentication dependencies (@nestjs/passport, @nestjs/jwt, passport-jwt, bcrypt, jsonwebtoken) per plan.md
- [x] T004 [P] Install WebSocket dependencies (@nestjs/websockets, @nestjs/platform-socket.io, socket.io) per plan.md
- [x] T005 [P] Install validation dependencies (class-validator, class-transformer) per plan.md
- [x] T006 [P] Install testing dependencies (jest, supertest, @nestjs/testing) per plan.md
- [x] T007 [P] Configure TypeScript compiler options in tsconfig.json per plan.md
- [x] T008 [P] Configure ESLint rules in eslint.config.mjs per plan.md
- [x] T009 [P] Create environment configuration template (.env.example) with DATABASE_URL, JWT secrets per quickstart.md
- [x] T010 Create Docker Compose file with PostgreSQL service per quickstart.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T011 Create Prisma schema with all entities (User, Organization, Member, RefreshToken, Project, ProjectMember, TaskStatus, Task, TaskAssignment, Document, DocumentLock) in prisma/schema.prisma per data-model.md
- [x] T012 Add enums (Role, TaskPriority) to Prisma schema per data-model.md
- [x] T013 Add all indexes (unique, composite, partial) to Prisma schema per data-model.md §Indexes
- [x] T014 Add cascade delete rules to Prisma schema per data-model.md §Cascade Rules
- [x] T015 Run initial Prisma migration: `pnpm prisma migrate dev --name init`
- [x] T016 Add partial unique index for OWNER role via raw SQL in migration per data-model.md §Member
- [x] T017 Create PrismaService in src/core/database/prisma.service.ts with client instantiation per quickstart.md
- [x] T018 Implement Prisma middleware for multi-tenant organization scoping in src/core/database/prisma.service.ts per research.md §Multi-Tenancy
- [x] T019 Create DatabaseModule in src/core/database/database.module.ts exporting PrismaService
- [x] T020 Create JWT strategy in src/core/auth/strategies/jwt.strategy.ts validating access tokens per quickstart.md §JWT Token Strategy
- [x] T021 [P] Create JwtAuthGuard in src/core/auth/guards/jwt-auth.guard.ts per quickstart.md
- [x] T022 [P] Create RolesGuard in src/core/auth/guards/roles.guard.ts checking JWT role per quickstart.md §RBAC
- [x] T023 [P] Create @CurrentUser decorator in src/core/auth/decorators/current-user.decorator.ts extracting user from request per quickstart.md
- [x] T024 [P] Create @Roles decorator in src/core/auth/decorators/roles.decorator.ts for RBAC metadata per quickstart.md
- [x] T025 Create AuthService in src/core/auth/auth.service.ts with login(), refreshAccessToken(), logout(), logoutAllDevices() methods per quickstart.md §Auth Service Implementation
- [x] T026 Create AuthScheduler in src/core/auth/auth.scheduler.ts with daily cron job to cleanup expired refresh tokens per quickstart.md §Cleanup Job
- [x] T027 Create AuthController in src/core/auth/auth.controller.ts with POST /auth/register, POST /auth/login, POST /auth/refresh, POST /auth/logout, GET /auth/me endpoints per contracts/auth-api.yaml
- [x] T028 Create AuthModule in src/core/auth/auth.module.ts importing PassportModule, JwtModule, DatabaseModule and registering all auth components
- [x] T029 [P] Create global exception filter in src/core/common/filters/http-exception.filter.ts per plan.md
- [x] T030 [P] Create validation pipe in src/core/common/pipes/validation.pipe.ts per plan.md
- [x] T031 Update AppModule in src/app.module.ts to import DatabaseModule, AuthModule and register global filters/pipes

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Organization & Team Setup (Priority: P1) 🎯 MVP

**Goal**: Enable organization creation, user invitations, and membership management

**Independent Test**: Register user → Create organization "Acme Corp" → Invite user by email → User becomes member

### Implementation for User Story 1

- [x] T032 [P] [US1] Create CreateOrganizationDto in src/modules/organizations/dto/create-organization.dto.ts with name field validation per contracts/organizations-api.yaml
- [x] T033 [P] [US1] Create UpdateOrganizationDto in src/modules/organizations/dto/update-organization.dto.ts per contracts/organizations-api.yaml
- [x] T034 [P] [US1] Create InviteMemberDto in src/modules/organizations/dto/invite-member.dto.ts with email and role fields per contracts/organizations-api.yaml
- [x] T035 [P] [US1] Create UpdateMemberRoleDto in src/modules/organizations/dto/update-member-role.dto.ts per contracts/organizations-api.yaml
- [x] T036 [US1] Create OrganizationsRepository in src/modules/organizations/repositories/organizations.repository.ts with organization-scoped queries per quickstart.md §Multi-Tenant Query Pattern
- [x] T037 [US1] Create OrganizationsService in src/modules/organizations/organizations.service.ts implementing create(), findAll(), findOne(), update(), delete() with RBAC checks per research.md §RBAC
- [x] T038 [US1] Implement Member invitation logic in OrganizationsService.inviteMember() enforcing OWNER constraint per data-model.md §Member Invariants
- [x] T039 [US1] Implement Member role update in OrganizationsService.updateMemberRole() with ownership transfer validation per data-model.md §Member State Transitions
- [x] T040 [US1] Implement Member removal in OrganizationsService.removeMember() preventing OWNER removal per data-model.md §Member Invariants
- [x] T041 [US1] Create OrganizationsController in src/modules/organizations/organizations.controller.ts with endpoints: POST /organizations, GET /organizations, GET /organizations/:id, PATCH /organizations/:id, DELETE /organizations/:id per contracts/organizations-api.yaml
- [x] T042 [US1] Add member management endpoints to OrganizationsController: POST /organizations/:id/members, GET /organizations/:id/members, PATCH /organizations/:id/members/:memberId, DELETE /organizations/:id/members/:memberId per contracts/organizations-api.yaml
- [x] T043 [US1] Create OrganizationsModule in src/modules/organizations/organizations.module.ts importing DatabaseModule and exporting OrganizationsService
- [x] T044 [US1] Update AppModule to import OrganizationsModule

**Checkpoint**: User Story 1 complete - Users can create organizations and manage members independently

---

## Phase 4: User Story 2 - Project Initialization (Priority: P1) 🎯 MVP

**Goal**: Enable project creation within organizations and adding members to projects

**Independent Test**: Login as admin → Create project "Website Redesign" → Add member to project → Member has access

### Implementation for User Story 2

- [x] T045 [P] [US2] Create CreateProjectDto in src/modules/projects/dto/create-project.dto.ts with name and description fields per contracts/projects-api.yaml
- [x] T046 [P] [US2] Create UpdateProjectDto in src/modules/projects/dto/update-project.dto.ts per contracts/projects-api.yaml
- [x] T047 [P] [US2] Create AddProjectMemberDto in src/modules/projects/dto/add-project-member.dto.ts with userId field per contracts/projects-api.yaml
- [x] T048 [US2] Create ProjectsRepository in src/modules/projects/repositories/projects.repository.ts with organization-scoped queries per quickstart.md §Multi-Tenant Query Pattern
- [x] T049 [US2] Create ProjectsService in src/modules/projects/projects.service.ts implementing create(), findAll(), findOne(), update(), delete() per research.md §RBAC
- [x] T050 [US2] Implement default TaskStatus creation (To Do, In Progress, Done) in ProjectsService.create() per data-model.md §Project Default Behavior
- [x] T051 [US2] Implement ProjectMember management in ProjectsService.addMember(), removeMember() validating user is in organization per data-model.md §ProjectMember Invariants
- [x] T052 [US2] Implement RBAC checks in ProjectsService: OWNER/ADMIN can create projects, MEMBER can only view assigned projects per research.md §RBAC
- [x] T053 [US2] Create ProjectsController in src/modules/projects/projects.controller.ts with endpoints: POST /organizations/:organizationId/projects, GET /organizations/:organizationId/projects, GET /projects/:id, PATCH /projects/:id, DELETE /projects/:id per contracts/projects-api.yaml
- [x] T054 [US2] Add project member endpoints to ProjectsController: POST /projects/:id/members, GET /projects/:id/members, DELETE /projects/:id/members/:memberId per contracts/projects-api.yaml
- [x] T055 [US2] Add TaskStatus management endpoints to ProjectsController: POST /projects/:id/statuses, GET /projects/:id/statuses, PATCH /projects/:id/statuses/:statusId, DELETE /projects/:id/statuses/:statusId per contracts/projects-api.yaml
- [x] T056 [US2] Create ProjectsModule in src/modules/projects/projects.module.ts importing DatabaseModule and exporting ProjectsService
- [x] T057 [US2] Update AppModule to import ProjectsModule

**Checkpoint**: User Story 2 complete - Projects can be created and members assigned independently

---

## Phase 5: User Story 3 - Task Management (Kanban) (Priority: P1) 🎯 MVP

**Goal**: Enable task creation, assignment, status changes, and Kanban board view with real-time updates

**Independent Test**: Open project → Create task "Fix login bug" → Assign to member → Move to "In Progress" → See update in <2s

### Implementation for User Story 3

- [ ] T058 [P] [US3] Create CreateTaskDto in src/modules/tasks/dto/create-task.dto.ts with title, description, statusId, priority, dueDate, assigneeIds fields per contracts/tasks-api.yaml
- [ ] T059 [P] [US3] Create UpdateTaskDto in src/modules/tasks/dto/update-task.dto.ts per contracts/tasks-api.yaml
- [ ] T060 [P] [US3] Create MoveTaskDto in src/modules/tasks/dto/move-task.dto.ts with statusId field per contracts/tasks-api.yaml
- [ ] T061 [P] [US3] Create AssignTaskDto in src/modules/tasks/dto/assign-task.dto.ts with userIds array per contracts/tasks-api.yaml
- [ ] T062 [US3] Create TasksRepository in src/modules/tasks/repositories/tasks.repository.ts with optimized board query (single query with includes) per data-model.md §Query Patterns
- [ ] T063 [US3] Create TasksService in src/modules/tasks/tasks.service.ts implementing create(), findAll(), findOne(), update(), delete() with organization scoping per quickstart.md
- [ ] T064 [US3] Implement task assignment validation in TasksService.assignTask() ensuring assignees are project members per data-model.md §TaskAssignment Invariants
- [ ] T065 [US3] Implement task move validation in TasksService.moveTask() ensuring statusId belongs to same project per data-model.md §Task Invariants
- [ ] T066 [US3] Create BoardGateway in src/modules/tasks/board.gateway.ts implementing WebSocket server per quickstart.md §WebSocket Gateway
- [ ] T067 [US3] Implement joinBoard and leaveBoard message handlers in BoardGateway validating user is project member per contracts/websocket-api.md
- [ ] T068 [US3] Implement WebSocket authentication in BoardGateway.handleConnection() validating JWT token per contracts/websocket-api.md §Authentication
- [ ] T069 [US3] Integrate BoardGateway.notifyTaskUpdate() in TasksService to emit taskCreated, taskUpdated, taskMoved events after mutations per contracts/websocket-api.md
- [ ] T070 [US3] Ensure emit timing <100ms after mutation per contracts/websocket-api.md §Performance
- [ ] T071 [US3] Create TasksController in src/modules/tasks/tasks.controller.ts with endpoints: POST /projects/:projectId/tasks, GET /projects/:projectId/tasks, GET /tasks/:id, PATCH /tasks/:id, DELETE /tasks/:id per contracts/tasks-api.yaml
- [ ] T072 [US3] Add task board endpoint to TasksController: GET /projects/:projectId/board returning optimized board view per contracts/tasks-api.yaml
- [ ] T073 [US3] Add task assignment endpoints: POST /tasks/:id/assign, DELETE /tasks/:id/assign/:userId per contracts/tasks-api.yaml
- [ ] T074 [US3] Create TasksModule in src/modules/tasks/tasks.module.ts importing DatabaseModule, registering BoardGateway and exporting TasksService
- [ ] T075 [US3] Update AppModule to import TasksModule

**Checkpoint**: User Story 3 complete - Tasks can be created, managed on Kanban board with real-time updates

---

## Phase 6: User Story 4 - Project Documentation (Priority: P2)

**Goal**: Enable document creation, rich text editing with locking mechanism to prevent conflicts

**Independent Test**: Open project → Create document "Meeting Notes" → Lock document → Edit content → Save → Unlock

### Implementation for User Story 4

- [ ] T076 [P] [US4] Create CreateDocumentDto in src/modules/documents/dto/create-document.dto.ts with title and content (Tiptap JSON) fields per contracts/documents-api.yaml
- [ ] T077 [P] [US4] Create UpdateDocumentDto in src/modules/documents/dto/update-document.dto.ts per contracts/documents-api.yaml
- [ ] T078 [US4] Create DocumentsRepository in src/modules/documents/repositories/documents.repository.ts with organization-scoped queries per quickstart.md
- [ ] T079 [US4] Create DocumentsService in src/modules/documents/documents.service.ts implementing create(), findAll(), findOne(), update(), delete() per quickstart.md
- [ ] T080 [US4] Implement document locking in DocumentsService.lockDocument() creating DocumentLock with 15-minute expiration per research.md §Document Locking
- [ ] T081 [US4] Implement lock validation in DocumentsService.update() ensuring user holds valid lock per data-model.md §DocumentLock
- [ ] T082 [US4] Implement document unlock in DocumentsService.unlockDocument() deleting DocumentLock per contracts/documents-api.yaml
- [ ] T083 [US4] Implement lock extension in DocumentsService.extendLock() updating expiresAt per contracts/documents-api.yaml
- [ ] T084 [US4] Create DocumentLockScheduler in src/modules/documents/document-lock.scheduler.ts with cron job to delete expired locks per data-model.md §DocumentLock Cleanup
- [ ] T085 [US4] Validate Tiptap JSON structure in DocumentsService before saving per data-model.md §Document Validation Rules
- [ ] T086 [US4] Enforce 10MB content size limit in DocumentsService per data-model.md §Document Validation Rules
- [ ] T087 [US4] Create DocumentsController in src/modules/documents/documents.controller.ts with endpoints: POST /projects/:projectId/documents, GET /projects/:projectId/documents, GET /documents/:id, PATCH /documents/:id, DELETE /documents/:id per contracts/documents-api.yaml
- [ ] T088 [US4] Add document locking endpoints: POST /documents/:id/lock, DELETE /documents/:id/lock, POST /documents/:id/lock/extend per contracts/documents-api.yaml
- [ ] T089 [US4] Create DocumentsModule in src/modules/documents/documents.module.ts importing DatabaseModule and exporting DocumentsService
- [ ] T090 [US4] Update AppModule to import DocumentsModule

**Checkpoint**: User Story 4 complete - Documents can be created and edited with conflict prevention via locking

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T091 [P] Add API documentation using Swagger/OpenAPI decorators in all controllers per plan.md
- [ ] T092 [P] Add request logging interceptor in src/core/common/interceptors/logging.interceptor.ts per plan.md
- [ ] T093 [P] Add rate limiting for /auth/refresh endpoint (10 req/min per user) per research.md §JWT Token Strategy
- [ ] T094 [P] Add composite indexes for optimized board queries if not already in schema per data-model.md §Composite Indexes
- [ ] T095 Create seed script in prisma/seed.ts creating demo organization with owner user per data-model.md §Migration Strategy
- [ ] T096 [P] Update README.md with quickstart instructions per quickstart.md
- [ ] T097 [P] Create .env.example file if not done in Setup phase
- [ ] T098 Validate all edge cases from spec.md: access denial for non-project members, assignee validation, locked document editing per spec.md §Edge Cases
- [ ] T099 Performance testing: verify <500ms p95 for API endpoints per plan.md §Performance Goals
- [ ] T100 Performance testing: verify board updates reflected within 2s per spec.md §SC-002
- [ ] T101 Run full quickstart.md validation: follow all steps to ensure documentation accuracy

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (Phase 4)**: Depends on Foundational (Phase 2) - No dependencies on US1 (independently testable)
- **User Story 3 (Phase 5)**: Depends on Foundational (Phase 2) and US2 (needs projects to create tasks)
- **User Story 4 (Phase 6)**: Depends on Foundational (Phase 2) and US2 (needs projects for documents)
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - Organization & membership management standalone
- **User Story 2 (P1)**: Can start after Foundational - Project creation standalone (though logically needs orgs, can be tested independently)
- **User Story 3 (P1)**: Requires US2 complete (tasks need projects) - BLOCKS: Must have projects to create tasks
- **User Story 4 (P2)**: Requires US2 complete (documents need projects) - BLOCKS: Must have projects for documents

### Within Each User Story

**User Story 1** (Organization & Members):
- DTOs (T032-T035) → Repository (T036) → Service (T037-T040) → Controller (T041-T042) → Module (T043)

**User Story 2** (Projects):
- DTOs (T045-T047) → Repository (T048) → Service (T049-T052) → Controller (T053-T055) → Module (T056)
- Default TaskStatus creation (T050) must be in service create method

**User Story 3** (Tasks & Kanban):
- DTOs (T058-T061) → Repository (T062) → Service (T063-T065) → BoardGateway (T066-T070) → Service-Gateway integration (T069) → Controller (T071-T073) → Module (T074)
- BoardGateway must be created before integration with service

**User Story 4** (Documents):
- DTOs (T076-T077) → Repository (T078) → Service (T079-T086) → Controller (T087-T088) → Module (T089)
- Locking logic (T080-T083) must be in service before controller endpoints
- Scheduler (T084) can be created in parallel with controller

### Parallel Opportunities

**Setup (Phase 1)**:
- ALL tasks T002-T010 can run in parallel (different package installs, config files)

**Foundational (Phase 2)**:
- T021-T024 (Guards & Decorators) can run in parallel after T020 (JWT Strategy)
- T029-T030 (Exception filter & Validation pipe) can run in parallel

**User Story 1**:
- T032-T035 (All DTOs) can run in parallel
- T041-T042 (Controller endpoints) can be written together

**User Story 2**:
- T045-T047 (All DTOs) can run in parallel

**User Story 3**:
- T058-T061 (All DTOs) can run in parallel

**User Story 4**:
- T076-T077 (DTOs) can run in parallel
- T084 (Scheduler) in parallel with T087-T088 (Controller)

**Polish (Phase 7)**:
- T091-T094, T096-T097 (Documentation, logging, rate limiting, indexes, README) can run in parallel

---

## Parallel Example: User Story 3 (Tasks & Kanban)

```bash
# Launch all DTOs together:
Task T058: "Create CreateTaskDto in src/modules/tasks/dto/create-task.dto.ts"
Task T059: "Create UpdateTaskDto in src/modules/tasks/dto/update-task.dto.ts"
Task T060: "Create MoveTaskDto in src/modules/tasks/dto/move-task.dto.ts"
Task T061: "Create AssignTaskDto in src/modules/tasks/dto/assign-task.dto.ts"

# After service is ready (T063), create gateway and controller in parallel:
Task T066: "Create BoardGateway in src/modules/tasks/board.gateway.ts"
Task T071: "Create TasksController in src/modules/tasks/tasks.controller.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 + 3 Only)

1. Complete Phase 1: Setup (T001-T010)
2. Complete Phase 2: Foundational (T011-T031) ⚠️ CRITICAL - blocks all stories
3. Complete Phase 3: User Story 1 (T032-T044) - Organizations ready
4. Complete Phase 4: User Story 2 (T045-T057) - Projects ready
5. Complete Phase 5: User Story 3 (T058-T075) - Tasks & Kanban ready
6. **STOP and VALIDATE**: Test all three stories independently
7. Deploy/demo MVP (org creation → project setup → task management)

### Incremental Delivery

1. Setup + Foundational → Foundation ready (T001-T031)
2. Add User Story 1 → Test independently → Deploy (org management works)
3. Add User Story 2 → Test independently → Deploy (project management works)
4. Add User Story 3 → Test independently → Deploy (task/Kanban works) **← MVP COMPLETE**
5. Add User Story 4 → Test independently → Deploy (documents work)
6. Add Polish → Final release

### Parallel Team Strategy

With 3-4 developers:

1. **Together**: Complete Setup (T001-T010) + Foundational (T011-T031)
2. **Once Foundational done**:
   - Developer A: User Story 1 (T032-T044)
   - Developer B: User Story 2 (T045-T057)
3. **After US2 done**:
   - Developer C: User Story 3 (T058-T075) - depends on US2
   - Developer D: User Story 4 (T076-T090) - depends on US2
4. **Final**: Polish together (T091-T101)

---

## Notes

- **[P]** tasks marked for parallel execution work on different files with no dependencies
- **[Story]** labels (US1-US4) map tasks to user stories for traceability
- Each user story phase is independently completable and testable
- **MVP = US1 + US2 + US3** (Organization → Projects → Tasks)
- **User Story 4** (Documents) is P2 priority, can be deferred after MVP validation
- Commit after each task or logical group for easier rollback
- Stop at any checkpoint to validate story independently before proceeding
- Validate edge cases throughout implementation, not just at end
- All tasks assume NestJS project structure per plan.md (src/modules/, src/core/)
