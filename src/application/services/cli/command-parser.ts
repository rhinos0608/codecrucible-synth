import { randomUUID } from 'crypto';
import type { CLIOperationRequest } from '../unified-cli-coordinator.js';

export interface ICLIParser {
  parse: (args: readonly string[]) => CLIOperationRequest;
}

export class CLICommandParser implements ICLIParser {
  public parse(args: readonly string[]): CLIOperationRequest {
    const request: CLIOperationRequest = {
      id: randomUUID(),
      type: 'prompt',
      input: args.join(' '),
    };

    return request;
  }
}

export default CLICommandParser;
