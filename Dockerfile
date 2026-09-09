FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build \
    && test -f /app/dist/server/wrangler.json


FROM node:22-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV KCA_PORT=3001

COPY --from=build --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/drizzle ./drizzle
COPY --from=build --chown=node:node /app/scripts ./scripts
COPY --from=build --chown=node:node /app/ecosystem.config.cjs ./ecosystem.config.cjs

RUN test -f /app/dist/server/wrangler.json \
    && mkdir -p /app/.wrangler/state \
    && chown -R node:node /app

USER node

EXPOSE 3001

CMD ["sh", "-c", "npm run db:migrate:local && exec ./node_modules/.bin/pm2-runtime ecosystem.config.cjs --update-env"]
