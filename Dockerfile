FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY apps ./apps
RUN npm run build --if-present

FROM node:22-bookworm-slim

WORKDIR /app

ARG GIT_SHA=unknown
ENV GIT_SHA=${GIT_SHA} \
    NODE_ENV=production \
    PACK=poster-meteor

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/apps ./apps

EXPOSE 3000

USER node

CMD ["node", "apps/api/dist/index.js"]
