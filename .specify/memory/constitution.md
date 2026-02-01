# Gerensee Constitution

## Core Principles

### I. Product-First, Domain-Driven
Gerensee is a product, not a framework showcase.

All architectural and technical decisions must serve clear product and domain needs.
Abstractions exist only when they reduce long-term cognitive load or protect business invariants.
Domain language must be explicit and reflected consistently across code, specs, and communication.

---

### II. Multi-Tenancy by Default
Gerensee is inherently multi-tenant.

All data, actions, and permissions must be scoped to a tenant (organization) unless explicitly stated otherwise.
Cross-tenant data access is forbidden by default and must be intentionally designed and justified.
Multi-tenancy is treated as a core invariant, not an optional feature.

---

### III. Explicit Ownership and Membership
Organizations are first-class domain entities.

Every organization must have exactly one OWNER membership at creation time.
A user may belong to multiple organizations, but may be OWNER of at most one organization.
Ownership and membership rules are business invariants and must be enforced at the domain level, not only at the interface or API layer.

---

### IV. Authorization Is a Domain Concern
Authorization is not an infrastructure detail.

Access control follows an RBAC model and must be enforced where business decisions are made.
Controllers, routes, or transport layers must never be the sole line of defense.
If an operation violates authorization rules, it must be impossible to execute it through any entry point.

---

### V. Explicit Invariants Over Implicit Behavior
Business rules must be explicit, documented, and enforced.

Implicit behavior from frameworks, ORMs, or infrastructure must never be relied upon to enforce invariants.
Critical rules must be protected through transactional guarantees or equivalent consistency mechanisms.
When in doubt, favor correctness and clarity over convenience.

---

### VI. Simplicity and Intentional Complexity
Simplicity is a first-order goal.

The system should start simple and evolve only when justified by real constraints.
Complexity must always be explainable in terms of product needs, scale, or correctness.
YAGNI applies unless violating it would endanger core invariants or future evolution.

---

## Architectural Constraints

- The system is organized around domain concepts, not technical layers.
- Domain rules must not depend on delivery mechanisms (HTTP, queues, UI, etc.).
- Side effects (persistence, messaging, external services) must not leak into domain reasoning.
- Boundaries between domain, application, and infrastructure must be clear, even if lightweight.

---

## Implementation Standards

### Input Validation
All input validation must be handled declaratively using class-validator decorators on DTO classes.

- DTOs must be classes, not interfaces or plain types
- Validation rules must be explicit via decorators (@IsEmail, @MinLength, @IsNotEmpty, etc.)
- Validation must occur at the API boundary (controller layer) via ValidationPipe
- Business logic layers (services, repositories) must not perform input format validation
- Custom validation messages should be clear and actionable

Rationale: Separates transport-layer validation from domain logic, ensures consistent validation across all entry points, and leverages NestJS framework capabilities.

---

## Development and Change Process

- Every meaningful change to domain rules or invariants must be accompanied by a written specification.
- Specifications represent intent and rationale; code represents execution.
- Past decisions are preserved for historical context and traceability.
- New decisions must not silently contradict established principles.

---

## Governance

This constitution supersedes all other development guidelines and tooling-specific instructions.

Any change to the constitution must:
- Be explicit and intentional
- Include clear rationale
- Describe migration or impact when applicable

All specifications, plans, tasks, and implementations must comply with this document.
Operational guidance and tooling preferences belong in auxiliary documents, not here.

**Version**: 1.1.0  
**Ratified**: 2026-01-30  
**Last Amended**: 2026-02-01
