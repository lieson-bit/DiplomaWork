#!/bin/bash
# Copy schema files to volumes
echo "Initializing database schemas..."

# Create directories if they don't exist
mkdir -p ./init-scripts/driver
mkdir -p ./init-scripts/customer

# Copy driver schema
if [ -f "./microservices/driver-service/sql/schema.sql" ]; then
  cp "./microservices/driver-service/sql/schema.sql" "./init-scripts/driver/01-schema.sql"
  echo "Copied driver schema"
fi

# Copy customer schema
if [ -f "./microservices/customer-service/src/sql/schema.sql" ]; then
  cp "./microservices/customer-service/src/sql/schema.sql" "./init-scripts/customer/01-schema.sql"
  echo "Copied customer schema"
fi