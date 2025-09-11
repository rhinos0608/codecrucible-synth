export interface ToolRequest {
  [key: string]: unknown;
}

export interface ToolResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface GitStatus {
  branch: string;
  staged: string[];
  modified: string[];
  untracked: string[];
  ahead: number;
  behind: number;
  clean: boolean;
}

export interface GitCommitInfo {
  hash: string;
  author: string;
  date: string;
  message: string;
  files: string[];
}

export interface GitDiffResult {
  file: string;
  additions: number;
  deletions: number;
  patch: string;
}

export type ToolHandler<TReq extends ToolRequest = ToolRequest, TRes = unknown> = (
  args: TReq
) => Promise<ToolResponse<TRes>>;
