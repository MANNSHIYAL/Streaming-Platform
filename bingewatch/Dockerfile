# Stage 1: Build the Angular App
FROM node:20 AS build
WORKDIR /app

# Install dependency files first to lock build layers
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy full application code and run production build flags
COPY . .
RUN npm run build -- --configuration=production

# Stage 2: Minimalist distribution volume holder
FROM alpine:latest
WORKDIR /dist
# Copy raw index/assets out of the node build stage into this minimal shell folder
# ⚠️ Note: Adjust 'your-app-name/browser' to match your exact directory structure in Angular 17+
COPY --from=build /app/dist/bingewatch/browser .
