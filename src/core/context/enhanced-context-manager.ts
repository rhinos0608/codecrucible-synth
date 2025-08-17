import { logger } from '../logger.js';
import { readFile, writeFile, access, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import { Task } from '../planning/enhanced-agentic-planner.js';
import { registerShutdownHandler, createManagedInterval, clearManagedInterval } from '../agent.js';

export interface ContextItem {
  key: string;
  value: any;
  timestamp: number;
  size: number;
  relevanceScore: number;
  sessionId: string;
  type: 'file' | 'conversation' | 'execution' | 'project' | 'temporary';
  metadata: {
    tags: string[];
    source: string;
    expiresAt?: number;
    priority: 'low' | 'medium' | 'high';
  };
}

export interface ContextQuery {
  keywords?: string[];
  type?: ContextItem['type'];
  sessionId?: string;
  tags?: string[];
  timeRange?: {
    start: number;
    end: number;
  };
  maxAge?: number;
  minRelevanceScore?: number;
}

export interface ContextSummary {
  totalItems: number;
  totalSize: number;
  typeBreakdown: Record<string, number>;
  oldestItem: number;
  newestItem: number;
  avgRelevanceScore: number;
}

/**
 * Enhanced Context Manager
 * 
 * Provides sophisticated context management with:
 * - Long-term memory persistence
 * - Intelligent context pruning
 * - Relevance-based retrieval
 * - Cross-session context retention
 * - Smart context compression
 */
export class EnhancedContextManager {
  private contextStore = new Map<string, ContextItem>();
  private maxContextSize: number;
  private persistencePath: string;
  private currentSessionId: string;
  private lastPersistTime: number = 0;
  private persistenceInterval: number = 5 * 60 * 1000; // 5 minutes
  private persistenceTimer: NodeJS.Timeout | null = null;

  constructor(
    maxContextSize: number = 50 * 1024 * 1024, // 50MB
    persistencePath: string = join(process.cwd(), '.codecrucible', 'context')
  ) {
    this.maxContextSize = maxContextSize;
    this.persistencePath = persistencePath;
    this.currentSessionId = this.generateSessionId();
    
    this.initializePersistence();
    this.startPeriodicPersistence();
    
    // Register for shutdown
    registerShutdownHandler(() => this.cleanup());
  }

  /**
   * Add context with automatic relevance scoring and metadata
   */
  async addContext(
    key: string,
    value: any,
    options: {
      type?: ContextItem['type'];
      tags?: string[];
      source?: string;
      priority?: 'low' | 'medium' | 'high';
      expiresIn?: number; // milliseconds
      relevanceBoost?: number;
    } = {}
  ): Promise<void> {
    const now = Date.now();
    const serializedValue = this.serializeValue(value);
    const size = this.estimateSize(serializedValue);
    
    // Calculate relevance score
    const relevanceScore = this.calculateRelevanceScore(key, value, options);
    
    const contextItem: ContextItem = {
      key,
      value: serializedValue,
      timestamp: now,
      size,
      relevanceScore,
      sessionId: this.currentSessionId,
      type: options.type || this.inferType(key, value),
      metadata: {
        tags: options.tags || [],
        source: options.source || 'unknown',
        priority: options.priority || 'medium',
        expiresAt: options.expiresIn ? now + options.expiresIn : undefined
      }
    };
    
    this.contextStore.set(key, contextItem);
    
    // Trigger pruning if needed
    await this.pruneContextIfNeeded();
    
    logger.debug(`Context added: ${key} (${size} bytes, relevance: ${relevanceScore.toFixed(2)})`);
  }

  /**
   * Get context with smart relevance-based retrieval
   */
  async getContext(key: string): Promise<any> {
    const item = this.contextStore.get(key);
    
    if (!item) {
      return null;
    }
    
    // Check expiration
    if (item.metadata.expiresAt && Date.now() > item.metadata.expiresAt) {
      this.contextStore.delete(key);
      return null;
    }
    
    // Update relevance score based on access
    item.relevanceScore += 0.1;
    item.timestamp = Date.now();
    
    return this.deserializeValue(item.value);
  }

  /**
   * Get context for a specific task with intelligent filtering
   */
  async getContextForTask(task: Task): Promise<{
    relevantFiles: any[];
    conversationHistory: any[];
    executionHistory: any[];
    projectContext: any[];
    suggestions: string[];
  }> {
    const keywords = this.extractKeywords(task.description);
    
    const query: ContextQuery = {
      keywords,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      minRelevanceScore: 0.3
    };
    
    const relevantItems = await this.queryContext(query);
    
    // Categorize results
    const categorized = {
      relevantFiles: relevantItems.filter(item => item.type === 'file'),
      conversationHistory: relevantItems.filter(item => item.type === 'conversation'),
      executionHistory: relevantItems.filter(item => item.type === 'execution'),
      projectContext: relevantItems.filter(item => item.type === 'project'),
      suggestions: this.generateContextSuggestions(task, relevantItems)
    };
    
    return categorized;
  }

  /**
   * Query context with sophisticated filtering
   */
  async queryContext(query: ContextQuery): Promise<ContextItem[]> {
    let results = Array.from(this.contextStore.values());
    
    // Filter by type
    if (query.type) {
      results = results.filter(item => item.type === query.type);
    }
    
    // Filter by session
    if (query.sessionId) {
      results = results.filter(item => item.sessionId === query.sessionId);
    }
    
    // Filter by tags
    if (query.tags && query.tags.length > 0) {
      results = results.filter(item => 
        query.tags!.some(tag => item.metadata.tags.includes(tag))
      );
    }
    
    // Filter by time range
    if (query.timeRange) {
      results = results.filter(item => 
        item.timestamp >= query.timeRange!.start && 
        item.timestamp <= query.timeRange!.end
      );
    }
    
    // Filter by max age
    if (query.maxAge) {
      const cutoff = Date.now() - query.maxAge;
      results = results.filter(item => item.timestamp >= cutoff);
    }
    
    // Filter by relevance score
    if (query.minRelevanceScore) {
      results = results.filter(item => item.relevanceScore >= query.minRelevanceScore!);
    }
    
    // Filter by keywords
    if (query.keywords && query.keywords.length > 0) {
      results = results.filter(item => 
        this.matchesKeywords(item, query.keywords!)
      );
    }
    
    // Sort by relevance score (descending)
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    return results;
  }

  /**
   * Get context summary and statistics
   */
  getContextSummary(): ContextSummary {
    const items = Array.from(this.contextStore.values());
    
    if (items.length === 0) {
      return {
        totalItems: 0,
        totalSize: 0,
        typeBreakdown: {},
        oldestItem: 0,
        newestItem: 0,
        avgRelevanceScore: 0
      };
    }
    
    const totalSize = items.reduce((sum, item) => sum + item.size, 0);
    const totalRelevance = items.reduce((sum, item) => sum + item.relevanceScore, 0);
    
    const typeBreakdown = items.reduce((acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const timestamps = items.map(item => item.timestamp);
    
    return {
      totalItems: items.length,
      totalSize,
      typeBreakdown,
      oldestItem: Math.min(...timestamps),
      newestItem: Math.max(...timestamps),
      avgRelevanceScore: totalRelevance / items.length
    };
  }

  /**
   * Intelligent context pruning with multiple strategies
   */
  async pruneContextIfNeeded(): Promise<void> {
    const totalSize = this.getTotalSize();
    
    if (totalSize <= this.maxContextSize) {
      return;
    }
    
    logger.info(`Context size ${totalSize} exceeds limit ${this.maxContextSize}, starting pruning`);
    
    const items = Array.from(this.contextStore.values());
    const targetSize = this.maxContextSize * 0.8; // Target 80% of max size
    
    // Strategy 1: Remove expired items
    await this.removeExpiredItems();
    
    if (this.getTotalSize() <= targetSize) {
      return;
    }
    
    // Strategy 2: Remove low-relevance temporary items
    await this.removeLowRelevanceItems(0.2);
    
    if (this.getTotalSize() <= targetSize) {
      return;
    }
    
    // Strategy 3: Age-based pruning with relevance weighting
    await this.ageBasedPruning(targetSize);
    
    logger.info(`Context pruning complete. New size: ${this.getTotalSize()}`);
  }

  /**
   * Compress context to optimize memory usage
   */
  async compressContext(): Promise<void> {
    const items = Array.from(this.contextStore.values());
    let compressionSavings = 0;
    
    for (const item of items) {
      if (item.type === 'conversation' || item.type === 'execution') {
        const originalSize = item.size;
        const compressed = this.compressLongText(item.value);
        
        if (compressed.length < item.value.length) {
          item.value = compressed;
          item.size = this.estimateSize(compressed);
          compressionSavings += originalSize - item.size;
          
          // Update relevance slightly down due to compression
          item.relevanceScore *= 0.95;
        }
      }
    }
    
    if (compressionSavings > 0) {
      logger.info(`Context compression saved ${compressionSavings} bytes`);
    }
  }

  /**
   * Merge similar context items to reduce redundancy
   */
  async mergeSimilarContext(): Promise<void> {
    const items = Array.from(this.contextStore.values());
    const groups = this.groupSimilarItems(items);
    
    for (const group of groups) {
      if (group.length > 1) {
        const merged = this.mergeContextItems(group);
        
        // Remove original items
        group.forEach(item => this.contextStore.delete(item.key));
        
        // Add merged item
        this.contextStore.set(merged.key, merged);
        
        logger.debug(`Merged ${group.length} similar context items into ${merged.key}`);
      }
    }
  }

  /**
   * Cross-session context retention
   */
  async loadPreviousSessionContext(sessionId?: string): Promise<number> {
    try {
      const contextFile = join(this.persistencePath, `context-${sessionId || 'latest'}.json`);
      
      if (!existsSync(contextFile)) {
        return 0;
      }
      
      const data = await readFile(contextFile, 'utf8');
      const savedContext = JSON.parse(data);
      
      let loadedCount = 0;
      
      for (const item of savedContext.items || []) {
        // Only load non-temporary items from previous sessions
        if (item.type !== 'temporary') {
          // Reduce relevance for old session data
          item.relevanceScore *= 0.7;
          item.metadata.tags.push('previous-session');
          
          this.contextStore.set(item.key, item);
          loadedCount++;
        }
      }
      
      logger.info(`Loaded ${loadedCount} context items from previous session`);
      return loadedCount;
      
    } catch (error) {
      logger.warn('Failed to load previous session context:', error);
      return 0;
    }
  }

  /**
   * Save context to persistent storage
   */
  async saveContext(): Promise<void> {
    try {
      // Ensure directory exists
      if (!existsSync(this.persistencePath)) {
        await mkdir(this.persistencePath, { recursive: true });
      }
      
      const contextFile = join(this.persistencePath, `context-${this.currentSessionId}.json`);
      const latestFile = join(this.persistencePath, 'context-latest.json');
      
      const exportData = {
        sessionId: this.currentSessionId,
        timestamp: Date.now(),
        items: Array.from(this.contextStore.values()),
        summary: this.getContextSummary()
      };
      
      const jsonData = JSON.stringify(exportData, null, 2);
      
      // Save both session-specific and latest
      await writeFile(contextFile, jsonData, 'utf8');
      await writeFile(latestFile, jsonData, 'utf8');
      
      this.lastPersistTime = Date.now();
      
      logger.debug(`Context saved to ${contextFile}`);
      
    } catch (error) {
      logger.error('Failed to save context:', error);
    }
  }

  /**
   * Private helper methods
   */
  
  private calculateRelevanceScore(key: string, value: any, options: any): number {
    let score = 0.5; // Base score
    
    // Priority boost
    if (options.priority === 'high') score += 0.3;
    else if (options.priority === 'medium') score += 0.1;
    
    // Type-based scoring
    const typeScores = {
      'file': 0.8,
      'project': 0.9,
      'conversation': 0.6,
      'execution': 0.7,
      'temporary': 0.3
    };
    
    const type = options.type || this.inferType(key, value);
    score += typeScores[type as keyof typeof typeScores] || 0.5;
    
    // Size penalty for very large items
    const size = this.estimateSize(value);
    if (size > 1024 * 1024) { // 1MB
      score -= 0.2;
    }
    
    // Tag boost
    if (options.tags && options.tags.length > 0) {
      score += Math.min(options.tags.length * 0.1, 0.3);
    }
    
    // Manual relevance boost
    if (options.relevanceBoost) {
      score += options.relevanceBoost;
    }
    
    return Math.max(0, Math.min(1, score));
  }

  private inferType(key: string, value: any): ContextItem['type'] {
    if (key.includes('file') || key.includes('path')) return 'file';
    if (key.includes('conversation') || key.includes('chat')) return 'conversation';
    if (key.includes('execution') || key.includes('task')) return 'execution';
    if (key.includes('project') || key.includes('structure')) return 'project';
    return 'temporary';
  }

  private extractKeywords(text: string): string[] {
    // Simple keyword extraction - could be enhanced with NLP
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !this.isStopWord(word));
    
    // Remove duplicates and return top keywords
    return [...new Set(words)].slice(0, 10);
  }

  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'who', 'boy', 'did', 'has', 'let', 'put', 'say', 'she', 'too', 'use'
    ]);
    return stopWords.has(word);
  }

  private matchesKeywords(item: ContextItem, keywords: string[]): boolean {
    const text = JSON.stringify(item.value).toLowerCase();
    const itemKeywords = this.extractKeywords(text);
    
    // Check for keyword overlap
    const overlap = keywords.filter(keyword => 
      itemKeywords.some(itemKeyword => 
        itemKeyword.includes(keyword) || keyword.includes(itemKeyword)
      )
    );
    
    return overlap.length > 0;
  }

  private generateContextSuggestions(task: Task, relevantItems: ContextItem[]): string[] {
    const suggestions: string[] = [];
    
    // File-based suggestions
    const fileItems = relevantItems.filter(item => item.type === 'file');
    if (fileItems.length > 0) {
      suggestions.push(`Consider reviewing ${fileItems.length} relevant files from your project`);
    }
    
    // Conversation history suggestions
    const conversationItems = relevantItems.filter(item => item.type === 'conversation');
    if (conversationItems.length > 0) {
      suggestions.push(`Reference ${conversationItems.length} previous conversations on similar topics`);
    }
    
    // Execution history suggestions
    const executionItems = relevantItems.filter(item => item.type === 'execution');
    if (executionItems.length > 0) {
      suggestions.push(`Learn from ${executionItems.length} previous similar task executions`);
    }
    
    // Pattern-based suggestions
    const commonTags = this.extractCommonTags(relevantItems);
    if (commonTags.length > 0) {
      suggestions.push(`Common patterns found: ${commonTags.slice(0, 3).join(', ')}`);
    }
    
    return suggestions;
  }

  private extractCommonTags(items: ContextItem[]): string[] {
    const tagCounts = new Map<string, number>();
    
    items.forEach(item => {
      item.metadata.tags.forEach(tag => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });
    
    return Array.from(tagCounts.entries())
      .filter(([, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag);
  }

  private serializeValue(value: any): any {
    if (typeof value === 'string') return value;
    return JSON.stringify(value);
  }

  private deserializeValue(value: any): any {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  }

  private estimateSize(value: any): number {
    if (typeof value === 'string') {
      return value.length * 2; // Assume UTF-16
    }
    return JSON.stringify(value).length * 2;
  }

  private getTotalSize(): number {
    return Array.from(this.contextStore.values())
      .reduce((sum, item) => sum + item.size, 0);
  }

  private async removeExpiredItems(): Promise<void> {
    const now = Date.now();
    const toRemove: string[] = [];
    
    for (const [key, item] of this.contextStore) {
      if (item.metadata.expiresAt && now > item.metadata.expiresAt) {
        toRemove.push(key);
      }
    }
    
    toRemove.forEach(key => this.contextStore.delete(key));
    
    if (toRemove.length > 0) {
      logger.debug(`Removed ${toRemove.length} expired context items`);
    }
  }

  private async removeLowRelevanceItems(threshold: number): Promise<void> {
    const toRemove: string[] = [];
    
    for (const [key, item] of this.contextStore) {
      if (item.type === 'temporary' && item.relevanceScore < threshold) {
        toRemove.push(key);
      }
    }
    
    toRemove.forEach(key => this.contextStore.delete(key));
    
    if (toRemove.length > 0) {
      logger.debug(`Removed ${toRemove.length} low-relevance items`);
    }
  }

  private async ageBasedPruning(targetSize: number): Promise<void> {
    const items = Array.from(this.contextStore.values());
    
    // Sort by age and relevance score (older and less relevant first)
    items.sort((a, b) => {
      const ageScore = a.timestamp - b.timestamp; // Older items have lower score
      const relevanceScore = (b.relevanceScore - a.relevanceScore) * 100000; // Higher relevance preferred
      return ageScore + relevanceScore;
    });
    
    let currentSize = this.getTotalSize();
    let removedCount = 0;
    
    for (const item of items) {
      if (currentSize <= targetSize) break;
      
      // Don't remove high-priority items unless absolutely necessary
      if (item.metadata.priority === 'high' && currentSize > targetSize * 1.1) {
        continue;
      }
      
      this.contextStore.delete(item.key);
      currentSize -= item.size;
      removedCount++;
    }
    
    if (removedCount > 0) {
      logger.debug(`Age-based pruning removed ${removedCount} items`);
    }
  }

  private compressLongText(text: string): string {
    if (typeof text !== 'string' || text.length < 1000) {
      return text;
    }
    
    // Simple compression: remove excessive whitespace and summarize if very long
    let compressed = text.replace(/\s+/g, ' ').trim();
    
    if (compressed.length > 5000) {
      // Keep first and last parts, summarize middle
      const start = compressed.substring(0, 2000);
      const end = compressed.substring(compressed.length - 2000);
      compressed = start + '\n\n[... content compressed ...]\n\n' + end;
    }
    
    return compressed;
  }

  private groupSimilarItems(items: ContextItem[]): ContextItem[][] {
    const groups: ContextItem[][] = [];
    const used = new Set<ContextItem>();
    
    for (const item of items) {
      if (used.has(item)) continue;
      
      const similarItems = [item];
      used.add(item);
      
      // Find similar items (simplified similarity check)
      for (const otherItem of items) {
        if (used.has(otherItem) || item === otherItem) continue;
        
        if (this.areItemsSimilar(item, otherItem)) {
          similarItems.push(otherItem);
          used.add(otherItem);
        }
      }
      
      groups.push(similarItems);
    }
    
    return groups;
  }

  private areItemsSimilar(item1: ContextItem, item2: ContextItem): boolean {
    // Check if items are similar enough to merge
    if (item1.type !== item2.type) return false;
    
    // Check tag overlap
    const tagOverlap = item1.metadata.tags.filter(tag => 
      item2.metadata.tags.includes(tag)
    ).length;
    
    return tagOverlap > 0 && tagOverlap >= Math.min(item1.metadata.tags.length, item2.metadata.tags.length) * 0.5;
  }

  private mergeContextItems(items: ContextItem[]): ContextItem {
    if (items.length === 1) return items[0];
    
    // Sort by relevance (highest first)
    items.sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    const primary = items[0];
    const merged: ContextItem = {
      key: `merged_${primary.key}_${items.length}`,
      value: {
        primary: primary.value,
        additional: items.slice(1).map(item => ({
          key: item.key,
          value: item.value,
          timestamp: item.timestamp
        }))
      },
      timestamp: Math.max(...items.map(item => item.timestamp)),
      size: items.reduce((sum, item) => sum + item.size, 0) * 0.8, // Assume 20% compression
      relevanceScore: items.reduce((sum, item) => sum + item.relevanceScore, 0) / items.length,
      sessionId: primary.sessionId,
      type: primary.type,
      metadata: {
        tags: [...new Set(items.flatMap(item => item.metadata.tags))],
        source: 'merged',
        priority: items.some(item => item.metadata.priority === 'high') ? 'high' : 'medium'
      }
    };
    
    return merged;
  }

  private async initializePersistence(): Promise<void> {
    try {
      if (!existsSync(this.persistencePath)) {
        await mkdir(this.persistencePath, { recursive: true });
      }
      
      // Try to load previous context
      await this.loadPreviousSessionContext();
      
    } catch (error) {
      logger.warn('Failed to initialize context persistence:', error);
    }
  }

  private startPeriodicPersistence(): void {
    this.persistenceTimer = createManagedInterval(async () => {
      const timeSinceLastPersist = Date.now() - this.lastPersistTime;
      
      if (timeSinceLastPersist >= this.persistenceInterval) {
        await this.saveContext();
      }
    }, 60000); // Check every minute
  }

  /**
   * Shutdown context manager and cleanup resources
   */
  async shutdown(): Promise<void> {
    if (this.persistenceTimer) {
      clearManagedInterval(this.persistenceTimer);
      this.persistenceTimer = null;
    }

    // Save final state before shutdown
    await this.saveContext();
    this.contextStore.clear();
    
    logger.info('✅ EnhancedContextManager shut down successfully');
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Public utility methods
   */
  
  /**
   * Clear all context
   */
  clearContext(): void {
    this.contextStore.clear();
    logger.info('Context cleared');
  }

  /**
   * Get current session ID
   */
  getCurrentSessionId(): string {
    return this.currentSessionId;
  }

  /**
   * Start new session
   */
  startNewSession(): string {
    this.currentSessionId = this.generateSessionId();
    logger.info(`Started new session: ${this.currentSessionId}`);
    return this.currentSessionId;
  }

  /**
   * Export context for debugging or analysis
   */
  exportContext(): any {
    return {
      sessionId: this.currentSessionId,
      timestamp: Date.now(),
      items: Array.from(this.contextStore.values()),
      summary: this.getContextSummary()
    };
  }
}
