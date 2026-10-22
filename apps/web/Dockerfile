FROM node:22-bookworm-slim AS build

WORKDIR /src

COPY apps/web/package.json apps/web/package-lock.json ./apps/web/
WORKDIR /src/apps/web
RUN npm ci

COPY apps/web ./
RUN npm run build

FROM nginx:1.28-alpine

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/apps/web/dist /usr/share/nginx/html

EXPOSE 80
