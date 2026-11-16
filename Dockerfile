# syntax=docker/dockerfile:1

# ---- build: Vite bakes every VITE_* value into the files at build time ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# Defaults to Minikube local ingress URLs so builds without explicit args connect to the real backend.
# An empty VITE_API_URL (docker-compose.yml passes one) = the API is /api on this site, which nginx forwards to API_UPSTREAM.
ARG VITE_API_URL="http://api.lms.minikube.local"
ARG VITE_SLACK_URL=""
ARG VITE_GITLAB_URL=""
ARG VITE_OFFICE_TOUR_URL="http://office.minikube.local"
ENV VITE_API_URL=$VITE_API_URL \
    VITE_SLACK_URL=$VITE_SLACK_URL \
    VITE_GITLAB_URL=$VITE_GITLAB_URL \
    VITE_OFFICE_TOUR_URL=$VITE_OFFICE_TOUR_URL
RUN npm run build

# ---- dev: the Vite dev server with hot reload (used by the "dev" profile of docker-compose.yml) ----
FROM node:22-alpine AS dev
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]

# ---- serve: static files with a fallback to index.html for the app's own routes ----
# Kept last, so a plain `docker build` (no --target) builds this image.
FROM nginx:1.27-alpine AS web
# a template: the nginx image fills in ${API_UPSTREAM} when the container starts
COPY nginx.conf /etc/nginx/templates/default.conf.template
# nginx looks this host up when it starts and will not start if the lookup fails, so the default is an address that
# needs no lookup. docker-compose.yml sets the real one; in Kubernetes set it to the API service (or ignore it when
# VITE_API_URL is a full address).
ENV API_UPSTREAM=http://127.0.0.1:8080
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
