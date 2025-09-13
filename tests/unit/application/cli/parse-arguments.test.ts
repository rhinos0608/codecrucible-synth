jest.mock('../../../src/application/cli/args-parser.js', () => ({
  __esModule: true,
  default: jest.fn(() => ({ command: 'run', args: [] })),
}));

import parseArguments from '../../../src/application/cli/parse-arguments.js';
import parseCLIArgs from '../../../src/application/cli/args-parser.js';

describe('parseArguments', () => {
  it('delegates to parseCLIArgs', () => {
    const result = parseArguments(['a']);
    expect(parseCLIArgs).toHaveBeenCalledWith(['a']);
    expect(result).toEqual({ command: 'run', args: [] });
  });
});
