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

### Smart Voice Selection Assistant Implementation (January 11, 2025)
- **Phase 1 Complete**: Implemented intelligent voice recommendation engine following improvement checklist
- **Voice Recommendation Engine**: Created server-side and client-side engines for analyzing prompts and suggesting optimal voice combinations
- **Smart Analysis**: Detects coding domains (React, TypeScript, API, security, performance, UI, database) and complexity levels
- **Real-time Recommendations**: UI displays confidence scores, reasoning, and suggested voice combinations
- **One-Click Application**: Users can apply recommended voice selections with a single button click
- **Prompt Analysis**: Automatically analyzes prompts longer than 10 characters for smart suggestions
- **Enhanced Voice Selection**: Added programmatic voice selection methods to context for recommendation integration
- **Security Compliance**: Following AI_INSTRUCTIONS.md patterns for input validation and user state management

### User Analytics & Tracking Implementation - Phase 1 Complete (January 11, 2025)
- **Analytics Service**: Created comprehensive analytics tracking service following AI_INSTRUCTIONS.md security patterns
- **Database Schema**: Added 4 new tables for analytics tracking (user_analytics, voice_usage_stats, session_analytics, daily_usage_metrics)
- **Event Tracking**: Tracks session creation, voice usage, synthesis completion, and recommendation interactions
- **Voice Usage Stats**: Monitors usage frequency, success rates, and average ratings for each voice engine
- **Session Analytics**: Records generation time, synthesis time, solution count, and prompt complexity metrics
- **Analytics Dashboard**: Built comprehensive analytics page with summary cards, voice usage charts, and activity timeline
- **API Endpoints**: Created 5 new analytics endpoints for dashboard, events, voice stats, recommendations, and ratings
- **Real-time Tracking**: Analytics events are tracked automatically during session generation and synthesis
- **Recommendation Analytics**: Tracks when voice recommendations are applied or rejected
- **Navigation Update**: Added Analytics button to dashboard navigation for easy access

### Critical Bug Fixes - Security & Logging Infrastructure (January 11, 2025)
- **Database Schema Fix**: Corrected usageLimits table structure to match actual database columns (removed created_at/updated_at, kept lastResetAt)
- **Circular JSON Logging Fix**: Added safeSerializeRequestDetails function to prevent circular reference errors in security logging
- **Security Event Logging**: Fixed all logSecurityEvent calls to use proper SecurityLogEntry object structure following AI_INSTRUCTIONS.md patterns
- **Enhanced Error Handling**: Added comprehensive error handling and logging throughout security middleware and quota checking
- **Synthesis Endpoint**: Fixed 500 errors in synthesis endpoint with proper plan validation and security logging
- **Logger Improvements**: Enhanced logger with safe JSON serialization to handle complex request objects
- **API Error Handling**: Improved API error responses with proper status codes and user-friendly messages

### Voice Profiles Tab Implementation & Bug Fixes (January 11, 2025)
- **Voice Profiles Tab**: Added third "My Profiles" tab to voice selector with tabbed interface for easy profile switching
- **Database Schema Updates**: Added avatar, personality, chatStyle, specialization, ethicalStance, perspective, and role fields to voice_profiles table
- **One-Click Profile Application**: Implemented applyVoiceProfile function in voice selection context for instant profile switching
- **ReferenceError Fix**: Fixed critical "sessionResponse is not defined" error in dashboard component by updating handleApplyRecommendations function
- **Smart Voice Recommendations**: Fixed recommendation text display and updated naming protocols to match current voice system
- **Voice Recommendation Engine**: Enhanced server-side reasoning generation with proper explanations and cleaned up scoring logic
- **Insert Schema Updates**: Updated voice profile insert schema to include all new avatar customizer fields
- **Voice Profiles Integration**: Connected voice profiles to existing CRUD interface and API with proper authentication

### Comprehensive Error Handling & 404 Fix Implementation (January 11, 2025)
- **API Endpoint Fixes**: Added missing `/api/decision-history`, `/api/logs`, and `/api/sessions/:id/logs` endpoints to resolve 404 errors
- **Error Tracking System**: Created comprehensive client-side error tracking with `useErrorTracking` hook and server-side error endpoint
- **Enhanced Error Boundary**: Implemented React ErrorBoundary with automatic error tracking and local storage fallback
- **Improved 404 Handling**: Enhanced NotFound page with error tracking, navigation buttons, and detailed error context
- **Error Monitor Component**: Built real-time error monitoring interface with export capabilities and severity indicators
- **Query Client Enhancement**: Added detailed error logging with status codes, URLs, and response data for better debugging
- **Dashboard Error Integration**: Fixed `generateSession` mutation calls and added proper error handling throughout the application
- **Production-Ready Logging**: Implemented secure error logging following AI_INSTRUCTIONS.md patterns with input validation

### Real OpenAI Integration & Mock Data Replacement (January 11, 2025)
- **Validation Schema Fix**: Updated session request validation to allow either perspectives OR roles selection (not requiring both)
- **Real OpenAI Integration**: Replaced all mock data generation with actual OpenAI API calls using gpt-4o model
- **Flexible Voice Selection**: Enhanced system to handle voice combinations where users select only perspectives, only roles, or both
- **Production-Ready LLM**: Implemented comprehensive OpenAI service with perspective-specific system prompts and role-based instructions
- **Enhanced Error Handling**: Added fallback mechanisms and detailed logging for OpenAI API failures
- **Multi-Voice Perspective Generation**: Each voice combination now generates unique, meaningful solutions through real LLM processing
- **Security Compliance**: All OpenAI integrations follow AI_INSTRUCTIONS.md security patterns with proper input validation
- **Performance Optimization**: Optimized OpenAI requests with appropriate temperature settings and response formatting
- **Synthesis Panel Fixes**: Enhanced synthesis panel with proper quota error handling and user-friendly error messages
- **UI Cleanup**: Removed prompt suggestion panel from dashboard as requested, streamlining the interface
- **Voice Terminology Update**: Updated OpenAI service and voice recommendations to use proper "Code Analysis Engine" and "Code Specialization Engine" terminology in all system prompts and UI displays

### Security Test Tab Removal for Production Deployment (January 11, 2025)
- **UI Cleanup**: Removed Security Test tab from dashboard frontend interface while preserving all backend functionality
- **Production Ready**: Backend security testing endpoints remain accessible for continued development and testing
- **Clean Interface**: Streamlined production interface by removing developer-only UI elements

### Projects Panel UI Enhancement & Context Integration (January 11, 2025)
- **Delete Section Spacing Fix**: Improved button layout and spacing in projects panel delete section with proper gap management
- **Project Context Integration**: Added "Use as Context" functionality allowing AI engines to pull context from saved projects
- **Enhanced Projects Panel**: Updated layout with separate button groups for copy/context actions vs delete actions
- **OpenAI Service Context Support**: Extended OpenAI service to accept and integrate project context into AI generation prompts
- **Dashboard Context State**: Added project context state management with visual indicators and clear functionality
- **Context-Aware Generation**: AI engines now receive existing project code and metadata to generate compatible solutions
- **Security Compliance**: All project context features follow AI_INSTRUCTIONS.md security patterns with input validation

### Development Mode Implementation for Unlimited AI Generations (January 11, 2025)
- **Environment Detection**: Comprehensive dev mode detection using NODE_ENV, REPL_ID, and DEV_MODE environment variables
- **Backend Dev Mode System**: Created `server/lib/dev-mode.ts` for secure development mode configuration and feature flags
- **Frontend Dev Mode Integration**: Built `client/src/lib/dev-mode.ts` for client-side dev mode detection and UI enhancements
- **Unlimited Generation Bypass**: Free tier users get unlimited AI generations in development environment
- **Voice Combination Override**: Removed voice selection limits for development and testing purposes
- **Rate Limit Bypass**: All API rate limiting bypassed in development mode for efficient testing
- **Extended Prompt Limits**: Increased prompt length from 5,000 to 15,000 characters in dev mode
- **Unlimited Synthesis Access**: Free tier gets Pro-level synthesis functionality in development
- **Dev Mode Watermarks**: All AI-generated content marked with "DEV-GEN 🔧" watermark in development
- **Security Audit Logging**: Comprehensive logging of all dev mode bypasses and feature usage
- **Production Safety**: Dev mode automatically disabled in production with security warnings
- **Schema Updates**: Added `mode` field to `voice_sessions` table for dev/production session tracking
- **UI Dev Badges**: Frontend displays dev mode indicators on generation buttons and interface elements
- **Internal OpenAI Proxy**: Implemented `/api/openai` endpoint for unlimited GPT-4/3.5 generations with fallback mock responses
- **Smart Prompt Suggestions**: Added intelligent coding prompt suggestions above "Your Request" field following AI_INSTRUCTIONS.md patterns
- **DEV_MODE_TEST.md**: Created comprehensive testing guide and documentation for development mode features
- **Subscription Service Fix**: Resolved critical dev mode bypass issue in subscription service for proper quota bypassing

### Critical OpenAI Integration & Voice Engine Audit Fix (January 12, 2025)
- **Database Schema Synchronization**: Fixed critical missing 'mode' column in voice_sessions table causing 500 errors during generation
- **Voice Name Mapping Correction**: Updated Implementation Options to display proper voice names (Explorer, Analyzer) instead of internal IDs
- **OpenAI Prompt Template Enhancement**: Fixed issue where OpenAI returned placeholder text instead of actual code by improving prompt specificity
- **Code Generation Validation**: All voice engines now consistently generate real code with proper lengths (1000+ characters each)
- **Scrolling & UI Improvements**: Enhanced solution display container with better overflow handling and increased code display height
- **Synthesis Flow Restoration**: Confirmed and enhanced synthesis panel integration with clear "Next Steps" guidance
- **Save to Projects Integration**: Verified working project saving functionality from synthesized solutions
- **Production-Ready Generation**: All voice combinations (Explorer, Maintainer, Analyzer, Developer, Implementor) generating real OpenAI responses
- **Error Handling Enhancement**: Added fallback text display for edge cases and improved debugging capabilities
- **User Experience Polish**: Updated button text from "Merge Solutions" to "Synthesize Solutions" with instructional guidance panel

### Premium Subscription Tiers Implementation (January 12, 2025)
- **Teams to Premium Migration**: Replaced Teams navigation button with Premium subscription tiers access
- **Three-Tier Structure**: Enhanced UpgradeModal with Pro ($19), Team ($49), and Enterprise ($99) subscription plans
- **Stripe Integration**: Connected Premium button to existing Stripe checkout flow with `/subscribe?plan=` routing
- **Enterprise Features**: Added Enterprise tier with custom AI training, on-premise deployment, SSO integration, and compliance features
- **UI Enhancement**: Updated grid layout to display all three tiers with proper highlighting and feature differentiation
- **Crown Icon Integration**: Replaced Users icon with Crown icon for Premium branding consistency
- **Security Compliance**: All premium features follow AI_INSTRUCTIONS.md patterns with proper input validation

### Comprehensive Paywall & Feature Access Control Implementation (January 12, 2025)
- **Complete Feature Matrix**: Implemented comprehensive feature access control system following AI_INSTRUCTIONS.md security patterns
- **Backend Enforcement**: Created server/feature-access.ts with tier-based feature matrix and validation schemas using Zod
- **Subscription Middleware**: Built server/middleware/subscription-enforcement.ts for API route protection with proper error handling
- **Frontend Feature Gates**: Created client/src/components/FeatureGate.tsx for conditional UI rendering with upgrade prompts
- **Production-Ready Paywall**: All API routes properly protected with enforceSubscriptionLimits middleware and usage tracking
- **Voice Combination Limits**: Free tier limited to 2 voices, paid tiers unlimited with proper validation and bypass detection
- **Synthesis Protection**: Advanced synthesis engine locked behind Pro+ subscription with detailed security logging
- **Analytics Tiering**: Dashboard features appropriately gated based on subscription tier with contextual upgrade prompts
- **Usage Enforcement**: Daily generation limits (3 for free, unlimited for paid) with proper reset mechanisms
- **Dev Mode Bypass**: Comprehensive development mode overrides for testing while maintaining production security
- **Error Handling**: Graceful upgrade prompts with direct Stripe checkout links for blocked features
- **Security Audit Trail**: Comprehensive logging of paywall interactions, bypass attempts, and subscription enforcement
- **Real Stripe Checkout**: All upgrade buttons redirect to actual Stripe checkout pages for immediate subscription processing