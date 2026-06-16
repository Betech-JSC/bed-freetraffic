FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build TypeScript code to JavaScript
RUN npm run build

EXPOSE 4000

# Run migrations and start Express API server
CMD ["sh", "-c", "npx prisma db push && node dist/src/index.js"]
