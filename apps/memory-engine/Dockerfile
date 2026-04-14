FROM node:20-alpine

# Install build tools required by better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy workspace manifests first for layer caching
COPY package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/shared/index.js     ./packages/shared/
COPY packages/shared/constants.js ./packages/shared/
COPY packages/shared/growthRingSchema.json ./packages/shared/
COPY packages/types/package.json  ./packages/types/
COPY packages/types/index.js      ./packages/types/

COPY apps/memory-engine/package.json ./apps/memory-engine/

RUN npm install --workspace=apps/memory-engine --include-workspace-root

COPY apps/memory-engine/server.js ./apps/memory-engine/

WORKDIR /app/apps/memory-engine

EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001
ENV DB_PATH=/data/seedmind.db

VOLUME ["/data"]

CMD ["node", "server.js"]
