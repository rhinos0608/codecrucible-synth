jest.mock('../../../src/application/bootstrap/initialize.js', () => ({
  __esModule: true,
  default: jest.fn(async () => ({ cli: 'cli', serviceFactory: 'sf' })),
}));

import initializeCLI from '../../../src/application/cli/initialize-cli.js';
import initialize from '../../../src/application/bootstrap/initialize.js';

describe('initializeCLI', () => {
  it('calls initialize with provided options', async () => {
    const options = {} as any;
    const result = await initializeCLI(options, true);
    expect(initialize).toHaveBeenCalledWith(options, true);
    expect(result).toEqual({ cli: 'cli', serviceFactory: 'sf' });
  });
});
