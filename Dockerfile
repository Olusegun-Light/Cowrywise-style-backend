# ===============================
# 1) Build stage
# ===============================
FROM node:20-bullseye AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ENV DATABASE_URL="postgresql://user:pass@localhost:5432/placeholder" \
    REDIS_URL="redis://localhost:6379" \
    JWT_SECRET="build-time-placeholder-not-a-real-secret-32ch" \
    PAYSTACK_SECRET_KEY="build-time-placeholder" \
    MAILTRAP_HOST="localhost" \
    MAILTRAP_PORT="2525" \
    MAILTRAP_USER="placeholder" \
    MAILTRAP_PASS="placeholder"

RUN npx prisma generate
RUN npm run build

# ===============================
# 2) Runtime stage
# ===============================
FROM node:20-bullseye

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=build /app/dist ./dist
COPY --from=build /app/emailTemplates ./emailTemplates

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
