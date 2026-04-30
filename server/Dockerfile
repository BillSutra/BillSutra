FROM node:20-bookworm-slim AS builder

WORKDIR /app

COPY package*.json ./
COPY server/package*.json ./server/

RUN npm ci

COPY server ./server

WORKDIR /app/server
RUN npx prisma generate
RUN npm run build

FROM node:20-bookworm-slim AS runner

ENV NODE_ENV=production
WORKDIR /app/server

COPY --from=builder /app/package*.json /app/
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/server/package*.json ./
COPY --from=builder /app/server/dist ./dist
COPY --from=builder /app/server/prisma ./prisma

EXPOSE 8000

CMD ["node", "dist/index.js"]
