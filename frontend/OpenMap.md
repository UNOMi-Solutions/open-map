# OpenMap.md

## Overview

This is a full-stack web application built with React, Express, and PostgreSQL. The application appears to be a data visualization platform focused on displaying various demographic, environmental, and socioeconomic data on an interactive map of the United States. The project uses modern web technologies including TypeScript, Tailwind CSS, and shadcn/ui components.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens and CSS variables

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Pattern**: RESTful API with `/api` prefix
- **Middleware**: Custom logging, JSON parsing, and error handling
- **Development**: Hot module replacement with Vite integration

### Data Layer
- **Database**: PostgreSQL with Neon serverless driver
- **ORM**: Drizzle ORM for type-safe database operations
- **Schema Management**: Drizzle Kit for migrations and schema generation
- **Storage Interface**: Abstracted storage layer with in-memory fallback for development

## Key Components

### Frontend Components
- **MainPage**: Primary landing page with map visualization
- **UI Components**: Comprehensive set of reusable components (buttons, cards, forms, etc.)
- **Map Visualization**: Interactive US map with data points and overlays
- **Timeline Component**: Data timeline with year-based navigation
- **Navigation Menu**: Accordion-based category filtering system

### Backend Components
- **Route Registration**: Centralized route management system
- **Storage Abstraction**: Interface-based storage with memory and database implementations
- **Error Handling**: Global error middleware with status code handling
- **Development Tooling**: Request logging and performance monitoring

### Data Models
- **User Schema**: Basic user management with username/password authentication
- **Extensible Schema**: Ready for additional data models (demographics, environmental data, etc.)

## Data Flow

1. **Client Requests**: React components make API calls using TanStack Query
2. **Server Processing**: Express routes handle requests and interact with storage layer
3. **Data Retrieval**: Storage interface abstracts database operations
4. **Response Handling**: Standardized JSON responses with error handling
5. **UI Updates**: React Query manages cache invalidation and UI state updates

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL serverless database driver
- **drizzle-orm**: TypeScript ORM for database operations
- **@tanstack/react-query**: Server state management and caching
- **@radix-ui/***: Headless UI component primitives
- **wouter**: Lightweight React router

### Development Tools
- **@replit/vite-plugin-runtime-error-modal**: Development error overlay
- **@replit/vite-plugin-cartographer**: Replit-specific development tools
- **esbuild**: Fast JavaScript bundler for production builds

## Deployment Strategy

### Development Environment
- **Local Development**: Vite dev server with Express backend
- **Hot Reload**: Full-stack hot module replacement
- **Database**: Environment variable-based connection to PostgreSQL

### Production Build
- **Frontend**: Vite builds optimized static assets to `dist/public`
- **Backend**: esbuild bundles Express server to `dist/index.js`
- **Database**: Production PostgreSQL connection via DATABASE_URL environment variable
- **Deployment**: Single-server deployment with static file serving

### Environment Configuration
- **DATABASE_URL**: Required PostgreSQL connection string
- **NODE_ENV**: Environment detection for development/production modes
- **REPL_ID**: Replit-specific environment detection

## Changelog

Changelog:
- July 01, 2025. Initial setup

## User Preferences

Preferred communication style: Simple, everyday language.
