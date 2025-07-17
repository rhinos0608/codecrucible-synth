// Extension API Routes - Integration with existing server infrastructure
// Following AI_INSTRUCTIONS.md security patterns and CodingPhilosophy.md consciousness principles

import { Router } from 'express';
import { z } from 'zod';
import { ExtensionApiGateway, authenticateExtension, extensionRateLimit } from './gateway.js';
import { logger } from '../logger.js';

const router = Router();

// Apply rate limiting and authentication to all extension routes
router.use(extensionRateLimit);
router.use(authenticateExtension);

// Extension authentication endpoint
router.post('/auth', async (req, res) => {
  try {
    await ExtensionApiGateway.authenticate(req, res);
  } catch (error) {
    logger.error('Extension auth route error', { error: error.message });
    res.status(500).json({ error: 'Authentication service unavailable' });
  }
});

// Extension health check
router.get('/health', async (req, res) => {
  try {
    await ExtensionApiGateway.health(req, res);
  } catch (error) {
    logger.error('Extension health route error', { error: error.message });
    res.status(500).json({ error: 'Health check service unavailable' });
  }
});

// Voice recommendations for extensions
router.post('/recommendations', async (req, res) => {
  try {
    await ExtensionApiGateway.recommend(req, res);
  } catch (error) {
    logger.error('Extension recommendations route error', { error: error.message });
    res.status(500).json({ error: 'Recommendation service unavailable' });
  }
});

// Code generation for extensions
router.post('/generate', async (req, res) => {
  try {
    await ExtensionApiGateway.generate(req, res);
  } catch (error) {
    logger.error('Extension generation route error', { error: error.message });
    res.status(500).json({ error: 'Generation service unavailable' });
  }
});

// Solution synthesis for extensions
router.post('/synthesize', async (req, res) => {
  try {
    await ExtensionApiGateway.synthesize(req, res);
  } catch (error) {
    logger.error('Extension synthesis route error', { error: error.message });
    res.status(500).json({ error: 'Synthesis service unavailable' });
  }
});

// Extension usage analytics
router.get('/usage', async (req, res) => {
  try {
    const usage = {
      platform: req.extension.platform,
      requestCount: 1, // Would be tracked in real implementation
      lastUsed: new Date().toISOString(),
      features: {
        generation: true,
        synthesis: true,
        recommendations: true,
        analytics: true
      }
    };

    res.json(usage);
  } catch (error) {
    logger.error('Extension usage route error', { error: error.message });
    res.status(500).json({ error: 'Usage analytics unavailable' });
  }
});

export { router as extensionApiRoutes };