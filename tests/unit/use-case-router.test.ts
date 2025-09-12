import { UseCaseRouter } from '../../src/application/cli/use-case-router.js';

describe('UseCaseRouter isCodeGenerationRequest', () => {
  const router = new UseCaseRouter();

  const callIsCodeGenerationRequest = (prompt: string): boolean =>
    (
      router as unknown as {
        isCodeGenerationRequest: (prompt: string) => boolean;
      }
    ).isCodeGenerationRequest(prompt);

  it('returns false for data file creation requests', () => {
    const prompt = 'Create JSON file with sample data';
    expect(callIsCodeGenerationRequest(prompt)).toBe(false);
  });

  it('returns true for code file scaffolding', () => {
    const prompt = 'Create module user-service.ts with a class stub';
    expect(callIsCodeGenerationRequest(prompt)).toBe(true);
  });
});
