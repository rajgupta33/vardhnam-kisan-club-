# ADR 0001 - Initial Architecture

## Status

Accepted

## Context

Vardhnam Agrotech requires a managed B2B2C agriculture marketplace with distinct seller-of-record, catalogue-owner, marketplace-operator, partner and service-provider responsibilities.

## Decision

Use a modular monorepo with:

- NestJS backend API
- PostgreSQL primary database
- Prisma ORM
- Redis foundation for queues, rate limiting and idempotency support
- Next.js role-based business web portal
- Flutter farmer mobile application
- Flutter partner mobile application
- Shared packages for types, validation, API client generation and design tokens
- Docker Compose for local PostgreSQL and Redis
- GitHub Actions CI

## Consequences

The MVP can evolve through reviewable vertical slices. Shared contracts reduce duplicate frontend/backend type definitions. One business portal avoids prematurely splitting admin, company and distributor surfaces.

## Explicit Non-Decisions

Phase 0 does not implement catalogue, checkout, payment, delivery, finance, settlement, real SMS, real WhatsApp, real email, real payment provider or real Tally write-back.
