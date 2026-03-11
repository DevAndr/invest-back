FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json yarn.lock ./
RUN npm install --frozen-lockfile
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
RUN npm run build

FROM node:22-alpine AS production
WORKDIR /app
RUN apk add --no-cache openssl chromium nss freetype harfbuzz ca-certificates ttf-freefont
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
COPY package.json yarn.lock ./
RUN npm install --frozen-lockfile --production
# generate снова в production стейдже — кладёт в node_modules/.prisma/client
COPY prisma ./prisma
RUN npx prisma generate
COPY --from=builder /app/dist ./dist
EXPOSE 3030
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]
