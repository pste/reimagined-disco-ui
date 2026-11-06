## STAGE 1 ##################################
FROM node:24.22.2-alpine AS build

# SETUP npm
RUN npm config set engine-strict true
RUN npm install -g npm@latest

# INSTALL PACKAGES
WORKDIR /app
ENV NODE_ENV=PRODUCTION
COPY package*.json .
RUN npm ci

# INSTALL APP
COPY . .

# VITE BUILD
ENV NODE_ENV=production
ARG VITE_APP_VERSION=dev
ENV VITE_APP_VERSION=$VITE_APP_VERSION
RUN npm run build

## STAGE 2 ##################################
#FROM nginx:alpine
FROM nginx/nginx-unprivileged:1.31.8-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY .docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
