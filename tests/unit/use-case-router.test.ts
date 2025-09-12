import { UseCaseRouter } from '../../src/application/cli/use-case-router.js';

describe('UseCaseRouter isCodeGenerationRequest', () => {
  const router = new UseCaseRouter();

  it('returns false for data file creation requests', () => {
    const prompt = 'Create JSON file with sample data';
    // @ts-expect-error accessing private method for testing
    expect((router as any).isCodeGenerationRequest(prompt)).toBe(false);
  });

  it('returns true for code file scaffolding', () => {
    const prompt = 'Create module user-service.ts with a class stub';
    // @ts-expect-error accessing private method for testing
    expect((router as any).isCodeGenerationRequest(prompt)).toBe(true);
  });
});
