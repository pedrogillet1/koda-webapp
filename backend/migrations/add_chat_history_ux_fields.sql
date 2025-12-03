-- Chat History UX Enhancement Migration
-- Adds fields for pinning, soft delete, and AI-generated summaries

-- Add new columns to conversations table
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS "isPinned" BOOLEAN DEFAULT FALSE NOT NULL,
  ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN DEFAULT FALSE NOT NULL,
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP;

-- Create index for efficient history queries
CREATE INDEX IF NOT EXISTS "conversations_userId_isDeleted_isPinned_updatedAt_idx"
  ON conversations ("userId", "isDeleted", "isPinned", "updatedAt");

-- Enable pg_trgm extension for full-text search (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add GIN index on message content for full-text search
CREATE INDEX IF NOT EXISTS "messages_content_gin_idx"
  ON messages USING GIN (content gin_trgm_ops);

COMMENT ON COLUMN conversations.summary IS 'AI-generated summary of the conversation';
COMMENT ON COLUMN conversations."isPinned" IS 'Flag to pin important conversations to the top';
COMMENT ON COLUMN conversations."isDeleted" IS 'Soft delete flag to hide conversations without permanent deletion';
COMMENT ON COLUMN conversations."deletedAt" IS 'Timestamp when the conversation was soft-deleted';
