import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Configure Neon for WebSocket support - Following AI_INSTRUCTIONS.md defensive patterns
neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Enhanced connection pool with resilience following AI_INSTRUCTIONS.md
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum connections
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  connectionTimeoutMillis: 2000, // Connection timeout
});

// Enhanced error handling for database connections
pool.on('error', (err, client) => {
  logger.error('Unexpected error on idle database client', err);
  // Don't exit the process, just log the error
});

export const db = drizzle({ client: pool, schema });