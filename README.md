# Uplift

AI-assisted conversion rate optimization. Point Uplift at a page, pick the elements that matter (headline, CTA, benefits…), describe your brand and legal guardrails, and it generates on-brand copy variants, previews them on the live page and runs A/B experiments to find the winner.

> Personal portfolio project. Work in progress — see the [functional spec](docs/SPEC.md) and roadmap.

## Stack

| Layer   | Tech                                                                                                                |
| ------- | ------------------------------------------------------------------------------------------------------------------- |
| Web     | React 19, Vite, TypeScript, Tailwind CSS 4, shadcn/ui, TanStack Query, React Router, react-hook-form, react-i18next |
| API     | NestJS 12 (ESM + SWC), Drizzle ORM, PostgreSQL, argon2                                                              |
| Shared  | zod schemas shared by web and API (`packages/shared`)                                                               |
| Tooling | pnpm workspaces, Docker Compose, GitHub Actions                                                                     |

## Getting started

Requirements: Node 22+, pnpm 10+ and Docker.

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
pnpm db:up        # Postgres + Redis
pnpm db:migrate   # apply migrations
pnpm dev          # web on :5173, API on :3000
```

## Project layout

```
apps/
  web/        React SPA
  api/        NestJS API
packages/
  shared/     zod schemas and types shared by web and API
docs/
  SPEC.md     functional specification and roadmap
```

## Security notes

- Sessions are opaque random tokens in an httpOnly cookie; only their SHA-256 hash is stored.
- Every API route requires a session unless explicitly marked `@Public()`.
- Passwords are hashed with argon2; login is rate limited and timing-safe for unknown emails.
