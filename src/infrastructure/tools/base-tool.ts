import { z } from 'zod';

export interface ToolDefinition<T extends z.ZodRawShape = z.ZodRawShape> {
  name: string;
  description: string;
  parameters: z.ZodObject<T>;
  category: string;
  examples?: string[];
}

export abstract class BaseTool<T extends z.ZodRawShape> {
  public readonly definition: ToolDefinition<T>;

  public constructor(definition: Readonly<ToolDefinition<T>>) {
    this.definition = definition;
  }

  public abstract execute(args: Readonly<z.infer<z.ZodObject<T>>>): Promise<unknown>;
}
