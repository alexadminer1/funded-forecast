# Project State

## Overview
This is a **prediction market platform** built with **Next.js**. The app is approximately **60% ready**.

## Tech Stack
- **Frontend / App**: Next.js (App Router)
- **Database / ORM**: Prisma
- **Backend services**: Supabase (Postgres + Auth)

## Current Focus
The primary focus is **backend/domain logic**, not UI polish.

Examples of in-scope work:
- Market lifecycle (create/open/resolve/cancel)
- Order matching / share accounting (or AMM logic, depending on implementation)
- Payouts/settlement and dispute/edge-case handling
- Data integrity (transactions, constraints) and security (RLS, authorization)

## Non-goals (for now)
- UI redesigns, component polish, animations, and visual refinements
