FROM node:18-alpine

WORKDIR /app

# Install dependencies needed for mysql2
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Delete package-lock.json if it exists (in case it's outdated)
RUN rm -f package-lock.json

# Install dependencies (use npm install instead of npm ci)
RUN npm install --no-audit

# Copy source code
COPY . .

# Create necessary directories
RUN mkdir -p /app/logs

# Expose port
EXPOSE 3001

# Use development mode for hot reload
CMD ["npm", "run", "dev"]