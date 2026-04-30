FROM node:20-bookworm-slim AS builder

WORKDIR /app

COPY package*.json ./
COPY front-end/package*.json ./front-end/

RUN npm ci

COPY front-end ./front-end

WORKDIR /app/front-end
RUN npm run build

FROM node:20-bookworm-slim AS runner

ENV NODE_ENV=production
WORKDIR /app/front-end

COPY --from=builder /app/front-end/public ./public
COPY --from=builder /app/front-end/.next/standalone ./
COPY --from=builder /app/front-end/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
