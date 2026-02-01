# Gerensee Backend

**Gerensee** is a stripped-down project management tool focused on clarity, simplicity, and low cognitive overhead.

This repository contains the backend application, built with **Node.js** and **Prisma**, and designed to support a simple multi-tenant project management domain.

---

## Tech Stack

- **Node.js** 
- **NestJS**
- **Prisma ORM**
- **PostgreSQL** 
- **pnpm** 

---

## Getting Started

### Requirements
- Node.js
- pnpm (`@10.28.1`)

### Install dependencies
```bash
pnpm install
```
## Local database setup

### Start PostgreSQL with Docker Compose
```bash
docker compose up -d
```

### Apply migrations
```bash
pnpm prisma:migrate:dev
```

### Generate Prisma Client
```bash
pnpm prisma:generate
```

### Seed the database
```bash
pnpm prisma:seed
```

## Running application locally

```bash
pnpm start:dev
```

