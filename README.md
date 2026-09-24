# Uplift

AI-assisted conversion rate optimization. Point Uplift at a page, pick the elements that matter (headline, CTA, benefits…), describe your offer, audience and brand rules, and it generates on-brand copy variants, previews them on the live page and runs A/B experiments to find the winner.

> Personal portfolio project. Work in progress — see the [functional spec](docs/SPEC.md) and roadmap.

## Stack

| Layer   | Tech                                                                                                                |
| ------- | ------------------------------------------------------------------------------------------------------------------- |
| Web     | React 19, Vite, TypeScript, Tailwind CSS 4, shadcn/ui, TanStack Query, React Router, react-hook-form, react-i18next |
| API     | NestJS 12 (ESM + SWC), Drizzle ORM, PostgreSQL, argon2, Playwright, Anthropic SDK (Claude)                          |
| Shared  | zod schemas shared by web and API (`packages/shared`)                                                               |
| Tooling | pnpm workspaces, Docker Compose, GitHub Actions                                                                     |

## Getting started

Requirements: Node 22+, pnpm 10+ and Docker.

```bash
cp apps/api/.env.example apps/api/.env
pnpm bootstrap   # install deps, headless Chromium, start Postgres + Redis, run migrations
pnpm dev         # web on :5173, API on :3000
pnpm test        # unit tests
```

## AI copy generation

Variants are written by Claude (`claude-opus-5` by default) through the Anthropic SDK, with
structured outputs validated by zod and server-side refusal fallbacks enabled. Set
`ANTHROPIC_API_KEY` in `apps/api/.env` to use it; without a key the app runs in **demo mode** with a
template-based mock provider, so everything works end to end at no cost. `AI_MODEL`, `AI_EFFORT`
and `AI_PROVIDER` (`auto` | `anthropic` | `mock`) tune it.

Every variant, AI-written or manual, goes through a deterministic rules review (banned words,
off-limits promises, length limits) based on the project brief; the model is told the rules but is
never trusted to police itself.

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

## Deployment

`render.yaml` is a Render Blueprint for the free tier:

- **API**: Docker web service built from `Dockerfile` (Node 24 + Chromium headless shell). It
  applies pending migrations on start. The free instance sleeps after 15 minutes idle and takes
  about a minute to wake; the web app shows a notice meanwhile and retries.
- **Web**: static site. It rewrites `/api/*` to the API, so the session cookie stays first-party.
- **Database**: any Postgres; the Blueprint asks for `DATABASE_URL` (a free Neon database works
  and, unlike Render's free Postgres, does not expire).

On 512 MB the snapshot browser renders one page at a time and closes when idle; a heavy page
peaks around 400 MB.

## Security notes

- Sessions are opaque random tokens in an httpOnly cookie; only their SHA-256 hash is stored.
- Every API route requires a session unless explicitly marked `@Public()`.
- Passwords are hashed with argon2; login is rate limited and timing-safe for unknown emails.
- Page snapshots (visual element picker): the headless browser can only reach the network through
  a local pinned proxy that resolves each host once, allows only public addresses and connects to
  exactly the address it checked, which also defeats DNS rebinding. Snapshots are
  stripped of scripts, served with a strict CSP (`sandbox allow-scripts`, nonce-only scripts) and
  shown in a sandboxed iframe with an opaque origin, talking to the app only via `postMessage`.
