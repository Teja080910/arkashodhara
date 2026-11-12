# syntax=docker/dockerfile:1.7
ARG APP=api
FROM node:24-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/auth/package.json apps/auth/
COPY libs/common/package.json libs/common/
COPY libs/contracts/package.json libs/contracts/
COPY libs/db/package.json libs/db/
COPY libs/authz/package.json libs/authz/
COPY libs/storage/package.json libs/storage/
RUN npm ci --workspaces --include-workspace-root --no-audit --no-fund

FROM deps AS build
ARG APP
COPY libs libs
COPY apps apps
COPY deploy deploy
RUN npm run build -w @platform/common -w @platform/contracts -w @platform/db -w @platform/authz -w @platform/storage
# Build both entrypoints so the single runtime image works for APP=auth and APP=api.
RUN npm run build -w @platform/api
RUN npm run build -w @platform/auth

FROM node:24-alpine AS runner
ARG APP
ENV NODE_ENV=production
ENV PLATFORM_APP=$APP
WORKDIR /repo
COPY --from=deps /repo/node_modules node_modules
COPY --from=build /repo/package.json package.json
COPY --from=build /repo/libs libs
COPY --from=build /repo/apps/api/package.json apps/api/
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY --from=build /repo/apps/api/migrations apps/api/migrations
COPY --from=build /repo/apps/auth/package.json apps/auth/
COPY --from=build /repo/apps/auth/dist apps/auth/dist
COPY --from=build /repo/deploy/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh \
  && addgroup -S platform \
  && adduser -S platform -G platform \
  && chown -R platform:platform /repo
USER platform
WORKDIR /repo
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
