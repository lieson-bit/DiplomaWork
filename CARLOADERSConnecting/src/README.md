# DeliveryMatch

## Overview

DeliveryMatch is a comprehensive goods delivery platform that connects drivers (car owners) with customers (shippers) who need to transport goods. It functions like "Uber for goods" where drivers register with their vehicle details, capacity limits, and service categories, while customers can book single deliveries or upload Excel sheets for bulk business shipments.

## Key Features

- **Intelligent Matching Engine**: AI-powered system that considers vehicle capacity, location proximity, and route optimization
- **Multi-Customer Assignment**: Assigns multiple customers to the same driver when possible (like UberPool for packages)
- **Driver Management**: Availability management, vehicle details, and capacity tracking
- **Real-Time Tracking**: Live GPS updates and order status tracking
- **Route Optimization**: Turn-by-turn directions, delivery sequence, and estimated times
- **Bulk Orders**: Upload Excel sheets for multiple deliveries
- **Capacity Checking**: Weight and volume verification
- **Multi-Language Support**: English and Russian

## Project Structure

```
/
├── App.tsx                     # Main application entry point
├── main.tsx                    # ReactDOM entry point
├── index.css                   # Base styles  
├── styles/
│   └── globals.css             # Global styles and Tailwind configuration
├── components/                 # All React components
│   ├── ui/                    # Shadcn UI components library
│   ├── shared/                # Shared components (StatusBar)
│   ├── LandingPage.tsx        # Landing/marketing page
│   ├── AuthPage.tsx           # Authentication
│   ├── DriverDashboard.tsx    # Driver main dashboard
│   ├── DriverProfile.tsx      # Driver profile management
│   ├── DriverEarnings.tsx     # Driver earnings & payments
│   ├── DriverRouteOptimization.tsx  # Route optimization with turn-by-turn
│   ├── DriverOnboarding.tsx   # New driver registration
│   ├── CustomerBooking.tsx    # Single order booking
│   ├── CustomerProfile.tsx    # Customer profile management
│   ├── CustomerOnboarding.tsx # New customer registration
│   ├── BulkBooking.tsx        # Bulk order Excel upload
│   ├── OrderTracking.tsx      # Real-time order tracking
│   ├── MatchingEngine.tsx     # Driver-customer matching
│   ├── NotificationCenter.tsx # Notifications management
│   ├── DeliveryCompletion.tsx # Delivery confirmation
│   ├── LanguageContext.tsx    # i18n context provider
│   └── LanguageSelector.tsx   # Language switcher
├── src/
│   ├── config/
│   │   └── environment.ts     # Environment configuration
│   ├── lib/
│   │   ├── api.ts            # API client
│   │   ├── api-client.ts     # Base API client setup
│   │   └── seed-data.ts      # Mock data seeding
│   ├── services/              # API service layers
│   │   ├── customer.service.ts
│   │   ├── driver.service.ts
│   │   ├── matching.service.ts
│   │   ├── notification.service.ts
│   │   ├── order.service.ts
│   │   ├── payment.service.ts
│   │   ├── tracking.service.ts
│   │   ├── user.service.ts
│   │   └── index.ts
│   ├── shared/
│   │   ├── constants/
│   │   │   └── app.ts        # Application constants
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   ├── useNotifications.ts
│   │   │   └── index.ts
│   │   └── utils/
│   │       ├── format.ts     # Formatting utilities
│   │       ├── validation.ts # Validation utilities
│   │       └── index.ts
│   └── types/
│       └── index.ts           # TypeScript type definitions
├── pages/                     # Alternative page-based structure
│   ├── common/
│   ├── customer/
│   └── driver/
└── README.md
```

## Tech Stack

- **React** - UI Framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Shadcn/UI** - Component library
- **Lucide React** - Icons
- **Recharts** - Charts and graphs
- **React Hook Form** - Form management
- **Sonner** - Toast notifications

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Build for production:
```bash
npm run build
```

## User Roles

### Drivers
- Register with vehicle details and capacity limits
- Manage availability status
- Accept and complete orders
- View optimized routes with turn-by-turn directions
- Track earnings and payment history
- Maintain profile and documents

### Customers
- Create single or bulk delivery requests
- Upload Excel files for bulk orders
- Track deliveries in real-time
- Manage saved addresses
- View order history
- Configure notification preferences

## Core Functionality

### Matching Engine
The intelligent matching system considers:
- Vehicle capacity (weight and volume)
- Location proximity
- Route optimization
- Driver availability
- Service categories

### Route Optimization
- Multi-stop route planning
- Turn-by-turn directions
- Delivery sequence optimization
- Estimated arrival times
- Real-time capacity tracking
- Distance and duration calculations

### Order Management
- Single and bulk order creation
- Excel upload for business customers
- Real-time status updates
- Capacity verification
- Price calculation based on distance, weight, volume, and vehicle type

## Development Notes

- All components use TypeScript for type safety
- Tailwind CSS is configured in v4.0 (no config file needed)
- Global styles and design tokens are in `/styles/globals.css`
- Protected system file: `/components/figma/ImageWithFallback.tsx`
- Mock data is seeded automatically on app mount
- Multi-language support via LanguageContext

## Future Enhancements

- Backend API integration
- Real payment processing
- Actual GPS tracking integration
- Push notifications
- Driver ratings and reviews
- Advanced analytics dashboard
- Mobile app versions
