# syntax=docker/dockerfile:1.19@sha256:b6afd42430b15f2d2a4c5a02b919e98a525b785b1aaff16747d2f623364e39b6
FROM node:22.23.1-alpine3.23@sha256:8516dce0483394d5708d4b2ee6cacb79fb1d617ea4e2787c2120bcca92ce372e

LABEL org.opencontainers.image.title="Customs Frontend LOCAL USER UAT" \
      org.opencontainers.image.description="Diagnostic text-only Vite workbench; never a Production artifact" \
      com.customs.runtime="local-user-uat-diagnostic" \
      com.customs.production="false" \
      com.customs.auto-completion="off"

WORKDIR /workspace
ENV NODE_ENV=development
RUN chown node:node /workspace

COPY --chown=node:node package.json package-lock.json .npmrc ./
USER node
RUN npm ci --no-audit --no-fund

COPY --chown=node:node index.html tsconfig.json vite.config.ts ./
COPY --chown=node:node src ./src
COPY --chown=node:node deploy/uat/entrypoint.sh /workspace/deploy/uat/entrypoint.sh

EXPOSE 5173
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:5173/').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

ENTRYPOINT ["/bin/sh", "/workspace/deploy/uat/entrypoint.sh"]
