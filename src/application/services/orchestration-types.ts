export interface OrchestrationRequest {
  id: string;
  command: string;
  payload?: unknown;
}

export interface OrchestrationResponse {
  id: string;
  success: boolean;
  result?: unknown;
  error?: Error;
}

export interface WorkflowState {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
}
