# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html tsconfig.json vite.config.ts ./
COPY src/ src/
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.27-alpine
ENV API_UPSTREAM="" \
    ORGANIZER_UPSTREAM="" \
    SURVEY_UPSTREAM="" \
    NGINX_ENVSUBST_FILTER="^(API_UPSTREAM|ORGANIZER_UPSTREAM|SURVEY_UPSTREAM)$"
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/ /usr/share/nginx/html/
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
