import yaml from 'yaml';

/**
 * FormatTransformer converts structured data into common output formats.
 */
class FormatTransformer {
  /**
   * Transform a JavaScript value into the requested format.
   */
  to(format: 'json' | 'yaml' | 'markdown', data: unknown): string {
    switch (format) {
      case 'yaml':
        return yaml.stringify(data);
      case 'markdown':
        if (typeof data === 'string') {
          return data;
        }
        return `\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``;
      case 'json':
      default:
        return JSON.stringify(data, null, 2);
    }
  }
}

export { FormatTransformer };
