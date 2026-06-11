# INAN Feedback — Technical Manual

**Version:** 2.0
**Date:** June 2026
**Audience:** Internal Developers & Business Stakeholders
**Status:** Living Document

---

## About This Manual

This manual documents the INAN Feedback platform in full. It is split into focused sections so that both business stakeholders and developers can find what they need without reading everything.

**If you are a business stakeholder**, the _Business Overview_ sections in each document explain what the platform does and how it works in plain language.

**If you are a developer**, the _Technical Detail_ sections cover implementation, data structures, architecture decisions, and configuration.

---

## Documents

| # | File | What It Covers |
|---|---|---|
| 1 | [Overview and Stack](./01-overview-and-stack.md) | What the product is, who it's for, the three user types, tech stack, third-party services |
| 2 | [Architecture](./02-architecture.md) | How the system is wired together, request lifecycle, multi-tenancy, branding system, impersonation |
| 3 | [Data Architecture](./03-data-architecture.md) | What data is stored, Firestore collections, field schemas, security rules |
| 4 | [Features](./04-features.md) | Every user-facing feature — what it does, how to use it, how it is built |
| 5 | [Setup and Configuration](./05-setup-and-configuration.md) | Environment variables, Firebase setup, deployment, tenant onboarding, admin scripts |
| 6 | [Reference](./06-reference.md) | API routes, component library, hooks, known limits |

---

## Quick Links

- Setting up a new tenant → [Setup and Configuration § Tenant Onboarding](./05-setup-and-configuration.md#tenant-onboarding)
- Environment variables → [Setup and Configuration § Environment Variables](./05-setup-and-configuration.md#environment-variables)
- Creating a feedback form → [Features § Form Builder](./04-features.md#form-builder)
- Super Admin panel → [Features § Super Admin](./04-features.md#super-admin)
- API routes reference → [Reference § API Routes](./06-reference.md#api-routes)
- Tag engine logic → [Features § Auto-Tagging](./04-features.md#auto-tagging)

---

_Maintained by the INAN Feedback development team. Update the relevant section file whenever a feature is added, an API route changes, or a data structure is modified._
