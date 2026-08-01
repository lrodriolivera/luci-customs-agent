# LUCI frontend — React + Vite. Build estático servido por nginx que proxea /api al backend.
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci || npm install
COPY . .
# VITE_API_URL vacío → rutas relativas (nginx proxea /api al backend por el mismo dominio)
ENV VITE_API_URL=""
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
