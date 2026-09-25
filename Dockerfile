# API image for hosting (Render, Fly, any Docker host). Build from the repo root.
FROM node:24-bookworm-slim

ENV CI=true \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
# tini reaps the Chromium processes the renderer closes (Node as PID 1 would leave zombies).
RUN apt-get update && apt-get install -y --no-install-recommends tini && rm -rf /var/lib/apt/lists/* \
    && npm install -g pnpm@12.6.0
WORKDIR /app

# Dependencies first, so code changes don't reinstall them.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/snippet/package.json packages/snippet/
RUN pnpm install --frozen-lockfile --filter api...
# Only the headless shell: the renderer never needs a headed browser.
RUN pnpm --filter api exec playwright install --with-deps --only-shell chromium

COPY tsconfig.base.json ./
COPY packages packages
COPY apps/api apps/api
RUN pnpm --filter @uplift/shared --filter @uplift/snippet build && pnpm --filter api build

ENV NODE_ENV=production
WORKDIR /app/apps/api
USER node
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["sh", "-c", "node dist/db/migrate.js && exec node dist/main.js"]
