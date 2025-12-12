## STAGE 1 ##################################
FROM node:24-alpine AS build

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
RUN npm run build

## STAGE 2 ##################################
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY .docker/nginx.conf /etc/nginx/conf.d/default.conf

# expose logs to kube
RUN unlink /var/log/nginx/access.log
RUN unlink /var/log/nginx/error.log

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
