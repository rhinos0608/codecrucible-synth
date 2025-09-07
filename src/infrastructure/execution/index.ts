export type { ExecutionResult, ExecutionOptions, BackendConfig } from './execution-types.js';
export { ExecutionBackend } from './base-execution-backend.js';
export { DockerBackend } from './backends/docker-backend.js';
export { E2BBackend } from './backends/e2b-backend.js';
export { LocalE2BBackend } from './backends/local-e2b-backend.js';
export { FirecrackerBackend } from './backends/firecracker-backend.js';
export { PodmanBackend } from './backends/podman-backend.js';
export { LocalProcessBackend } from './backends/local-process-backend.js';
export { ExecutionBackendFactory, ExecutionManager } from './execution-backend-factory.js';
