export interface OrchestrationRequest {
  id: string;
  /**
   * @deprecated Use 'command' instead. 'type' is kept for backward compatibility and will be removed in the future.
   */
  type?: string;
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
