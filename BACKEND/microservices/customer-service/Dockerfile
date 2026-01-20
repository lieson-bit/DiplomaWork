FROM node:18-alpine

WORKDIR /app

# Install curl for health checks and python3 for some dependencies
RUN apk add --no-cache curl python3 make g++

# Copy package files
COPY package*.json ./

# Install dependencies (use npm install instead of npm ci)
RUN npm install --no-audit --only=production

# Copy source code
COPY . .

# Create uploads and logs directories
RUN mkdir -p src/uploads logs

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3003

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3003/health || exit 1

# Start the application
CMD ["npm", "start"]