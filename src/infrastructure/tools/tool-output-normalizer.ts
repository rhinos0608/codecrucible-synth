export interface NormalizedDiagnostic {
  tool: string;
  type: 'diagnostic';
  file: string;
  line: number;
  message: string;
  column?: number;
  code?: string;
  severity?: 'error' | 'warning' | 'info';
}

function parseESLint(output: unknown): NormalizedDiagnostic[] {
  const diags: NormalizedDiagnostic[] = [];
  try {
    const results: any[] = typeof output === 'string' ? JSON.parse(output) : (output as any);
    if (Array.isArray(results)) {
      for (const fileRes of results) {
        const file = fileRes.filePath || fileRes.file || '';
        const messages = Array.isArray(fileRes.messages) ? fileRes.messages : [];
        for (const m of messages) {
          diags.push({
            tool: 'eslint',
            type: 'diagnostic',
            file,
            line: Number(m.line) || 1,
            column: Number(m.column) || undefined,
            message: String(m.message || ''),
            code: m.ruleId || undefined,
            severity: m.severity === 2 ? 'error' : 'warning',
          });
        }
      }
    }
  } catch {
    // ignore
  }
  return diags;
}

function parseFlake8(text: string): NormalizedDiagnostic[] {
  const diags: NormalizedDiagnostic[] = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    // path:line:col: CODE message  OR path:line: CODE message
    let m = line.match(/^(.*?):(\d+):(\d+):\s*([A-Z]\d+)\s+(.*)$/);
    if (m) {
      diags.push({
        tool: 'flake8',
        type: 'diagnostic',
        file: m[1],
        line: Number(m[2]),
        column: Number(m[3]),
        code: m[4],
        message: m[5],
        severity: m[4].startsWith('E') ? 'error' : 'warning',
      });
      continue;
    }
    m = line.match(/^(.*?):(\d+):\s*([A-Z]\d+)\s+(.*)$/);
    if (m) {
      diags.push({
        tool: 'flake8',
        type: 'diagnostic',
        file: m[1],
        line: Number(m[2]),
        message: m[4],
        code: m[3],
        severity: m[3].startsWith('E') ? 'error' : 'warning',
      });
    }
  }
  return diags;
}

function parseMypy(text: string): NormalizedDiagnostic[] {
  const diags: NormalizedDiagnostic[] = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    // path:line: column: error: message [code]
    const m = line.match(/^(.*?):(\d+)(?::(\d+))?:\s*(error|note|warning|info)?:?\s*(.*?)(?:\s\[(.+)\])?$/i);
    if (m) {
      const sev = (m[4] || 'error').toLowerCase();
      diags.push({
        tool: 'mypy',
        type: 'diagnostic',
        file: m[1],
        line: Number(m[2]),
        column: m[3] ? Number(m[3]) : undefined,
        message: m[5],
        code: m[6],
        severity: sev === 'error' ? 'error' : sev === 'warning' ? 'warning' : 'info',
      });
    }
  }
  return diags;
}

function parsePylint(text: string): NormalizedDiagnostic[] {
  const diags: NormalizedDiagnostic[] = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    // path:line:col: [C0114(missing-module-docstring), module] message
    let m = line.match(/^(.*?):(\d+):(\d+):\s*\[([A-Z]\d+)[^\]]*\]\s*(.*)$/);
    if (m) {
      const code = m[4];
      const sev = code.startsWith('E') || code.startsWith('F') ? 'error' : code.startsWith('W') ? 'warning' : 'info';
      diags.push({
        tool: 'pylint',
        type: 'diagnostic',
        file: m[1],
        line: Number(m[2]),
        column: Number(m[3]),
        message: m[5],
        code,
        severity: sev,
      });
      continue;
    }
    // path:line: [W... ] message
    m = line.match(/^(.*?):(\d+):\s*\[([A-Z]\d+)[^\]]*\]\s*(.*)$/);
    if (m) {
      const code = m[3];
      const sev = code.startsWith('E') || code.startsWith('F') ? 'error' : code.startsWith('W') ? 'warning' : 'info';
      diags.push({
        tool: 'pylint',
        type: 'diagnostic',
        file: m[1],
        line: Number(m[2]),
        message: m[4],
        code,
        severity: sev,
      });
    }
  }
  return diags;
}

function tryParseJson(text: string): any | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function normalizeToolOutput(
  toolOrCommand: string,
  output: Readonly<{ stdout?: string; stderr?: string }> | unknown
): NormalizedDiagnostic[] {
  const name = toolOrCommand.toLowerCase();
  const stdout = (output as any)?.stdout ?? '';
  const stderr = (output as any)?.stderr ?? '';
  const primary = typeof stdout === 'string' && stdout.length >= stderr.length ? stdout : stderr;

  if (name.includes('eslint')) {
    const json = tryParseJson(primary);
    return json ? parseESLint(json) : parseESLint(primary);
  }
  if (name.includes('flake8')) return parseFlake8(primary);
  if (name.includes('mypy')) return parseMypy(primary);
  if (name.includes('pylint')) return parsePylint(primary);

  // fallback regex for generic "file:line: message"
  const generic: NormalizedDiagnostic[] = [];
  const lines = String(primary || '').split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^(.*?):(\d+):\s*(.*)$/);
    if (m) {
      generic.push({ tool: name, type: 'diagnostic', file: m[1], line: Number(m[2]), message: m[3] });
    }
  }
  return generic;
}

export default normalizeToolOutput;

