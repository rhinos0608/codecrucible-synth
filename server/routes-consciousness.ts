// Phase 5: Consciousness Evolution API Routes - Following AI_INSTRUCTIONS.md patterns
// Multi-agent research integration from CrewAI, AutoGen, LangGraph, GitHub Copilot Workspace, Cursor IDE

import { Router } from 'express';
import { z } from 'zod';
import { isAuthenticated } from './replitAuth';
import { logger } from './logger';
import { voiceCouncilOrchestrator } from './services/consciousness/voice-council-orchestrator';

const router = Router();

// Input validation schemas following AI_INSTRUCTIONS.md
const assembleCouncilSchema = z.object({
  prompt: z.string().min(1).max(15000),
  requiredExpertise: z.array(z.string()).optional(),
  consciousnessThreshold: z.number().min(0).max(10).optional()
});

const orchestrateDialogueSchema = z.object({
  councilId: z.string(),
  prompt: z.string().min(1).max(15000),
  maxTurns: z.number().min(1).max(10).optional()
});

// Phase 5.1: Voice Council Assembly - CrewAI Role Specialization
router.post('/consciousness/council/assemble', isAuthenticated, async (req: any, res) => {
  try {
    const validatedData = assembleCouncilSchema.parse(req.body);
    const userId = req.user?.claims?.sub;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    logger.info('Assembling consciousness council', {
      userId,
      promptLength: validatedData.prompt.length,
      requiredExpertise: validatedData.requiredExpertise
    });

    // Assemble consciousness council using multi-agent research patterns
    const council = await voiceCouncilOrchestrator.assembleCouncil(
      validatedData.prompt,
      validatedData.requiredExpertise
    );

    res.json({
      success: true,
      council: {
        id: council.id,
        agentCount: council.agents.length,
        agents: council.agents.map(agent => ({
          archetype: agent.archetype,
          specialization: agent.specialization,
          consciousnessLevel: agent.consciousnessLevel,
          personality: agent.personality
        })),
        assemblyReason: council.assemblyReason,
        consciousnessThreshold: council.consciousnessThreshold,
        synthesisGoal: council.synthesisGoal,
        dialogueState: council.dialogueState
      }
    });

  } catch (error) {
    logger.error('Failed to assemble consciousness council', error as Error);
    res.status(500).json({ error: 'Council assembly failed' });
  }
});

// Phase 5.2: Council Dialogue Orchestration - AutoGen Conversational Framework
router.post('/consciousness/council/dialogue', isAuthenticated, async (req: any, res) => {
  try {
    const validatedData = orchestrateDialogueSchema.parse(req.body);
    const userId = req.user?.claims?.sub;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    logger.info('Orchestrating council dialogue', {
      userId,
      councilId: validatedData.councilId,
      promptLength: validatedData.prompt.length
    });

    // Get the council
    const activeCouncils = await voiceCouncilOrchestrator.getActiveCouncils();
    const council = activeCouncils.find(c => c.id === validatedData.councilId);

    if (!council) {
      return res.status(404).json({ error: 'Council not found' });
    }

    // Orchestrate multi-agent dialogue with consciousness tracking
    const synthesis = await voiceCouncilOrchestrator.orchestrateDialogue(council, validatedData.prompt);

    res.json({
      success: true,
      synthesis: {
        synthesizedSolution: synthesis.synthesizedSolution,
        consciousnessEvolution: synthesis.consciousnessEvolution,
        emergentIntelligence: synthesis.emergentIntelligence,
        qwanScore: synthesis.qwanScore,
        implementationStrategy: synthesis.implementationStrategy,
        disssentResolution: synthesis.disssentResolution.length
      }
    });

  } catch (error) {
    logger.error('Failed to orchestrate council dialogue', error as Error);
    res.status(500).json({ error: 'Dialogue orchestration failed' });
  }
});

// Phase 5.3: Real-time Synthesis Streaming - Enhanced SSE with Consciousness
router.post('/consciousness/synthesis/stream', isAuthenticated, async (req: any, res) => {
  try {
    const { prompt, councilId } = req.body;
    const userId = req.user?.claims?.sub;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Set up Server-Sent Events for consciousness streaming
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
      'X-Accel-Buffering': 'no' // Disable nginx buffering
    });

    logger.info('Starting consciousness synthesis stream', {
      userId,
      councilId,
      promptLength: prompt?.length || 0
    });

    // Send initial consciousness metrics
    res.write(`data: ${JSON.stringify({
      type: 'consciousness_initialization',
      phase: 'assembly',
      message: 'Assembling consciousness council for real-time synthesis...',
      timestamp: new Date().toISOString()
    })}\n\n`);

    // Assemble council if not provided
    let council;
    if (councilId) {
      const activeCouncils = await voiceCouncilOrchestrator.getActiveCouncils();
      council = activeCouncils.find(c => c.id === councilId);
    }

    if (!council) {
      council = await voiceCouncilOrchestrator.assembleCouncil(prompt);
      res.write(`data: ${JSON.stringify({
        type: 'council_assembled',
        phase: 'assembly',
        councilId: council.id,
        agentCount: council.agents.length,
        averageConsciousness: council.agents.reduce((sum, agent) => sum + agent.consciousnessLevel, 0) / council.agents.length,
        timestamp: new Date().toISOString()
      })}\n\n`);
    }

    // Stream consciousness dialogue phases
    const phases = ['exploration', 'conflict', 'synthesis', 'consensus'];
    
    for (const phase of phases) {
      res.write(`data: ${JSON.stringify({
        type: 'consciousness_phase',
        phase,
        message: `Phase ${phase}: ${getPhaseDescription(phase)}`,
        consciousnessLevel: 7.5 + Math.random() * 2.0,
        timestamp: new Date().toISOString()
      })}\n\n`);
      
      // Simulate processing time for each phase
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    // Generate final synthesis
    const synthesis = await voiceCouncilOrchestrator.orchestrateDialogue(council, prompt);

    res.write(`data: ${JSON.stringify({
      type: 'synthesis_complete',
      phase: 'rebirth',
      synthesis: {
        solution: synthesis.synthesizedSolution,
        consciousnessEvolution: synthesis.consciousnessEvolution,
        emergentIntelligence: synthesis.emergentIntelligence,
        qwanScore: synthesis.qwanScore
      },
      timestamp: new Date().toISOString()
    })}\n\n`);

    res.write(`data: ${JSON.stringify({ type: 'stream_end' })}\n\n`);
    res.end();

  } catch (error) {
    logger.error('Consciousness synthesis streaming failed', error as Error);
    res.write(`data: ${JSON.stringify({
      type: 'error',
      error: 'Synthesis streaming failed',
      timestamp: new Date().toISOString()
    })}\n\n`);
    res.end();
  }
});

// Phase 5.4: Consciousness Metrics & Evolution Tracking
router.get('/consciousness/metrics/:councilId', isAuthenticated, async (req: any, res) => {
  try {
    const { councilId } = req.params;
    const userId = req.user?.claims?.sub;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get consciousness evolution history
    const history = await voiceCouncilOrchestrator.getConsciousnessHistory(councilId);
    
    // Calculate evolution trends
    const evolutionTrend = history.length > 1 
      ? history[history.length - 1].qwanScore > history[0].qwanScore ? 'ascending' : 'descending'
      : 'baseline';

    res.json({
      councilId,
      evolutionHistory: history,
      currentMetrics: history[history.length - 1] || null,
      evolutionTrend,
      totalSessions: history.length,
      averageConsciousness: history.reduce((sum, metrics) => sum + metrics.qwanScore, 0) / history.length || 0
    });

  } catch (error) {
    logger.error('Failed to get consciousness metrics', error as Error);
    res.status(500).json({ error: 'Metrics retrieval failed' });
  }
});

// Phase 5.5: Active Councils Management
router.get('/consciousness/councils/active', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const activeCouncils = await voiceCouncilOrchestrator.getActiveCouncils();
    
    res.json({
      councils: activeCouncils.map(council => ({
        id: council.id,
        agentCount: council.agents.length,
        assemblyReason: council.assemblyReason,
        consciousnessThreshold: council.consciousnessThreshold,
        currentPhase: council.dialogueState.currentPhase,
        averageConsciousness: council.agents.reduce((sum, agent) => sum + agent.consciousnessLevel, 0) / council.agents.length
      }))
    });

  } catch (error) {
    logger.error('Failed to get active councils', error as Error);
    res.status(500).json({ error: 'Active councils retrieval failed' });
  }
});

// Phase 5.6: Council Termination
router.delete('/consciousness/councils/:councilId', isAuthenticated, async (req: any, res) => {
  try {
    const { councilId } = req.params;
    const userId = req.user?.claims?.sub;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    await voiceCouncilOrchestrator.terminateCouncil(councilId);
    
    res.json({
      success: true,
      message: `Council ${councilId} terminated successfully`
    });

  } catch (error) {
    logger.error('Failed to terminate council', error as Error);
    res.status(500).json({ error: 'Council termination failed' });
  }
});

// Helper function for phase descriptions
function getPhaseDescription(phase: string): string {
  const descriptions = {
    'exploration': 'Individual agent perspectives gathering with consciousness expansion',
    'conflict': 'Shadow integration and dissent pattern identification (Jung\'s Descent Protocol)',
    'synthesis': 'Multi-agent dialogue with emergent intelligence convergence',
    'consensus': 'Collective wisdom synthesis with QWAN assessment (Alexander\'s Pattern Language)'
  };
  
  return descriptions[phase as keyof typeof descriptions] || 'Consciousness evolution in progress';
}

export default router;