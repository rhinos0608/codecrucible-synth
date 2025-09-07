import type { ExecutionOptions, ExecutionResult, BackendConfig } from '../execution-types.js';
import { E2BBackend } from './e2b-backend.js';
import type { ServiceResponse } from '../../error-handling/structured-error-system.js';

export class LocalE2BBackend extends E2BBackend {
  public constructor(config: Readonly<BackendConfig>) {
    super({
      ...config,
      e2bEndpoint: config.e2bEndpoint ?? 'http://localhost:4000',
    });
  }

  public override async execute(
    command: string,
    options: Readonly<ExecutionOptions> = {}
  ): Promise<ServiceResponse<ExecutionResult>> {
    process.env.E2B_API_URL = this.config.e2bEndpoint;
    const result = await super.execute(command, options);
    if (result.success && 'data' in result) {
      result.data.backend = 'local_e2b';
    }
    return result;
  }

  public override getStatus(): {
    type: string;
    active: number;
    available: boolean;
    config: {
      template?: string;
      endpoint?: string;
      activeSandboxes: number;
    };
  } {
    const status = super.getStatus();
    status.type = 'local_e2b';
    return status;
  }
}
