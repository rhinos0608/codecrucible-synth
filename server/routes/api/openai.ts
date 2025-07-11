import express from "express";
import { callOpenAI, validateOpenAIRequest } from "../../lib/openai";
import { isAuthenticated } from "../../replitAuth";
import { logger } from "../../logger";
import { securityMiddleware } from "../../security-middleware";

const router = express.Router();

/**
 * Internal OpenAI proxy endpoint for development
 * POST /api/openai
 * Body: { prompt: string, model?: string, temperature?: number, max_tokens?: number }
 * Response: { result: string, model: string, usage?: object }
 */
router.post("/", 
  // Security middleware
  securityMiddleware.createRateLimit(60000, 30, 'openai-proxy'), // 30 requests per minute
  securityMiddleware.validateInput({
    body: {
      prompt: { type: 'string', required: true },
      model: { type: 'string', required: false },
      temperature: { type: 'number', required: false },
      max_tokens: { type: 'number', required: false }
    }
  }),
  isAuthenticated,
  async (req, res) => {
    const startTime = Date.now();
    const userId = req.user?.claims?.sub;
    
    try {
      // Validate request parameters
      const requestData = validateOpenAIRequest(req.body);
      
      logger.info('OpenAI proxy request', {
        userId: userId?.substring(0, 8) + '...',
        model: requestData.model,
        promptLength: requestData.prompt.length,
        ip: req.ip,
        userAgent: req.get('User-Agent')?.substring(0, 100)
      });

      // Call OpenAI API
      const response = await callOpenAI(requestData);

      const duration = Date.now() - startTime;
      
      logger.info('OpenAI proxy success', {
        userId: userId?.substring(0, 8) + '...',
        model: response.model,
        promptLength: requestData.prompt.length,
        responseLength: response.result.length,
        duration: `${duration}ms`,
        tokensUsed: response.usage?.total_tokens || 0
      });

      res.json({
        result: response.result,
        model: response.model,
        usage: response.usage
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error("OpenAI proxy error", error as Error, {
        userId: userId?.substring(0, 8) + '...',
        duration: `${duration}ms`,
        ip: req.ip,
        userAgent: req.get('User-Agent')?.substring(0, 100)
      });

      const errorMessage = (error as Error).message;
      let statusCode = 500;

      // Map specific errors to appropriate status codes
      if (errorMessage.includes('Missing or invalid prompt') || 
          errorMessage.includes('Prompt cannot be empty') ||
          errorMessage.includes('exceeds maximum length') ||
          errorMessage.includes('must be a string') ||
          errorMessage.includes('must be a number')) {
        statusCode = 400;
      } else if (errorMessage.includes('API key') || errorMessage.includes('authentication')) {
        statusCode = 401;
      } else if (errorMessage.includes('quota') || errorMessage.includes('rate limit')) {
        statusCode = 429;
      }

      res.status(statusCode).json({ 
        error: errorMessage,
        code: 'OPENAI_PROXY_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }
);

export default router;