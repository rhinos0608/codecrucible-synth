/**
 * RAG System Testing Script
 * Tests vector-based retrieval augmented generation functionality
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

console.log('🔍 CodeCrucible Synth - RAG System Testing\n');

// Mock Vector RAG System
class MockVectorRAGSystem {
  constructor() {
    this.documents = new Map();
    this.vectorStore = new Map();
    this.embeddings = new Map();
    this.initialized = false;
  }

  async initialize() {
    console.log('🔧 Initializing RAG system...');
    
    // Simulate initialization
    await new Promise(resolve => setTimeout(resolve, 100));
    
    this.initialized = true;
    console.log('✅ RAG system initialized');
  }

  // Simple embedding simulation (in reality would use transformers.js or similar)
  generateEmbedding(text) {
    // Create a simple hash-based "embedding" for testing
    const words = text.toLowerCase().split(/\W+/).filter(w => w.length > 2);
    const embedding = new Array(384).fill(0); // 384-dimensional vectors
    
    words.forEach((word, index) => {
      const hash = this.simpleHash(word);
      for (let i = 0; i < 384; i++) {
        embedding[i] += Math.sin(hash + i) * 0.1;
      }
    });
    
    // Normalize
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / norm);
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  calculateSimilarity(vec1, vec2) {
    // Cosine similarity
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }
    
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  async addDocument(doc) {
    if (!this.initialized) {
      throw new Error('RAG system not initialized');
    }

    console.log(`   📄 Adding document: ${doc.id} (${doc.content.length} chars)`);
    
    // Store document
    this.documents.set(doc.id, doc);
    
    // Create chunks
    const chunks = this.chunkDocument(doc);
    console.log(`   🧩 Created ${chunks.length} chunks`);
    
    // Generate embeddings for chunks
    for (const chunk of chunks) {
      const embedding = this.generateEmbedding(chunk.content);
      this.embeddings.set(chunk.id, embedding);
      this.vectorStore.set(chunk.id, chunk);
    }
    
    return { id: doc.id, chunks: chunks.length };
  }

  chunkDocument(doc) {
    const maxChunkSize = 500;
    const overlapSize = 50;
    const chunks = [];
    
    let start = 0;
    let chunkIndex = 0;
    
    while (start < doc.content.length) {
      const end = Math.min(start + maxChunkSize, doc.content.length);
      let chunkContent = doc.content.slice(start, end);
      
      // Try to break at word boundaries
      if (end < doc.content.length) {
        const lastSpace = chunkContent.lastIndexOf(' ');
        if (lastSpace > maxChunkSize * 0.8) {
          chunkContent = chunkContent.slice(0, lastSpace);
        }
      }
      
      chunks.push({
        id: `${doc.id}_chunk_${chunkIndex}`,
        documentId: doc.id,
        content: chunkContent,
        metadata: {
          ...doc.metadata,
          chunkIndex,
          startOffset: start,
          endOffset: start + chunkContent.length
        }
      });
      
      chunkIndex++;
      start += chunkContent.length - overlapSize;
    }
    
    return chunks;
  }

  async query(queryRequest) {
    if (!this.initialized) {
      throw new Error('RAG system not initialized');
    }

    console.log(`🔍 Querying: "${queryRequest.query.substring(0, 60)}..."`);
    
    const startTime = Date.now();
    
    // Generate query embedding
    const queryEmbedding = this.generateEmbedding(queryRequest.query);
    
    // Find similar chunks
    const similarities = [];
    for (const [chunkId, chunkEmbedding] of this.embeddings) {
      const similarity = this.calculateSimilarity(queryEmbedding, chunkEmbedding);
      similarities.push({
        chunkId,
        similarity,
        chunk: this.vectorStore.get(chunkId)
      });
    }
    
    // Sort by similarity and get top results
    similarities.sort((a, b) => b.similarity - a.similarity);
    const topResults = similarities.slice(0, queryRequest.maxResults || 5);
    
    const processingTime = Date.now() - startTime;
    
    console.log(`   📊 Found ${topResults.length} relevant chunks in ${processingTime}ms`);
    topResults.forEach((result, index) => {
      console.log(`   ${index + 1}. ${result.chunk.id} (similarity: ${result.similarity.toFixed(3)})`);
    });
    
    return {
      query: queryRequest.query,
      documents: topResults.map(r => ({
        id: r.chunk.id,
        content: r.chunk.content,
        score: r.similarity,
        metadata: r.chunk.metadata
      })),
      metadata: {
        totalDocuments: this.documents.size,
        totalChunks: this.vectorStore.size,
        processingTime,
        queryType: queryRequest.queryType || 'similarity',
        threshold: 0.5
      }
    };
  }

  async hybridQuery(queryRequest) {
    // Simulate hybrid search (vector + keyword)
    const vectorResults = await this.query(queryRequest);
    
    // Simple keyword matching
    const queryWords = queryRequest.query.toLowerCase().split(/\W+/);
    const keywordResults = [];
    
    for (const [chunkId, chunk] of this.vectorStore) {
      const chunkWords = chunk.content.toLowerCase().split(/\W+/);
      const matchedWords = queryWords.filter(word => 
        chunkWords.some(chunkWord => chunkWord.includes(word))
      );
      
      if (matchedWords.length > 0) {
        const keywordScore = matchedWords.length / queryWords.length;
        keywordResults.push({
          chunkId,
          score: keywordScore,
          chunk
        });
      }
    }
    
    // Combine results with weighted scoring
    const hybridAlpha = 0.7; // Weight for vector similarity
    const combinedResults = new Map();
    
    // Add vector results
    vectorResults.documents.forEach(doc => {
      combinedResults.set(doc.id, {
        ...doc,
        hybridScore: doc.score * hybridAlpha
      });
    });
    
    // Add/update with keyword results
    keywordResults.forEach(result => {
      const existing = combinedResults.get(result.chunkId);
      if (existing) {
        existing.hybridScore += result.score * (1 - hybridAlpha);
      } else {
        combinedResults.set(result.chunkId, {
          id: result.chunkId,
          content: result.chunk.content,
          score: result.score * (1 - hybridAlpha),
          hybridScore: result.score * (1 - hybridAlpha),
          metadata: result.chunk.metadata
        });
      }
    });
    
    // Sort by hybrid score and return top results
    const finalResults = Array.from(combinedResults.values())
      .sort((a, b) => b.hybridScore - a.hybridScore)
      .slice(0, queryRequest.maxResults || 5);
    
    console.log(`   🔄 Hybrid search combined ${vectorResults.documents.length} vector + ${keywordResults.length} keyword results`);
    
    return {
      query: queryRequest.query,
      documents: finalResults,
      metadata: {
        ...vectorResults.metadata,
        queryType: 'hybrid',
        hybridAlpha,
        vectorResults: vectorResults.documents.length,
        keywordResults: keywordResults.length
      }
    };
  }

  getStats() {
    return {
      totalDocuments: this.documents.size,
      totalChunks: this.vectorStore.size,
      totalEmbeddings: this.embeddings.size,
      initialized: this.initialized
    };
  }
}

// Create sample codebase for testing
async function createSampleCodebase() {
  console.log('📁 Creating sample codebase for RAG testing...');
  
  const testDir = './test-codebase';
  if (!existsSync(testDir)) {
    mkdirSync(testDir, { recursive: true });
  }

  const sampleFiles = [
    {
      path: join(testDir, 'auth-service.ts'),
      content: `/**
 * Authentication Service
 * Handles user authentication and authorization
 */

import { hash, compare } from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';

export class AuthService {
  private readonly jwtSecret: string;
  private readonly saltRounds: number = 12;

  constructor(jwtSecret: string) {
    this.jwtSecret = jwtSecret;
  }

  /**
   * Register a new user with email and password
   */
  async register(email: string, password: string): Promise<User> {
    // Validate email format
    if (!this.isValidEmail(email)) {
      throw new Error('Invalid email format');
    }

    // Check password strength
    if (!this.isStrongPassword(password)) {
      throw new Error('Password does not meet security requirements');
    }

    // Hash password
    const hashedPassword = await hash(password, this.saltRounds);

    // Create user
    const user = new User({
      email,
      password: hashedPassword,
      createdAt: new Date()
    });

    return user.save();
  }

  /**
   * Authenticate user with email and password
   */
  async login(email: string, password: string): Promise<string> {
    const user = await User.findByEmail(email);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isPasswordValid = await compare(password, user.password);
    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    // Generate JWT token
    return this.generateToken(user);
  }

  /**
   * Generate JWT token for user
   */
  private generateToken(user: User): string {
    return jwt.sign(
      { 
        userId: user.id, 
        email: user.email 
      },
      this.jwtSecret,
      { expiresIn: '24h' }
    );
  }

  /**
   * Validate email format using regex
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Check if password meets security requirements
   */
  private isStrongPassword(password: string): boolean {
    return password.length >= 8 && 
           /[A-Z]/.test(password) && 
           /[a-z]/.test(password) && 
           /[0-9]/.test(password) && 
           /[^A-Za-z0-9]/.test(password);
  }
}`
    },
    {
      path: join(testDir, 'user-model.ts'),
      content: `/**
 * User Model
 * Represents a user in the system with authentication data
 */

export interface UserData {
  id?: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role: 'admin' | 'user' | 'moderator';
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt?: Date;
}

export class User {
  public id: string;
  public email: string;
  public password: string;
  public firstName?: string;
  public lastName?: string;
  public role: 'admin' | 'user' | 'moderator';
  public isActive: boolean;
  public lastLoginAt?: Date;
  public createdAt: Date;
  public updatedAt?: Date;

  constructor(data: UserData) {
    this.id = data.id || this.generateId();
    this.email = data.email;
    this.password = data.password;
    this.firstName = data.firstName;
    this.lastName = data.lastName;
    this.role = data.role;
    this.isActive = data.isActive;
    this.lastLoginAt = data.lastLoginAt;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  /**
   * Find user by email address
   */
  static async findByEmail(email: string): Promise<User | null> {
    // This would typically query a database
    // For testing, we'll simulate a database lookup
    const userData = await this.simulateDbQuery('email', email);
    return userData ? new User(userData) : null;
  }

  /**
   * Find user by ID
   */
  static async findById(id: string): Promise<User | null> {
    const userData = await this.simulateDbQuery('id', id);
    return userData ? new User(userData) : null;
  }

  /**
   * Save user to database
   */
  async save(): Promise<User> {
    this.updatedAt = new Date();
    // This would typically save to a database
    return this;
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(): Promise<void> {
    this.lastLoginAt = new Date();
    await this.save();
  }

  /**
   * Check if user has specific role
   */
  hasRole(role: string): boolean {
    return this.role === role;
  }

  /**
   * Get user's full name
   */
  getFullName(): string {
    return [this.firstName, this.lastName].filter(Boolean).join(' ') || this.email;
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private static async simulateDbQuery(field: string, value: string): Promise<UserData | null> {
    // Simulate database delay
    await new Promise(resolve => setTimeout(resolve, 10));
    return null; // Would return actual user data
  }
}`
    },
    {
      path: join(testDir, 'api-routes.ts'),
      content: `/**
 * API Routes
 * Defines REST endpoints for user authentication and management
 */

import { Router, Request, Response } from 'express';
import { AuthService } from './auth-service';
import { User } from './user-model';
import { authMiddleware } from './middleware/auth-middleware';

const router = Router();
const authService = new AuthService(process.env.JWT_SECRET!);

/**
 * POST /api/auth/register
 * Register a new user account
 */
router.post('/auth/register', async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    // Register user
    const user = await authService.register(email, password);
    
    // Update user profile if provided
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    await user.save();

    // Return user data (excluding password)
    const { password: _, ...userResponse } = user;
    res.status(201).json({
      success: true,
      user: userResponse
    });

  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
});

/**
 * POST /api/auth/login
 * Authenticate user and return JWT token
 */
router.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    const token = await authService.login(email, password);
    
    res.json({
      success: true,
      token,
      expiresIn: '24h'
    });

  } catch (error) {
    res.status(401).json({
      error: error.message
    });
  }
});

/**
 * GET /api/auth/profile
 * Get current user profile (requires authentication)
 */
router.get('/auth/profile', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    const { password: _, ...userProfile } = user;
    res.json({
      success: true,
      user: userProfile
    });

  } catch (error) {
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * PUT /api/auth/profile
 * Update user profile information
 */
router.put('/auth/profile', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { firstName, lastName } = req.body;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    // Update fields
    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    
    await user.save();

    const { password: _, ...userProfile } = user;
    res.json({
      success: true,
      user: userProfile
    });

  } catch (error) {
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

export default router;`
    },
    {
      path: join(testDir, 'cache-service.ts'),
      content: `/**
 * Cache Service
 * Provides caching functionality for improved performance
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export class CacheService {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private defaultTTL: number = 300000; // 5 minutes

  /**
   * Set a value in the cache with optional TTL
   */
  set<T>(key: string, value: T, ttl?: number): void {
    const entry: CacheEntry<T> = {
      data: value,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL
    };
    
    this.cache.set(key, entry);
  }

  /**
   * Get a value from the cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Delete a value from the cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cached values
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const now = Date.now();
    let expiredEntries = 0;
    
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > entry.ttl) {
        expiredEntries++;
      }
    }

    return {
      totalEntries: this.cache.size,
      expiredEntries,
      activeEntries: this.cache.size - expiredEntries
    };
  }

  /**
   * Clean up expired entries
   */
  cleanup(): number {
    const now = Date.now();
    let removedCount = 0;
    
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        removedCount++;
      }
    }

    return removedCount;
  }
}`
    }
  ];

  // Write files
  for (const file of sampleFiles) {
    writeFileSync(file.path, file.content);
    console.log(`   ✅ Created ${file.path}`);
  }

  console.log(`✅ Sample codebase created with ${sampleFiles.length} files\n`);
  return sampleFiles;
}

// Test RAG System
async function testRAGSystem() {
  const rag = new MockVectorRAGSystem();
  
  // Initialize system
  await rag.initialize();
  
  // Create sample codebase
  const sampleFiles = await createSampleCodebase();
  
  // Add documents to RAG system
  console.log('📚 Adding documents to RAG system...');
  for (const file of sampleFiles) {
    await rag.addDocument({
      id: file.path.replace('./test-codebase/', ''),
      content: file.content,
      metadata: {
        type: 'typescript',
        path: file.path,
        addedAt: new Date().toISOString()
      }
    });
  }

  console.log(`\\n📊 RAG System Stats:`, rag.getStats());

  // Test queries
  const testQueries = [
    {
      query: 'How to implement user authentication with JWT tokens?',
      expectedFiles: ['auth-service.ts', 'api-routes.ts'],
      type: 'implementation'
    },
    {
      query: 'What is the User model structure and methods?',
      expectedFiles: ['user-model.ts'],
      type: 'model'
    },
    {
      query: 'How to validate email addresses and strong passwords?',
      expectedFiles: ['auth-service.ts'],
      type: 'validation'
    },
    {
      query: 'What are the available API endpoints for authentication?',
      expectedFiles: ['api-routes.ts'],
      type: 'api'
    },
    {
      query: 'How does the caching system work?',
      expectedFiles: ['cache-service.ts'],
      type: 'caching'
    },
    {
      query: 'bcrypt password hashing implementation',
      expectedFiles: ['auth-service.ts'],
      type: 'security'
    }
  ];

  console.log('\\n🔍 Testing RAG queries...\\n');

  const results = [];
  for (const testQuery of testQueries) {
    console.log(`Testing: "${testQuery.query}"`);
    
    try {
      // Test regular similarity search
      const similarityResult = await rag.query({
        query: testQuery.query,
        maxResults: 3,
        queryType: 'similarity'
      });

      // Test hybrid search
      const hybridResult = await rag.hybridQuery({
        query: testQuery.query,
        maxResults: 3,
        queryType: 'hybrid'
      });

      // Analyze results
      const similarityFiles = similarityResult.documents.map(d => d.id.split('_chunk_')[0]);
      const hybridFiles = hybridResult.documents.map(d => d.id.split('_chunk_')[0]);
      
      const similarityMatches = testQuery.expectedFiles.filter(file => 
        similarityFiles.includes(file)
      ).length;
      
      const hybridMatches = testQuery.expectedFiles.filter(file => 
        hybridFiles.includes(file)
      ).length;

      console.log(`   📊 Similarity Search: ${similarityMatches}/${testQuery.expectedFiles.length} expected files found`);
      console.log(`   📊 Hybrid Search: ${hybridMatches}/${testQuery.expectedFiles.length} expected files found`);
      console.log(`   ⏱️ Processing: ${similarityResult.metadata.processingTime}ms\\n`);

      results.push({
        query: testQuery,
        similarityResult,
        hybridResult,
        similarityMatches,
        hybridMatches,
        success: true
      });

    } catch (error) {
      console.log(`   ❌ Error: ${error.message}\\n`);
      results.push({
        query: testQuery,
        error: error.message,
        success: false
      });
    }
  }

  // Analysis
  console.log('📈 RAG Testing Results');
  console.log('======================');
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Successful: ${successful.length}/${results.length}`);
  console.log(`❌ Failed: ${failed.length}/${results.length}`);
  
  if (successful.length > 0) {
    const avgSimilarityAccuracy = successful.reduce((sum, r) => 
      sum + (r.similarityMatches / r.query.expectedFiles.length), 0) / successful.length;
    
    const avgHybridAccuracy = successful.reduce((sum, r) => 
      sum + (r.hybridMatches / r.query.expectedFiles.length), 0) / successful.length;
    
    const avgProcessingTime = successful.reduce((sum, r) => 
      sum + r.similarityResult.metadata.processingTime, 0) / successful.length;
    
    console.log(`\\n📊 Average Metrics:`);
    console.log(`   Similarity Search Accuracy: ${(avgSimilarityAccuracy * 100).toFixed(1)}%`);
    console.log(`   Hybrid Search Accuracy: ${(avgHybridAccuracy * 100).toFixed(1)}%`);
    console.log(`   Average Processing Time: ${avgProcessingTime.toFixed(1)}ms`);
    
    // Compare search methods
    const hybridBetter = successful.filter(r => r.hybridMatches > r.similarityMatches).length;
    const similarityBetter = successful.filter(r => r.similarityMatches > r.hybridMatches).length;
    const tied = successful.filter(r => r.similarityMatches === r.hybridMatches).length;
    
    console.log(`\\n🔄 Search Method Comparison:`);
    console.log(`   Hybrid Search Better: ${hybridBetter} queries`);
    console.log(`   Similarity Search Better: ${similarityBetter} queries`);
    console.log(`   Tied: ${tied} queries`);
  }

  console.log('\\n🎉 RAG system testing completed successfully!');
}

// Run the tests
testRAGSystem().catch(console.error);