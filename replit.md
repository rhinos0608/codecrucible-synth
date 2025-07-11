# CodeCrucible - Multi-Voice AI Coding Assistant

## Overview

CodeCrucible is a sophisticated multi-voice AI coding assistant that uses the concept of "Transisthesis Archetypes" and specialized coding voices to generate, analyze, and synthesize code solutions. The application implements a recursive approach to code generation where different AI personas collaborate to produce comprehensive solutions.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **UI Framework**: Shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens for voice-specific colors
- **State Management**: React hooks with custom state management via `useVoiceSelection`
- **Data Fetching**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for lightweight client-side routing

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **Database Provider**: Neon Database (serverless PostgreSQL)
- **API Design**: RESTful endpoints with JSON responses
- **Session Management**: In-memory storage with interface for database integration
- **Development**: Hot module replacement via Vite middleware integration

### Key Components

#### Voice System
The application centers around two types of AI voices:
1. **Transisthesis Archetypes**: Philosophical personas (Seeker, Steward, Witness, Nurturer, Decider)
2. **Enhanced Coding Voices**: Technical specialists (Guardian, Architect, Designer, Optimizer)

Each voice contributes unique perspectives to code generation and synthesis.

#### Solution Generation Pipeline
1. **Voice Selection**: Users select combinations of archetype and coding voices
2. **Prompt Engine**: Accepts coding challenges with configurable parameters
3. **Multi-Voice Generation**: Creates multiple solutions from different voice perspectives
4. **Solution Stack**: Displays generated solutions with confidence scores and explanations
5. **Synthesis Panel**: Combines solutions using recursive integration algorithms
6. **Phantom Ledger**: Tracks ethical decisions and voice convergence patterns

## Data Flow

1. **User Input**: Prompt entry and voice selection through the frontend interface
2. **Session Creation**: POST request to `/api/sessions` creates a voice session with selected parameters
3. **Solution Generation**: Backend generates mock solutions for each selected voice combination
4. **Solution Display**: Frontend fetches and displays solutions via `/api/sessions/:id/solutions`
5. **Synthesis Process**: User can trigger synthesis which combines multiple solutions
6. **Result Storage**: Synthesized results are stored and tracked in the phantom ledger

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: Serverless PostgreSQL driver for Neon Database
- **drizzle-orm**: Type-safe ORM with excellent TypeScript integration
- **@tanstack/react-query**: Powerful data synchronization for React
- **@radix-ui/***: Headless UI primitives for accessibility and consistency
- **wouter**: Minimalist routing library for React
- **zod**: Schema validation for type-safe API interactions

### Development Dependencies
- **tsx**: TypeScript execution for Node.js development
- **esbuild**: Fast JavaScript bundler for production builds
- **tailwindcss**: Utility-first CSS framework
- **vite**: Next-generation frontend tooling

## Deployment Strategy

### Build Process
1. **Frontend Build**: Vite compiles React application to static assets in `dist/public`
2. **Backend Build**: esbuild bundles server code to `dist/index.js` with ESM format
3. **Database Migration**: Drizzle Kit manages schema changes via `db:push` command

### Environment Configuration
- **Development**: Uses Vite dev server with Express middleware integration
- **Production**: Serves static files from Express with compiled backend bundle
- **Database**: Requires `DATABASE_URL` environment variable for PostgreSQL connection

### Deployment Targets
- **Replit**: Optimized for Replit environment with banner integration
- **Node.js Hosting**: Compatible with any Node.js hosting platform
- **Serverless**: Backend can be adapted for serverless deployment

## Architecture Decisions

### Database Choice: PostgreSQL with Drizzle
**Problem**: Need for reliable data persistence with type safety
**Solution**: PostgreSQL via Neon Database with Drizzle ORM
**Rationale**: 
- PostgreSQL provides JSONB support for complex voice data structures
- Drizzle offers excellent TypeScript integration and zero-runtime overhead
- Neon Database provides serverless scaling without connection management complexity

### State Management: React Query + Custom Hooks
**Problem**: Complex state synchronization between client and server
**Solution**: TanStack Query for server state, custom hooks for client state
**Rationale**:
- React Query handles caching, synchronization, and background updates automatically
- Custom hooks encapsulate voice selection logic and provide clean APIs
- Avoids complexity of Redux while maintaining predictable state updates

### UI Architecture: Shadcn/ui + Radix
**Problem**: Need for accessible, customizable UI components
**Solution**: Shadcn/ui component library built on Radix primitives
**Rationale**:
- Radix provides headless, accessible components out of the box
- Shadcn/ui offers pre-styled components that can be easily customized
- Tailwind CSS integration provides consistent design system

### API Design: RESTful with Mock Data
**Problem**: Complex voice generation requires flexible API design
**Solution**: RESTful endpoints with structured JSON responses and mock data generation
**Rationale**:
- REST provides predictable, cacheable endpoints for React Query
- Mock data allows frontend development without AI integration complexity
- Structured schemas enable future AI service integration

## Recent Changes

### Authentication & User Profiles Implementation (January 11, 2025)
- **Replit Auth Integration**: Added complete OpenID Connect authentication flow with session management
- **User Database Schema**: Created users table with voice preference profiles support
- **Database Migration**: Successfully migrated from in-memory storage to PostgreSQL with Drizzle ORM
- **Voice Profile System**: Implemented custom voice profiles with avatar customization
- **Avatar Customizer**: Built comprehensive UI for creating and managing AI voice personalities
- **Persistent Preferences**: User voice profiles are now saved and synchronized across sessions

### Technical Improvements
- **Database Storage**: Replaced MemStorage with DatabaseStorage for persistence
- **Authentication Routes**: Added protected endpoints for user management and voice profiles
- **Frontend Auth**: Implemented useAuth hook with automatic redirection for unauthorized users
- **Landing Page**: Created beautiful landing page for unauthenticated users
- **Profile Management**: Full CRUD operations for voice profiles with ownership verification

### Voice Selection State Management Fix (January 11, 2025)
- **Issue Identified**: Voice selections weren't propagating to parent components due to separate hook instances
- **Solution Implemented**: Created VoiceSelectionContext using React Context API for shared state management
- **Architecture Pattern**: Single source of truth following AI_INSTRUCTIONS.md security patterns
- **Enhanced Debugging**: Added comprehensive logging to track state updates and voice selection events
- **Components Updated**: PerspectiveSelector and Dashboard now share the same state instance via context

### Complete Rebranding to Coding-Focused Terminology (January 11, 2025)
- **Terminology Updates**: Comprehensive rebranding from generic AI assistant to coding-specific terminology
- **Voice System Rebranding**: "Transisthesis Archetypes" → "Code Analysis Engines", "Enhanced Coding Voices" → "Code Specialization Engines"
- **Perspective Names**: Seeker → Explorer, Steward → Maintainer, Witness → Analyzer, Nurturer → Developer, Decider → Implementor
- **Role Names**: Guardian → Security Engineer, Architect → Systems Architect, Designer → UI/UX Engineer, Optimizer → Performance Engineer
- **UI Component Updates**: All component titles, descriptions, and interfaces updated to reflect coding focus
- **Feature Rebranding**: "Phantom Ledger" → "Decision History", "Multi-Perspective AI Assistant" → "Multi-Engine Code Generator"
- **Enhanced Descriptions**: All voice functions and fragments updated with specific coding and development terminology
- **Avatar Customizer**: Updated to "Code Engine Profile" creation with technical specializations