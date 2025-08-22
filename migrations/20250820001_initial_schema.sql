-- Migration: 20250820001_initial_schema
-- Name: Initial Schema
-- Description: Initial database schema for CodeCrucible Synth

-- Up
-- Voice interactions table
CREATE TABLE IF NOT EXISTS voice_interactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  voice_name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  response TEXT NOT NULL,
  confidence REAL NOT NULL,
  tokens_used INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  project_type TEXT,
  description TEXT,
  last_analyzed DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Code analysis results table
CREATE TABLE IF NOT EXISTS code_analysis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  analysis_type TEXT NOT NULL,
  results TEXT NOT NULL,
  quality_score INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects (id)
);

-- User sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL UNIQUE,
  user_id TEXT,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ended_at DATETIME,
  total_interactions INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0
);

-- Configuration table
CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_voice_interactions_session 
ON voice_interactions(session_id);

CREATE INDEX IF NOT EXISTS idx_voice_interactions_voice 
ON voice_interactions(voice_name);

CREATE INDEX IF NOT EXISTS idx_code_analysis_project 
ON code_analysis(project_id);

-- Down
-- Drop indexes
DROP INDEX IF EXISTS idx_code_analysis_project;
DROP INDEX IF EXISTS idx_voice_interactions_voice;
DROP INDEX IF EXISTS idx_voice_interactions_session;

-- Drop tables
DROP TABLE IF EXISTS app_config;
DROP TABLE IF EXISTS user_sessions;
DROP TABLE IF EXISTS code_analysis;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS voice_interactions;