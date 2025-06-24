/*
  # Update Emergency Calls Schema

  1. Changes Made
    - Renamed table from `emergency_calls` to `garuda_sentry_calls`
    - Removed `transcript` column
    - Removed `priority_level` column  
    - Removed `status` column
    - Kept core fields: id, conversation_id, intent, timestamp, caller_phone
    
  2. Security
    - Enable RLS on new table
    - Add policies for authenticated users and service role
*/

-- Drop the old table if it exists
DROP TABLE IF EXISTS emergency_calls CASCADE;

-- Create the new garuda_sentry_calls table
CREATE TABLE IF NOT EXISTS garuda_sentry_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id text UNIQUE NOT NULL,
  intent text DEFAULT 'unknown',
  timestamp timestamptz DEFAULT now(),
  caller_phone text
);

-- Enable Row Level Security
ALTER TABLE garuda_sentry_calls ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_garuda_sentry_calls_conversation_id ON garuda_sentry_calls (conversation_id);
CREATE INDEX IF NOT EXISTS idx_garuda_sentry_calls_intent ON garuda_sentry_calls (intent);
CREATE INDEX IF NOT EXISTS idx_garuda_sentry_calls_timestamp ON garuda_sentry_calls (timestamp DESC);

-- Create RLS policies
CREATE POLICY "Allow authenticated users to read garuda sentry calls"
  ON garuda_sentry_calls
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert garuda sentry calls"
  ON garuda_sentry_calls
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update garuda sentry calls"
  ON garuda_sentry_calls
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Allow service role full access"
  ON garuda_sentry_calls
  FOR ALL
  TO service_role
  USING (true);