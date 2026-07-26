# syntax=docker/dockerfile:1.19@sha256:b6afd42430b15f2d2a4c5a02b919e98a525b785b1aaff16747d2f623364e39b6
FROM node:22.23.1-alpine3.23@sha256:8516dce0483394d5708d4b2ee6cacb79fb1d617ea4e2787c2120bcca92ce372e AS build

WORKDIR /workspace
ENV NODE_ENV=development
ENV CUSTOMS_ENHANCED_AGENT_EXPERIENCE=true
ENV CUSTOMS_UAT_ADAPTIVE_ACTIVE=true
RUN chown node:node /workspace

COPY --chown=node:node package.json package-lock.json .npmrc ./
COPY --chown=node:node scripts/patch-redocly-minimatch.mjs ./scripts/patch-redocly-minimatch.mjs
USER node
RUN npm ci --no-audit --no-fund

COPY --chown=node:node index.html tsconfig.json vite.config.ts ./
COPY --chown=node:node src ./src
COPY --chown=node:node scripts ./scripts
ENV NODE_ENV=production
RUN npm run build:uat

FROM nginxinc/nginx-unprivileged:stable-alpine@sha256:44e36330f74d4f3a1d4e222acca9e23b401fb87811a7597024502bb759c4dd49

LABEL org.opencontainers.image.title="Customs Frontend LOCAL USER UAT" \
      org.opencontainers.image.description="Diagnostic text-only built workbench; never a Production artifact" \
      com.customs.runtime="local-user-uat-diagnostic" \
      com.customs.production="false" \
      com.customs.auto-completion="off"

ENV NGINX_ENVSUBST_FILTER="BACKEND_ORIGIN|OIDC_BACKEND_ORIGIN"

COPY --from=build /workspace/dist /usr/share/nginx/html
COPY deploy/uat/default.conf.template /etc/nginx/templates/default.conf.template
COPY --chmod=755 deploy/uat/entrypoint.sh /docker-entrypoint.d/10-validate-customs-uat-origins.sh

EXPOSE 5173
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -T 2 -O /dev/null http://127.0.0.1:5173/healthz || exit 1
