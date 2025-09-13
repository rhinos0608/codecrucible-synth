jest.mock('../../../src/application/cli/help.js', () => ({
  __esModule: true,
  showHelp: jest.fn(),
  showStatus: jest.fn(),
}));

jest.mock('../../../src/application/cli/bootstrap/tool-registration.js', () => ({
  __esModule: true,
  bootstrapToolRegistration: jest.fn(),
}));

import dispatchCommand from '../../../src/application/cli/command-dispatcher.js';
import { showHelp } from '../../../src/application/cli/help.js';

describe('dispatchCommand', () => {
  it('handles help command', async () => {
    const handled = await dispatchCommand({ command: 'help' } as any);
    expect(handled).toBe(true);
    expect(showHelp).toHaveBeenCalled();
  });

  it('returns false for run command', async () => {
    const handled = await dispatchCommand({ command: 'run', args: [] });
    expect(handled).toBe(false);
  });
});
