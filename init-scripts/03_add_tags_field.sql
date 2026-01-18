-- Migration 03: Add tags column to notes table
-- This script is idempotent and safe to run multiple times

-- Add tags column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'notes' 
        AND column_name = 'tags'
    ) THEN
        ALTER TABLE public.notes ADD COLUMN tags JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- Create GIN index for tags if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_notes_tags ON public.notes USING GIN (tags);
