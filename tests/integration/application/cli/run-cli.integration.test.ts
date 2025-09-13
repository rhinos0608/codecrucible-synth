jest.mock('../../../src/application/cli/parse-arguments.js', () => ({
  __esModule: true,
  default: jest.fn(() => ({ command: 'run', args: ['x'] })),
}));

jest.mock('../../../src/application/cli/command-dispatcher.js', () => ({
  __esModule: true,
  default: jest.fn(async () => false),
}));

const runMock = jest.fn(async () => {});
const cleanupMock = jest.fn(async () => {});

jest.mock('../../../src/application/cli/initialize-cli.js', () => ({
  __esModule: true,
  default: jest.fn(async () => ({
    cli: { run: runMock, shutdown: jest.fn() },
    serviceFactory: { dispose: jest.fn(async () => {}) },
  })),
}));

jest.mock('../../../src/application/cli/setup-cleanup.js', () => ({
  __esModule: true,
  default: jest.fn(() => cleanupMock),
}));

import runCLI from '../../../src/application/cli/run-cli.js';
import parseArguments from '../../../src/application/cli/parse-arguments.js';
import dispatchCommand from '../../../src/application/cli/command-dispatcher.js';
import initializeCLI from '../../../src/application/cli/initialize-cli.js';
import setupCleanup from '../../../src/application/cli/setup-cleanup.js';

describe('runCLI integration', () => {
  it('composes parsing, dispatch, initialization, and cleanup', async () => {
    await runCLI(['x'], {} as any, false);
    expect(parseArguments).toHaveBeenCalledWith(['x']);
    expect(dispatchCommand).toHaveBeenCalled();
    expect(initializeCLI).toHaveBeenCalled();
    expect(runMock).toHaveBeenCalledWith(['x']);
    expect(setupCleanup).toHaveBeenCalled();
    expect(cleanupMock).toHaveBeenCalled();
  });
});
