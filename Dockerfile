# syntax=docker/dockerfile:1

# ---- build: Vite bakes every VITE_* value into the files at build time ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# Empty VITE_API_URL = the built-in demo store (no backend needed).
ARG VITE_API_URL=""
ARG VITE_SLACK_URL=""
ARG VITE_GITLAB_URL=""
ARG VITE_OFFICE_TOUR_URL=""
ENV VITE_API_URL=$VITE_API_URL \
    VITE_SLACK_URL=$VITE_SLACK_URL \
    VITE_GITLAB_URL=$VITE_GITLAB_URL \
    VITE_OFFICE_TOUR_URL=$VITE_OFFICE_TOUR_URL
RUN npm run build

# ---- serve: static files with a fallback to index.html for the app's own routes ----
FROM nginx:1.27-alpine AS web
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1

# ---- dev: the Vite dev server with hot reload (used by the "dev" profile of docker-compose.yml) ----
FROM node:22-alpine AS dev
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
