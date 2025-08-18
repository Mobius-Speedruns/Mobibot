# Use Node.js LTS
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Expose port (if needed)
EXPOSE 3000

# Default command
CMD ["node", "dist/app.js"]
