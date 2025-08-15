
import { z } from 'zod';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: z.ZodObject<any>;
  category: string;
  examples?: string[];
}

export abstract class BaseTool {
  definition: ToolDefinition;

  constructor(definition: ToolDefinition) {
    this.definition = definition;
  }

  abstract execute(args: any): Promise<any>;
}
