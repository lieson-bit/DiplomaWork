Running the user service using Docker Compose 

# 1. Navigate to your project
cd backend/microservices/user-service

# 2. Start the service (first time or after changes)
docker-compose up --build -d

# 3. Check if it's running
docker-compose ps

# 4. View logs
docker-compose logs -f user-service

# 5. Stop the service
docker-compose down

# 6. Stop and remove everything (clean reset)
docker-compose down -v


Development Mode 
# With Docker Compose (already set up - uses npm run dev)
docker-compose up --build -d

# Or locally without Docker (requires MySQL running):
npm install
npm run dev