# DeliveryMatch Components

This directory contains all the main application components for the DeliveryMatch platform.

## Structure

### Landing Page Components (`/landing`)

The landing page is broken down into modular, reusable components:

- **Header.tsx** - Top navigation bar with logo, language selector, and CTA button
- **HeroSection.tsx** - Main hero section with title, CTA buttons, and hero image
- **StatsGrid.tsx** - Statistics display (drivers, deliveries, cities, rating)
- **FeaturesSection.tsx** - Feature cards showcasing platform capabilities
- **HowItWorksSection.tsx** - Step-by-step guide for customers and drivers
- **CTASection.tsx** - Call-to-action section encouraging sign-ups
- **Footer.tsx** - Footer with branding and additional information

### Main Component

- **LandingPage.tsx** - Main landing page component that composes all landing sections

## Usage

Import components from this directory:

```tsx
import { LandingPage } from './src/components/LandingPage';
// or
import { Header, HeroSection, Footer } from './src/components/landing';
```

## Design Principles

1. **Modularity** - Each component is self-contained and reusable
2. **Composition** - Larger components are built from smaller ones
3. **Separation of Concerns** - Each component has a single, clear responsibility
4. **Type Safety** - All components use TypeScript for type checking
5. **Internationalization** - All text content uses the translation system

## Component Guidelines

- Keep components focused and single-purpose
- Use props for customization and data passing
- Leverage the shared UI components from `/components/ui`
- Follow the existing code style and patterns
- Use lucide-react for icons
- Implement responsive design with Tailwind CSS
