# syntax=docker/dockerfile:1.19@sha256:b6afd42430b15f2d2a4c5a02b919e98a525b785b1aaff16747d2f623364e39b6
FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY scripts/patch-redocly-minimatch.mjs ./scripts/patch-redocly-minimatch.mjs
RUN npm ci --no-audit --no-fund
COPY tsconfig.json vite.config.ts index.html ./
COPY Dockerfile ./
COPY .github/workflows/repository-guard.yml ./.github/workflows/repository-guard.yml
COPY contracts ./contracts
COPY scripts ./scripts
COPY deploy ./deploy
COPY src ./src
COPY tests ./tests
RUN npm run verify

FROM nginxinc/nginx-unprivileged:stable-alpine@sha256:44e36330f74d4f3a1d4e222acca9e23b401fb87811a7597024502bb759c4dd49
COPY deploy/default.conf.template /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 CMD wget -q -T 2 -O /dev/null http://127.0.0.1:8080/healthz || exit 1
