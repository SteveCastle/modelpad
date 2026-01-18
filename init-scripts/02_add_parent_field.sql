-- Migration 02: Add parent field for hierarchical note structure
-- This script is idempotent and safe to run multiple times
-- Note: The parent column is now created in 01_create_tables.sql
-- This migration is kept for backwards compatibility but is a no-op if column exists

-- Add parent column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'notes' 
        AND column_name = 'parent'
    ) THEN
        ALTER TABLE public.notes ADD COLUMN parent uuid;
    END IF;
END $$;

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'notes_parent_fkey' 
        AND table_name = 'notes'
    ) THEN
        ALTER TABLE public.notes 
        ADD CONSTRAINT notes_parent_fkey 
        FOREIGN KEY (parent) REFERENCES public.notes(id);
    END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_notes_parent ON public.notes(parent);
CREATE INDEX IF NOT EXISTS idx_notes_user_parent ON public.notes(user_id, parent);
