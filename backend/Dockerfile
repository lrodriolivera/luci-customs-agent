# LUCI backend — Express (Node). Puerto 5001. Bedrock + MongoDB + AEAT (cert FNMT montado en /app/certs).
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev
COPY . .
EXPOSE 5001
CMD ["node", "src/app.js"]
