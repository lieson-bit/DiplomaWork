# Dockerfile
FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache python3 make g++ curl

# Copy package files
COPY package*.json ./
RUN rm -f package-lock.json

# Install dependencies
RUN npm install --no-audit

# Copy source code
COPY . .

# Create uploads directory
RUN mkdir -p /app/src/uploads
RUN mkdir -p /app/logs
RUN chmod -R 755 /app/logs

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3002/health', (r) => {if(r.statusCode!==200)throw new Error()})"

# Start the application
CMD ["npm", "start"]