/*
  # Remove caller phone column from garuda_sentry_calls table

  1. Changes
    - Remove `caller_phone` column from `garuda_sentry_calls` table
    - Remove any indexes related to caller_phone if they exist

  2. Security
    - No RLS changes needed as we're only removing a column
*/

-- Remove caller_phone column from garuda_sentry_calls table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'garuda_sentry_calls' AND column_name = 'caller_phone'
  ) THEN
    ALTER TABLE garuda_sentry_calls DROP COLUMN caller_phone;
  END IF;
END $$;