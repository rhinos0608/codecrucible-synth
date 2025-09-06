/**
 * Utility functions for extracting content from MCP tool responses
 * Addresses architectural debt: Handle multiple tool results instead of only first entry
 */

export interface MCPContentItem {
  type: string;
  text: string;
}

export interface MCPToolResult {
  content?: MCPContentItem[];
  isError?: boolean;
}

/**
 * Extract all text content from MCP response, handling multiple content entries
 * @param content Array of content items from MCP response
 * @param separator String to join multiple content entries (default: '\n')
 * @returns Combined text from all content entries
 */
export function extractAllContentText(
  content: MCPContentItem[] | undefined,
  separator: string = '\n'
): string {
  if (!content || !Array.isArray(content)) {
    return '';
  }

  return content
    .filter(item => item && typeof item.text === 'string')
    .map(item => item.text)
    .join(separator);
}

/**
 * Extract text content by type from MCP response
 * @param content Array of content items from MCP response
 * @param type Content type to filter for (default: 'text')
 * @param separator String to join multiple content entries (default: '\n')
 * @returns Combined text from matching content entries
 */
export function extractContentByType(
  content: MCPContentItem[] | undefined,
  type: string = 'text',
  separator: string = '\n'
): string {
  if (!content || !Array.isArray(content)) {
    return '';
  }

  return content
    .filter(item => item && item.type === type && typeof item.text === 'string')
    .map(item => item.text)
    .join(separator);
}

/**
 * Safe extraction of first content item (backward compatibility)
 * @param content Array of content items from MCP response
 * @returns First content item's text or empty string
 */
export function extractFirstContentText(content: MCPContentItem[] | undefined): string {
  if (!content || !Array.isArray(content) || content.length === 0) {
    return '';
  }

  const firstItem = content[0];
  return firstItem && typeof firstItem.text === 'string' ? firstItem.text : '';
}

/**
 * Extract content with fallback strategies for robust error handling
 * @param result MCP tool result object
 * @returns Extracted content text using multiple fallback strategies
 */
export function robustContentExtraction(result: MCPToolResult): string {
  // Strategy 1: Extract all content
  const allContent = extractAllContentText(result.content);
  if (allContent.trim()) {
    return allContent;
  }

  // Strategy 2: Try first content only (backward compatibility)
  const firstContent = extractFirstContentText(result.content);
  if (firstContent.trim()) {
    return firstContent;
  }

  // Strategy 3: Check for error content
  if (result.isError && result.content) {
    const errorContent = extractContentByType(result.content, 'error', ' | ');
    if (errorContent.trim()) {
      return errorContent;
    }
  }

  // Final fallback
  return '';
}
