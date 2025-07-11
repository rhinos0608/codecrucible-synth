import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { storage } from "./storage";
import { openaiService } from "./openai-service";
import { logger, APIError } from "./logger";
import { 
  insertVoiceSessionSchema, 
  insertSolutionSchema, 
  insertSynthesisSchema,
  insertPhantomLedgerEntrySchema 
} from "@shared/schema";

// Request validation schemas following AI_INSTRUCTIONS.md patterns
const generateSessionRequestSchema = z.object({
  prompt: z.string().min(1).max(2000),
  selectedVoices: z.object({
    perspectives: z.array(z.string()).min(1),
    roles: z.array(z.string()).min(1)
  }),
  recursionDepth: z.number().int().min(1).max(3),
  synthesisMode: z.enum(["consensus", "competitive", "collaborative"]),
  ethicalFiltering: z.boolean()
});

const synthesisRequestSchema = z.object({
  sessionId: z.number().int().positive(),
  solutionIds: z.array(z.number().int().positive()).min(1)
});

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Generate real solutions using OpenAI following AI_INSTRUCTIONS.md
  app.post("/api/sessions", async (req, res, next) => {
    try {
      logger.info('Received session generation request', { 
        body: req.body,
        ip: req.ip 
      });

      const requestData = generateSessionRequestSchema.parse(req.body);
      
      // Security validation following AI_INSTRUCTIONS.md patterns
      if (!requestData.prompt || requestData.prompt.trim().length === 0) {
        throw new APIError(400, 'Prompt is required and cannot be empty');
      }
      
      if (!requestData.selectedVoices?.perspectives?.length || !requestData.selectedVoices?.roles?.length) {
        throw new APIError(400, 'At least one perspective and one role must be selected');
      }

      logger.info('Creating voice session', { 
        userId: 1, 
        prompt: requestData.prompt.substring(0, 50) + '...',
        perspectiveCount: requestData.selectedVoices.perspectives.length,
        roleCount: requestData.selectedVoices.roles.length
      });
      
      // Create session following security patterns
      const sessionData = {
        prompt: requestData.prompt,
        selectedVoices: requestData.selectedVoices,
        recursionDepth: requestData.recursionDepth,
        synthesisMode: requestData.synthesisMode,
        ethicalFiltering: requestData.ethicalFiltering,
        userId: 1 // Default user for now
      };

      const session = await storage.createVoiceSession(sessionData);
      
      // Generate real solutions using OpenAI with dual-transmission protocols
      const solutions = await generateRealSolutions(session.id, requestData);
      
      logger.info('Session generation completed', {
        sessionId: session.id,
        solutionCount: solutions.length
      });
      
      res.json({ session, solutions });
    } catch (error) {
      next(error);
    }
  });

  // Get solutions for a session with security validation
  app.get("/api/sessions/:id/solutions", async (req, res, next) => {
    try {
      const sessionId = parseInt(req.params.id);
      
      if (isNaN(sessionId) || sessionId <= 0) {
        throw new APIError(400, 'Invalid session ID');
      }
      
      logger.debug('Fetching solutions for session', { sessionId });
      
      const solutions = await storage.getSolutionsBySession(sessionId);
      res.json(solutions);
    } catch (error) {
      next(error);
    }
  });

  // Create real synthesis using OpenAI
  app.post("/api/sessions/:id/synthesis", async (req, res, next) => {
    try {
      const sessionId = parseInt(req.params.id);
      
      if (isNaN(sessionId) || sessionId <= 0) {
        throw new APIError(400, 'Invalid session ID');
      }
      
      logger.info('Starting solution synthesis', { sessionId });
      
      // Get solutions for the session
      const solutions = await storage.getSolutionsBySession(sessionId);
      if (solutions.length === 0) {
        throw new APIError(404, 'No solutions found for this session');
      }
      
      // Use OpenAI to synthesize solutions
      const synthesizedCode = await openaiService.synthesizeSolutions(
        solutions.map(sol => ({
          voiceCombination: sol.voiceCombination,
          code: sol.code,
          explanation: sol.explanation,
          confidence: sol.confidence,
          strengths: sol.strengths as string[],
          considerations: sol.considerations as string[],
          perspective: sol.voiceCombination.split(' + ')[0],
          role: sol.voiceCombination.split(' + ')[1]
        })), 
        sessionId
      );
      
      // Create synthesis record
      const synthesis = await storage.createSynthesis({
        sessionId,
        combinedCode: synthesizedCode,
        synthesisSteps: [`Analyzed ${solutions.length} solutions`, "Applied OpenAI synthesis", "Generated final code"],
        qualityScore: Math.round(solutions.reduce((sum, sol) => sum + sol.confidence, 0) / solutions.length),
        ethicalScore: 85 // Default high ethical score for AI-generated content
      });
      
      // Create decision history entry
      const session = await storage.getVoiceSession(sessionId);
      if (session) {
        await storage.createPhantomLedgerEntry({
          sessionId,
          title: `Code Merge: ${session.prompt.substring(0, 50)}...`,
          voicesEngaged: session.selectedVoices as any,
          decisionOutcome: synthesis.combinedCode.substring(0, 100) + "...",
          keyLearnings: [
            "OpenAI-powered solution synthesis",
            `Merged ${solutions.length} perspectives`,
            "Maintained AI_INSTRUCTIONS.md compliance"
          ] as any,
          ethicalScore: synthesis.ethicalScore
        });
      }
      
      logger.info('Solution synthesis completed', {
        sessionId,
        synthesisId: synthesis.id,
        qualityScore: synthesis.qualityScore
      });
      
      res.json(synthesis);
    } catch (error) {
      next(error);
    }
  });

  // Get decision history entries (renamed from phantom ledger)
  app.get("/api/decision-history", async (req, res, next) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      
      if (isNaN(limit) || limit < 1 || limit > 100) {
        throw new APIError(400, 'Invalid limit parameter. Must be between 1 and 100.');
      }
      
      logger.debug('Fetching decision history entries', { limit });
      
      const entries = await storage.getPhantomLedgerEntries(limit);
      res.json(entries);
    } catch (error) {
      next(error);
    }
  });

  // Get error logs for debugging
  app.get("/api/logs", async (req, res, next) => {
    try {
      const level = req.query.level as string;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      
      if (limit && (isNaN(limit) || limit < 1 || limit > 500)) {
        throw new APIError(400, 'Invalid limit parameter. Must be between 1 and 500.');
      }
      
      logger.debug('Fetching system logs', { level, limit });
      
      const logs = logger.getRecentLogs(limit, level as any);
      res.json({
        logs,
        count: logs.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  });

  // Get logs for specific session
  app.get("/api/sessions/:id/logs", async (req, res, next) => {
    try {
      const sessionId = req.params.id;
      
      if (!sessionId) {
        throw new APIError(400, 'Session ID is required');
      }
      
      logger.debug('Fetching session logs', { sessionId });
      
      const logs = logger.getSessionLogs(sessionId);
      res.json({
        logs,
        sessionId,
        count: logs.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  });

  // Get user sessions for analytics
  app.get("/api/analytics", async (req, res) => {
    try {
      const userId = 1; // Default user for MVP
      const sessions = await storage.getVoiceSessionsByUser(userId);
      const ledgerEntries = await storage.getPhantomLedgerEntriesByUser(userId);
      
      const analytics = {
        totalSessions: sessions.length,
        averageEthicalScore: ledgerEntries.reduce((sum, entry) => sum + entry.ethicalScore, 0) / ledgerEntries.length || 0,
        averageVoicesPerSession: sessions.reduce((sum, session) => sum + (session.selectedVoices as any[]).length, 0) / sessions.length || 0,
        learningInsights: ledgerEntries.reduce((sum, entry) => sum + (entry.keyLearnings as any[]).length, 0)
      };
      
      res.json(analytics);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Real OpenAI solution generation following AI_INSTRUCTIONS.md
async function generateRealSolutions(sessionId: number, requestData: any) {
  const solutions = [];
  const { selectedVoices, prompt, recursionDepth, synthesisMode, ethicalFiltering } = requestData;
  
  logger.info('Generating real solutions with OpenAI', {
    sessionId,
    perspectiveCount: selectedVoices.perspectives.length,
    roleCount: selectedVoices.roles.length,
    prompt: prompt.substring(0, 100) + '...'
  });

  try {
    // Generate solutions for each perspective-role combination
    for (const perspective of selectedVoices.perspectives) {
      for (const role of selectedVoices.roles) {
        logger.debug('Generating solution', { sessionId, perspective, role });
        
        const generatedSolution = await openaiService.generateSolution({
          prompt,
          perspectives: selectedVoices.perspectives,
          roles: selectedVoices.roles,
          analysisDepth: recursionDepth,
          mergeStrategy: synthesisMode,
          qualityFiltering: ethicalFiltering,
          sessionId
        }, perspective, role);

        // Store solution in database following AI_INSTRUCTIONS.md security patterns
        const solution = await storage.createSolution({
          sessionId,
          voiceCombination: generatedSolution.voiceCombination,
          code: generatedSolution.code,
          explanation: generatedSolution.explanation,
          confidence: generatedSolution.confidence,
          strengths: generatedSolution.strengths,
          considerations: generatedSolution.considerations
        });

        solutions.push(solution);
        
        logger.debug('Solution generated and stored', {
          sessionId,
          solutionId: solution.id,
          confidence: solution.confidence
        });
      }
    }

    logger.info('All solutions generated successfully', {
      sessionId,
      totalSolutions: solutions.length
    });

    return solutions;

  } catch (error) {
    logger.error('Failed to generate real solutions', error as Error, { sessionId });
    
    if (error instanceof APIError) {
      throw error;
    }
    
    throw new APIError(500, `Solution generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Legacy mock solution generation (remove after testing)
async function generateMockSolutions(sessionId: number, selectedVoices: any) {
  const mockSolutions = [
    {
      sessionId,
      voiceCombination: "Steward + Guardian",
      code: `// Security-focused form validation hook
import { useState, useCallback } from 'react';
import { z } from 'zod';

export function useSecureForm<T>(schema: z.ZodSchema<T>) {
  const [values, setValues] = useState<Partial<T>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const validate = useCallback((data: Partial<T>) => {
    try {
      schema.parse(data);
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach(err => {
          newErrors[err.path.join('.')] = err.message;
        });
        setErrors(newErrors);
      }
      return false;
    }
  }, [schema]);
  
  return { values, setValues, errors, validate };
}`,
      explanation: "Security-first approach with comprehensive input validation and XSS protection",
      confidence: 94,
      strengths: ["Input sanitization", "XSS protection", "Type safety"],
      considerations: ["More complex setup", "Performance overhead"]
    },
    {
      sessionId,
      voiceCombination: "Seeker + Optimizer",
      code: `// High-performance form hook with debouncing
import { useCallback, useMemo, useState } from 'react';
import { debounce } from 'lodash';

export function useOptimizedForm<T>() {
  const [values, setValues] = useState<Partial<T>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const debouncedValidation = useMemo(
    () => debounce((data: Partial<T>) => {
      // Validation logic here
    }, 300),
    []
  );
  
  const updateValue = useCallback((field: keyof T, value: any) => {
    setValues(prev => ({ ...prev, [field]: value }));
    debouncedValidation({ ...values, [field]: value });
  }, [values, debouncedValidation]);
  
  return { values, errors, updateValue };
}`,
      explanation: "Performance-optimized approach with debounced validation and memory efficiency",
      confidence: 89,
      strengths: ["Optimized renders", "Debounced validation", "Memory efficient"],
      considerations: ["Complex optimization", "Debugging difficulty"]
    }
  ];

  const promises = mockSolutions.map(solution => storage.createSolution(solution));
  return Promise.all(promises);
}
