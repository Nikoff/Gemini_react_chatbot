FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma/
RUN npx prisma generate

COPY . .

EXPOSE 8080

CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
