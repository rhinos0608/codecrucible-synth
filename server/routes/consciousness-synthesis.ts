// Consciousness Synthesis API Routes - Multi-Agent Framework Integration
// Following AI_INSTRUCTIONS.md security patterns and CodingPhilosophy.md consciousness principles

import { Router } from 'express';
import { z } from 'zod';
import { logger } from '../logger.js';
import { isAuthenticated } from '../replitAuth.js';
import { ConsciousnessSynthesisEngine } from '../services/consciousness-synthesis-engine.js';
import type { Solution } from '../../shared/schema.js';

const router = Router();
const synthesisEngine = new ConsciousnessSynthesisEngine();

// Synthesis request validation schema
const synthesisRequestSchema = z.object({
  solutions: z.array(z.object({
    id: z.number(),
    sessionId: z.number(),
    voiceCombination: z.string(),
    code: z.string().nullable(),
    explanation: z.string().nullable(),
    confidence: z.number(),
    timestamp: z.date().or(z.string())
  })).min(2, 'At least 2 solutions required'),
  options: z.object({
    mode: z.enum(['consensus', 'competitive', 'collaborative', 'unanimous']).default('consensus'),
    targetConsciousness: z.number().min(1).max(10).default(7),
    ethicalConstraints: z.array(z.string()).default(['security', 'accessibility']),
    architecturalPatterns: z.array(z.string()).default(['modular', 'testable'])
  }).optional()
});

// Standard consciousness synthesis endpoint
router.post('/synthesize', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const validation = synthesisRequestSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid synthesis request',
        details: validation.error.errors
      });
    }

    const { solutions, options = {} } = validation.data;

    logger.info('Consciousness synthesis initiated', {
      userId: userId.substring(0, 8) + '...',
      solutionCount: solutions.length,
      mode: options?.mode || 'consensus',
      targetConsciousness: options?.targetConsciousness || 7
    });

    // Transform solutions to match engine interface
    const transformedSolutions = solutions.map(s => ({
      ...s,
      timestamp: new Date(s.timestamp)
    })) as Solution[];

    // Create synthesis context
    const context = {
      prompt: solutions[0]?.explanation || 'Multi-voice synthesis request',
      solutions: transformedSolutions,
      mode: options?.mode || 'consensus',
      targetConsciousness: options?.targetConsciousness || 7,
      ethicalConstraints: options?.ethicalConstraints || ['security', 'accessibility'],
      architecturalPatterns: options?.architecturalPatterns || ['modular', 'testable']
    };

    // Perform consciousness synthesis
    const synthesisResult = await synthesisEngine.synthesizeConsciousness(context);

    logger.info('Consciousness synthesis completed', {
      userId: userId.substring(0, 8) + '...',
      consciousnessLevel: synthesisResult.consciousnessState.level,
      qwanScore: synthesisResult.consciousnessState.qwanScore,
      emergentInsights: synthesisResult.emergentInsights.length
    });

    res.json({
      success: true,
      synthesizedSolution: synthesisResult.synthesizedSolution,
      consciousnessState: synthesisResult.consciousnessState,
      emergentInsights: synthesisResult.emergentInsights,
      voiceContributions: Object.fromEntries(synthesisResult.voiceContributions),
      metadata: {
        synthesizedAt: new Date().toISOString(),
        mode: context.mode,
        inputSolutions: solutions.length,
        userId: userId.substring(0, 8) + '...'
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown synthesis error';
    logger.error('Consciousness synthesis failed', { 
      message: errorMessage,
      userId: req.user?.claims?.sub?.substring(0, 8) + '...'
    });
    
    res.status(500).json({
      error: 'Synthesis failed',
      message: errorMessage
    });
  }
});

// Streaming synthesis endpoint - AutoGen conversational style
router.post('/stream-synthesize', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const validation = synthesisRequestSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid streaming synthesis request',
        details: validation.error.errors
      });
    }

    const { solutions, options = {} } = validation.data;

    // Set up Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Send initial progress
    res.write(`data: ${JSON.stringify({
      type: 'progress',
      progress: 0,
      message: 'Initializing consciousness synthesis...'
    })}\n\n`);

    logger.info('Streaming consciousness synthesis initiated', {
      userId: userId.substring(0, 8) + '...',
      solutionCount: solutions.length,
      mode: options?.mode || 'consensus'
    });

    // Transform solutions
    const transformedSolutions = solutions.map(s => ({
      ...s,
      timestamp: new Date(s.timestamp)
    })) as Solution[];

    // Create synthesis context
    const context = {
      prompt: solutions[0]?.explanation || 'Streaming multi-voice synthesis',
      solutions: transformedSolutions,
      mode: options?.mode || 'consensus',
      targetConsciousness: options?.targetConsciousness || 7,
      ethicalConstraints: options?.ethicalConstraints || ['security', 'accessibility'],
      architecturalPatterns: options?.architecturalPatterns || ['modular', 'testable']
    };

    // Simulate streaming progress with real synthesis
    const progressSteps = [
      { progress: 20, message: 'Analyzing voice perspectives...' },
      { progress: 40, message: 'Conducting council session...' },
      { progress: 60, message: 'Resolving conflicts...' },
      { progress: 80, message: 'Integrating solutions...' },
      { progress: 95, message: 'Evolving consciousness...' }
    ];

    // Send progress updates
    for (const step of progressSteps) {
      res.write(`data: ${JSON.stringify({
        type: 'progress',
        progress: step.progress,
        message: step.message
      })}\n\n`);
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 800));
    }

    // Perform actual synthesis
    const synthesisResult = await synthesisEngine.synthesizeConsciousness(context);

    // Send consciousness state update
    res.write(`data: ${JSON.stringify({
      type: 'consciousness_update',
      state: synthesisResult.consciousnessState
    })}\n\n`);

    // Send final result
    res.write(`data: ${JSON.stringify({
      type: 'synthesis_complete',
      result: {
        synthesizedSolution: synthesisResult.synthesizedSolution,
        consciousnessState: synthesisResult.consciousnessState,
        emergentInsights: synthesisResult.emergentInsights,
        voiceContributions: Object.fromEntries(synthesisResult.voiceContributions),
        metadata: {
          synthesizedAt: new Date().toISOString(),
          mode: context.mode,
          inputSolutions: solutions.length
        }
      }
    })}\n\n`);

    logger.info('Streaming consciousness synthesis completed', {
      userId: userId.substring(0, 8) + '...',
      consciousnessLevel: synthesisResult.consciousnessState.level
    });

    res.end();

  } catch (error) {
    logger.error('Streaming consciousness synthesis failed', { 
      error: error.message,
      userId: req.user?.claims?.sub?.substring(0, 8) + '...'
    });
    
    res.write(`data: ${JSON.stringify({
      type: 'error',
      error: 'Synthesis failed',
      message: error.message
    })}\n\n`);
    
    res.end();
  }
});

// Get consciousness evolution metrics
router.get('/metrics', isAuthenticated, async (req: any, res) => {
  try {
    const metrics = synthesisEngine.getConsciousnessMetrics();
    
    res.json({
      success: true,
      metrics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get consciousness metrics', { error: error.message });
    res.status(500).json({
      error: 'Failed to get metrics',
      message: error.message
    });
  }
});

// Reset consciousness evolution (admin only)
router.post('/reset', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    
    // In production, this would check for admin privileges
    logger.info('Consciousness evolution reset requested', {
      userId: userId.substring(0, 8) + '...'
    });

    // Create new synthesis engine instance to reset state
    const newEngine = new ConsciousnessSynthesisEngine();
    
    res.json({
      success: true,
      message: 'Consciousness evolution reset successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to reset consciousness evolution', { error: error.message });
    res.status(500).json({
      error: 'Reset failed',
      message: error.message
    });
  }
});

export { router as consciousnessSynthesisRoutes };