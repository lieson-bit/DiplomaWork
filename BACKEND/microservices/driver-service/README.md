# Driver Service

A microservice for managing driver profiles, vehicles, documents, and availability in a delivery system.

## Features

- Driver profile management
- Vehicle registration and management
- Document upload and verification
- Availability scheduling
- Profile picture management
- Driver statistics and metrics

## Prerequisites

- Node.js 18+
- Docker and Docker Compose
- MySQL 8.0

## Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env`: `cp .env.example .env`
4. Update environment variables in `.env`
5. Generate Prisma client: `npm run prisma:generate`
6. Run database migrations: `npm run prisma:migrate`

## Running the Service

### Development
```bash
npm run dev