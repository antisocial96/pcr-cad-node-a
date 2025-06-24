/*
  # Create emergency calls table

  1. New Tables
    - `emergency_calls`
      - `id` (uuid, primary key)
      - `conversation_id` (text, unique) - ElevenLabs conversation identifier
      - `intent` (text) - Extracted intent from the call (e.g., "fire", "medical", "police", "unknown")
      - `timestamp` (timestamptz) - When the call was processed
      - `caller_phone` (text) - Phone number of the caller (optional)
      - `transcript` (text) - Full conversation transcript (optional)
      - `priority_level` (integer) - Priority level 1-5 (1 being highest priority)
      - `status` (text) - Call status: "pending", "in_progress", "completed", "escalated"

  2. Security
    - Enable RLS on `emergency_calls` table
    - Add policy for authenticated users to read and write call data
    - Add policy for service role to manage all operations

  3. Indexes
    - Index on conversation_id for fast lookups
    - Index on timestamp for chronological queries
    - Index on intent and priority_level for filtering
*/

CREATE TABLE IF NOT EXISTS emergency_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id text UNIQUE NOT NULL,
  intent text DEFAULT 'unknown',
  timestamp timestamptz DEFAULT now(),
  caller_phone text,
  transcript text,
  priority_level integer DEFAULT 3 CHECK (priority_level >= 1 AND priority_level <= 5),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'escalated'))
);

-- Enable Row Level Security
ALTER TABLE emergency_calls ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_emergency_calls_conversation_id ON emergency_calls(conversation_id);
CREATE INDEX IF NOT EXISTS idx_emergency_calls_timestamp ON emergency_calls(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_emergency_calls_intent ON emergency_calls(intent);
CREATE INDEX IF NOT EXISTS idx_emergency_calls_priority ON emergency_calls(priority_level);
CREATE INDEX IF NOT EXISTS idx_emergency_calls_status ON emergency_calls(status);

-- RLS Policies
CREATE POLICY "Allow authenticated users to read emergency calls"
  ON emergency_calls
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert emergency calls"
  ON emergency_calls
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update emergency calls"
  ON emergency_calls
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Allow service role full access"
  ON emergency_calls
  FOR ALL
  TO service_role
  USING (true);