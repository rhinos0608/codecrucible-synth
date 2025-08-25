# Architecture Overview

Layers
- Domain: pure business logic, no infra dependencies.
- Application (Use-cases): orchestrates domain operations, transforms input/out.
- Adapters: translate between application and infrastructure (DB, HTTP clients).
- Infrastructure: concrete implementations (DB clients, external APIs, message brokers).

Import rules
- Domain <- no imports from other layers
- Application <- may import Domain
- Adapters <- may import Application & Domain
- Infrastructure <- may import Adapters
- No cyclical imports. Prefer dependency injection to pass infra clients into adapters.

Quick checklist
- Files that do DB/HTTP + business logic in same file should be split.
- Avoid module-level mutable state; use explicit state objects.
