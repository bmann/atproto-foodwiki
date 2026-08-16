# FoodWiki web app — static Vite SPA. Server: nginx (also serves the SPA
# fallback so /user/<did> deep links work without server-side routing).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
COPY packages packages/
# Install workspace deps (symlink @foodwiki/* packages locally)
RUN npm ci --workspaces=false && npm ci
# Build the web app (and let npm wire workspace deps)
RUN npm run build -w @foodwiki/web

FROM nginx:1.27-alpine
# SPA fallback config for client-side routing
COPY deploy/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/packages/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
