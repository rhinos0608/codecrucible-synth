import { readFile } from 'fs/promises';
import { join } from 'path';
import { getVersion } from '../../../src/utils/version.js';

describe('version utility', () => {
  it('matches package.json version', async () => {
    const pkg = JSON.parse(await readFile(join(process.cwd(), 'package.json'), 'utf-8')) as {
      version: string;
    };

    await expect(getVersion()).resolves.toBe(pkg.version);
  });

  const originalArgv = process.argv;

  afterEach(() => {
    process.argv = originalArgv;
    jest.restoreAllMocks();
  });

  it('fast-cli --version outputs package version', async () => {
    const { fastMain } = await import('../../../src/fast-cli.js');
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    process.argv = ['node', 'fast-cli', '--version'];
    await fastMain();
    expect(logSpy).toHaveBeenCalledWith(`CodeCrucible Synth v${await getVersion()}`);
  });

  it('main CLI --version outputs package version', async () => {
    const { main } = await import('../../../src/index.js');
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    process.argv = ['node', 'index', '--version'];
    await main();
    expect(logSpy).toHaveBeenCalledWith(
      `CodeCrucible Synth v${await getVersion()} (Unified Architecture)`
    );
  });
});
