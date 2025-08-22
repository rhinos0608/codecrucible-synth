# Layered Architecture Design
## CodeCrucible Synth Clean Architecture Implementation

**Design Date**: 2025-01-22  
**Phase**: 3.1 - Layered Architecture Boundaries  
**Objective**: Eliminate remaining circular dependencies through proper architectural layering  

---

## 🏗️ Architecture Overview

The layered architecture implements **Dependency Inversion Principle** with clear separation of concerns:

```
┌─────────────────────────────────────┐
│         Presentation Layer          │ ← CLI, REST API, User Interfaces
├─────────────────────────────────────┤
│         Application Layer           │ ← Use Cases, Application Services
├─────────────────────────────────────┤
│           Domain Layer              │ ← Business Logic, Entities, Rules
├─────────────────────────────────────┤
│        Infrastructure Layer        │ ← External Concerns, I/O, Providers
└─────────────────────────────────────┘
```

**Dependency Flow**: Presentation → Application → Domain ← Infrastructure

---

## 🎯 Layer Definitions

### **Domain Layer** (`src/domain/`)
**Purpose**: Pure business logic without external dependencies

**Components**:
- **Entities**: Core business objects (Voice, Model, Request, Response)
- **Value Objects**: Immutable domain concepts (ModelType, ProviderType)
- **Domain Services**: Business logic that doesn't fit in entities
- **Repository Interfaces**: Data access contracts (no implementations)
- **Domain Events**: Business event definitions

**Key Rules**:
- ❌ No imports from other layers
- ❌ No external dependencies (HTTP, file system, databases)
- ✅ Pure TypeScript/JavaScript only
- ✅ Business rules and validation logic

### **Application Layer** (`src/application/`)
**Purpose**: Use case orchestration and application services

**Components**:
- **Use Cases**: Application workflows (GenerateCode, AnalyzeProject)
- **Application Services**: Coordinate domain services
- **DTOs**: Data transfer objects for layer boundaries
- **Command/Query Objects**: Request/response patterns
- **Application Events**: Use case event definitions

**Dependencies**:
- ✅ Can import from Domain layer
- ❌ Cannot import from Infrastructure or Presentation
- ✅ Defines interfaces implemented by Infrastructure

### **Infrastructure Layer** (`src/infrastructure/`)
**Purpose**: External concerns and third-party integrations

**Components**:
- **Providers**: Ollama, LM Studio, HuggingFace clients
- **Repositories**: Data persistence implementations
- **External Services**: HTTP clients, file system, caching
- **Configuration**: Environment-specific settings
- **Adapters**: Third-party integration wrappers

**Dependencies**:
- ✅ Can import from Domain and Application layers
- ✅ Implements interfaces defined in Domain/Application
- ✅ Contains all external dependencies

### **Presentation Layer** (`src/presentation/`)
**Purpose**: User interface and external API endpoints

**Components**:
- **CLI**: Command-line interface
- **REST API**: HTTP endpoints and controllers
- **Formatters**: Output formatting and display logic
- **Input Validation**: User input sanitization
- **Error Handlers**: User-facing error presentation

**Dependencies**:
- ✅ Can import from Application layer (and transitively Domain)
- ❌ Cannot import from Infrastructure layer directly
- ✅ Uses dependency injection for Infrastructure services

---

## 🔄 Current Component Mapping

### **Moving to Domain Layer**:
```
src/domain/
├── entities/
│   ├── voice.ts                     ← Voice archetypes and personas
│   ├── model.ts                     ← AI model abstractions
│   ├── request.ts                   ← Request/response entities
│   └── spiral-phase.ts              ← Living Spiral methodology
├── services/
│   ├── voice-orchestration.ts      ← Multi-voice coordination logic
│   ├── model-selection.ts          ← Model routing business rules
│   └── spiral-coordinator.ts       ← Living Spiral process logic
├── repositories/
│   ├── voice-repository.ts         ← Voice storage interface
│   ├── model-repository.ts         ← Model management interface
│   └── project-repository.ts       ← Project data interface
└── events/
    ├── voice-events.ts              ← Voice-related domain events
    └── model-events.ts              ← Model-related domain events
```

### **Moving to Application Layer**:
```
src/application/
├── use-cases/
│   ├── generate-code.ts             ← Code generation workflow
│   ├── analyze-project.ts           ← Project analysis workflow
│   ├── process-request.ts           ← Request processing workflow
│   └── spiral-iteration.ts         ← Living Spiral iteration
├── services/
│   ├── synthesis-coordinator.ts    ← Multi-voice synthesis coordination
│   ├── workflow-orchestrator.ts    ← Current workflow orchestrator
│   └── tool-orchestrator.ts        ← Current advanced tool orchestrator
├── dtos/
│   ├── request-dto.ts               ← Request data transfer objects
│   ├── response-dto.ts              ← Response data transfer objects
│   └── analysis-dto.ts              ← Analysis result objects
└── commands/
    ├── code-generation-command.ts   ← Code generation commands
    └── analysis-command.ts          ← Analysis commands
```

### **Moving to Infrastructure Layer**:
```
src/infrastructure/
├── providers/
│   ├── ollama-provider.ts           ← Current Ollama implementation
│   ├── lm-studio-provider.ts        ← Current LM Studio implementation
│   └── provider-repository.ts      ← Current provider repository
├── repositories/
│   ├── file-voice-repository.ts    ← File-based voice storage
│   ├── memory-model-repository.ts  ← In-memory model storage
│   └── file-project-repository.ts  ← File-based project storage
├── caching/
│   ├── cache-coordinator.ts        ← Current cache coordinator
│   └── unified-cache-system.ts     ← Current cache system
├── streaming/
│   └── streaming-manager.ts        ← Current streaming manager
├── security/
│   ├── security-validator.ts       ← Current security validator
│   └── input-sanitizer.ts          ← Current input sanitizer
└── monitoring/
    ├── observability-system.ts     ← Current observability
    └── performance-monitor.ts      ← Current performance monitor
```

### **Moving to Presentation Layer**:
```
src/presentation/
├── cli/
│   ├── cli.ts                       ← Current CLI implementation
│   ├── cli-commands.ts              ← Current CLI commands
│   ├── cli-parser.ts                ← Current CLI parser
│   └── cli-output-manager.ts       ← Current output manager
├── api/
│   └── server-mode.ts               ← Current server mode
├── formatters/
│   ├── response-formatter.ts       ← Response formatting logic
│   └── chain-of-thought-display.ts ← Current CoT display
└── handlers/
    ├── error-handler.ts             ← User-facing error handling
    └── input-validator.ts           ← Input validation
```

---

## 🚫 Circular Dependency Resolution

### **Current Problem**: `integrated-system.ts`
The integrated system creates circular dependencies by:
1. Importing from all layers simultaneously
2. Acting as both orchestrator and configuration manager
3. Mixing domain logic with infrastructure concerns

### **Solution**: Split by Responsibility
1. **Domain Service**: `VoiceSynthesisService` (business rules)
2. **Application Service**: `SynthesisCoordinator` (use case orchestration)
3. **Infrastructure**: Provider implementations
4. **Presentation**: CLI/API interfaces

### **New Dependency Flow**:
```
CLI → SynthesisCoordinator → VoiceSynthesisService → Repository Interfaces
                                                           ↑
Infrastructure Repositories implement these interfaces ←────┘
```

---

## 📋 Implementation Phases

### **Phase 3.2**: Implement Domain Layer
- [ ] Extract domain entities from current classes
- [ ] Create repository interfaces
- [ ] Move business logic to domain services
- [ ] Define domain events

### **Phase 3.3**: Implement Application Layer  
- [ ] Create use case classes
- [ ] Build application services
- [ ] Define DTOs and commands
- [ ] Replace `integrated-system.ts` with proper coordinators

### **Phase 3.4**: Refactor Infrastructure Layer
- [ ] Move provider implementations
- [ ] Implement repository interfaces
- [ ] Extract external service adapters
- [ ] Configure dependency injection

---

## ✅ Quality Gates

### **Architecture Validation**:
- [ ] Zero circular dependencies (madge analysis)
- [ ] Proper dependency flow (inward toward domain)
- [ ] Single responsibility per layer
- [ ] Interface segregation achieved

### **Build Validation**:
- [ ] TypeScript compilation successful
- [ ] All tests pass
- [ ] CLI functionality preserved
- [ ] Performance benchmarks met

### **Code Quality**:
- [ ] Reduced coupling between modules
- [ ] Increased cohesion within layers
- [ ] Improved testability through DI
- [ ] Clear separation of concerns

---

This design eliminates the architectural violations causing circular dependencies while maintaining the rich functionality of CodeCrucible Synth through proper layering and dependency inversion.