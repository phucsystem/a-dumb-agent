FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src/ ./src/
COPY soul.md identity.md ./

EXPOSE 3000

CMD ["node", "src/index.js"]
