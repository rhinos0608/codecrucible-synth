export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  success: boolean;
  duration: number;
  backend: string;
  metadata?: {
    containerId?: string;
    sandboxId?: string;
    vmId?: string;
    memoryUsed?: number;
    cpuTime?: number;
    vcpuCount?: number;
    memSizeMib?: number;
    rootless?: boolean;
    networkMode?: string;
  };
}

export interface ExecutionOptions {
  timeout?: number;
  workingDirectory?: string;
  environment?: Record<string, string>;
  stdin?: string;
  captureOutput?: boolean;
  maxOutputSize?: number;
}

export interface BackendConfig {
  type: 'docker' | 'e2b' | 'local_e2b' | 'local_process' | 'firecracker' | 'podman';
  dockerImage?: string;
  e2bApiKey?: string;
  e2bEndpoint?: string;
  e2bTemplate?: string;
  localSafeguards?: boolean;
  allowedCommands?: string[];
  maxConcurrent?: number;
  firecrackerKernelPath?: string;
  firecrackerRootfsPath?: string;
  firecrackerVcpuCount?: number;
  firecrackerMemSizeMib?: number;
  podmanRootless?: boolean;
  podmanImage?: string;
  podmanNetworkMode?: string;
}
