
# --- Bun build stages ---
FROM oven/bun:1 AS base
WORKDIR /usr/src/app

FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lock /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

RUN mkdir -p /temp/prod
COPY package.json bun.lock /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production

FROM base AS build
COPY --from=install /temp/dev/node_modules node_modules
COPY . .
ENV NODE_ENV=production
RUN bun run build

# --- Node.js runtime stage ---
FROM node:24-alpine AS release
WORKDIR /usr/src/app
COPY --from=install /temp/prod/node_modules ./node_modules
COPY --from=build /usr/src/app/build ./build
COPY package.json ./
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npx", "react-router-serve", "./build/server/index.js"]