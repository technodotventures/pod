FROM node:24-bookworm-slim AS build

WORKDIR /app/coffee-pod
COPY package.json package-lock.json ./
COPY vendor ./vendor
RUN npm ci

COPY . .
RUN npm run build:all
RUN npm prune --omit=dev

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV COFFEE_POD_HOST=0.0.0.0
ENV COFFEE_POD_PORT=8732
ENV COFFEE_POD_DATA_DIR=/data

WORKDIR /app/coffee-pod

COPY --from=build /app/coffee-pod/package*.json ./
COPY --from=build /app/coffee-pod/node_modules ./node_modules
COPY --from=build /app/coffee-pod/vendor ./vendor
COPY --from=build /app/coffee-pod/dist ./dist
COPY --from=build /app/coffee-pod/dist-ui ./dist-ui
COPY --from=build /app/coffee-pod/scripts ./scripts
COPY --from=build /app/coffee-pod/docs ./docs

VOLUME ["/data"]
EXPOSE 8732

CMD ["node", "dist/server.js"]
