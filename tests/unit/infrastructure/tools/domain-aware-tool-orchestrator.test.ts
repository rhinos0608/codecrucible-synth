import { DomainAwareToolOrchestrator } from '../../../../src/infrastructure/tools/domain-aware-tool-orchestrator.js';

describe('DomainAwareToolOrchestrator', () => {
  it('includes essential filesystem tools regardless of domain confidence', () => {
    const orchestrator = new DomainAwareToolOrchestrator();
    const mockTools = [
      { name: 'file_read' },
      { name: 'file_write' },
      { name: 'mcp_execute_command' },
    ];

    const result = orchestrator.getToolsForPrompt('research the history of compilers', mockTools);
    const selectedNames = result.tools.map(t => t.name);

    expect(result.analysis.primaryDomain).toBe('research');
    expect(result.analysis.confidence).toBeGreaterThan(0.7);
    expect(selectedNames).toEqual(
      expect.arrayContaining(['file_read', 'file_write', 'mcp_execute_command'])
    );
  });
});
