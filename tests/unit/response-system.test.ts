import { describe, test, expect } from '@jest/globals';
import { 
  ResponseFactory, 
  ResponseValidator, 
  AgentResponse, 
  SynthesisResponse,
  ToolResponse,
  FileResponse 
} from '../../src/core/response-types';

/**
 * Test suite for standardized response system
 */
describe('Standardized Response System', () => {
  
  describe('ResponseFactory', () => {
    test('should create AgentResponse with correct structure', () => {
      const response = ResponseFactory.createAgentResponse('Test content', {
        confidence: 0.9,
        voiceId: 'developer',
        tokensUsed: 50,
        reasoning: 'Test reasoning'
      });

      expect(response.success).toBe(true);
      expect(response.content).toBe('Test content');
      expect(response.confidence).toBe(0.9);
      expect(response.voiceId).toBe('developer');
      expect(response.tokensUsed).toBe(50);
      expect(response.reasoning).toBe('Test reasoning');
      expect(response.timestamp).toBeCloseTo(Date.now(), -2);
    });

    test('should create SynthesisResponse with default values', () => {
      const response = ResponseFactory.createSynthesisResponse(
        'Combined content',
        ['developer', 'analyzer']
      );

      expect(response.success).toBe(true);
      expect(response.combinedContent).toBe('Combined content');
      expect(response.voicesUsed).toEqual(['developer', 'analyzer']);
      expect(response.confidence).toBe(0.8);
      expect(response.qualityScore).toBe(85);
      expect(response.synthesisMode).toBe('competitive');
      expect(response.reasoning).toBe('Multi-voice synthesis completed');
    });

    test('should create ToolResponse with execution metadata', () => {
      const response = ResponseFactory.createToolResponse('file-reader', { content: 'file data' }, {
        executionTime: 150,
        retryCount: 1
      });

      expect(response.success).toBe(true);
      expect(response.toolName).toBe('file-reader');
      expect(response.result).toEqual({ content: 'file data' });
      expect(response.executionTime).toBe(150);
      expect(response.retryCount).toBe(1);
    });

    test('should create FileResponse with file metadata', () => {
      const response = ResponseFactory.createFileResponse('/path/to/file.ts', 'read', {
        content: 'file content',
        size: 1024,
        language: 'typescript'
      });

      expect(response.success).toBe(true);
      expect(response.filePath).toBe('/path/to/file.ts');
      expect(response.operation).toBe('read');
      expect(response.content).toBe('file content');
      expect(response.size).toBe(1024);
      expect(response.language).toBe('typescript');
    });

    test('should create error responses', () => {
      const errorInfo = ResponseFactory.createErrorResponse(
        'TEST_ERROR',
        'This is a test error',
        'Additional details'
      );

      expect(errorInfo.code).toBe('TEST_ERROR');
      expect(errorInfo.message).toBe('This is a test error');
      expect(errorInfo.details).toBe('Additional details');
      expect(errorInfo.stack).toBeDefined();
    });
  });

  describe('ResponseValidator', () => {
    test('should validate correct responses', () => {
      const response = ResponseFactory.createAgentResponse('test');
      
      expect(ResponseValidator.isValidResponse(response)).toBe(true);
      expect(ResponseValidator.hasError(response)).toBe(false);
    });

    test('should detect invalid responses', () => {
      const invalidResponse = { invalid: true };
      
      expect(ResponseValidator.isValidResponse(invalidResponse)).toBe(false);
    });

    test('should detect error responses', () => {
      const response = ResponseFactory.createAgentResponse('');
      response.success = false;
      response.error = ResponseFactory.createErrorResponse('TEST', 'Error message');

      expect(ResponseValidator.hasError(response)).toBe(true);
      expect(ResponseValidator.getErrorMessage(response)).toBe('Error message');
    });

    test('should extract content from AgentResponse', () => {
      const agentResponse = ResponseFactory.createAgentResponse('Agent content');
      expect(ResponseValidator.extractContent(agentResponse)).toBe('Agent content');
    });

    test('should extract content from SynthesisResponse', () => {
      const synthesisResponse = ResponseFactory.createSynthesisResponse('Synthesis content', ['voice1']);
      expect(ResponseValidator.extractContent(synthesisResponse)).toBe('Synthesis content');
    });
  });

  describe('Response consistency', () => {
    test('all response types should have BaseResponse properties', () => {
      const agentResponse = ResponseFactory.createAgentResponse('test');
      const synthesisResponse = ResponseFactory.createSynthesisResponse('test', ['voice']);
      const toolResponse = ResponseFactory.createToolResponse('tool', 'result');
      const fileResponse = ResponseFactory.createFileResponse('/path', 'read');

      const responses = [agentResponse, synthesisResponse, toolResponse, fileResponse];

      responses.forEach(response => {
        expect(response.success).toBeDefined();
        expect(typeof response.success).toBe('boolean');
        expect(response.timestamp).toBeDefined();
        expect(typeof response.timestamp).toBe('number');
      });
    });

    test('error responses should maintain consistency', () => {
      const agentResponse = ResponseFactory.createAgentResponse('');
      agentResponse.success = false;
      agentResponse.error = ResponseFactory.createErrorResponse('TEST', 'Test error');

      expect(agentResponse.success).toBe(false);
      expect(agentResponse.error).toBeDefined();
      expect(agentResponse.error?.code).toBe('TEST');
      expect(agentResponse.error?.message).toBe('Test error');
    });
  });

  describe('Metadata handling', () => {
    test('should support metadata in base responses', () => {
      const response = ResponseFactory.createAgentResponse('test');
      response.metadata = {
        source: 'unit-test',
        version: '1.0.0',
        custom: { data: 'value' }
      };

      expect(response.metadata).toBeDefined();
      expect(response.metadata?.source).toBe('unit-test');
      expect(response.metadata?.custom.data).toBe('value');
    });
  });
});