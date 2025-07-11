import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { storage } from "./storage";
import { 
  insertVoiceSessionSchema, 
  insertSolutionSchema, 
  insertSynthesisSchema,
  insertPhantomLedgerEntrySchema 
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Generate solutions for a voice session
  app.post("/api/sessions", async (req, res) => {
    try {
      const sessionData = insertVoiceSessionSchema.parse(req.body);
      const session = await storage.createVoiceSession(sessionData);
      
      // Generate mock solutions for selected voices
      const solutions = await generateMockSolutions(session.id, sessionData.selectedVoices);
      
      res.json({ session, solutions });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Invalid request" });
    }
  });

  // Get solutions for a session
  app.get("/api/sessions/:id/solutions", async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const solutions = await storage.getSolutionsBySession(sessionId);
      res.json(solutions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch solutions" });
    }
  });

  // Create synthesis for a session
  app.post("/api/sessions/:id/synthesis", async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const synthesisData = insertSynthesisSchema.parse({
        ...req.body,
        sessionId
      });
      
      const synthesis = await storage.createSynthesis(synthesisData);
      
      // Create phantom ledger entry
      const session = await storage.getVoiceSession(sessionId);
      if (session) {
        await storage.createPhantomLedgerEntry({
          sessionId,
          title: `Synthesis: ${session.prompt.substring(0, 50)}...`,
          voicesEngaged: session.selectedVoices,
          decisionOutcome: synthesisData.combinedCode.substring(0, 100) + "...",
          keyLearnings: ["Successful voice convergence", "Effective synthesis achieved"],
          ethicalScore: synthesisData.ethicalScore
        });
      }
      
      res.json(synthesis);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Invalid request" });
    }
  });

  // Get phantom ledger entries
  app.get("/api/phantom-ledger", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const entries = await storage.getPhantomLedgerEntries(limit);
      res.json(entries);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch ledger entries" });
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

// Mock solution generation
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
