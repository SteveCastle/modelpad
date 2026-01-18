-- Migration 01: Create core tables for notes and revisions
-- This script is idempotent and safe to run multiple times

-- Create pgvector extension for embeddings (if not exists)
CREATE EXTENSION IF NOT EXISTS vector;

-- Create notes table
CREATE TABLE IF NOT EXISTS public.notes (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    title text NULL,
    body text NULL,
    user_id uuid NULL,
    parent uuid NULL,
    created_at timestamp NULL DEFAULT now(),
    updated_at timestamp NULL DEFAULT now(),
    embedding public.vector NULL,
    is_shared boolean DEFAULT false,
    CONSTRAINT notes_pkey PRIMARY KEY (id)
);

-- Add self-referential foreign key for parent (only if not exists)
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

-- Create revisions table
CREATE TABLE IF NOT EXISTS public.revisions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    note_id uuid NULL,
    title text NULL,
    body text NULL,
    user_id uuid NULL,
    created_at timestamp NULL DEFAULT now(),
    updated_at timestamp NULL DEFAULT now(),
    CONSTRAINT revisions_pkey PRIMARY KEY (id)
);

-- Add foreign key for revisions (only if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'revisions_note_id_fkey' 
        AND table_name = 'revisions'
    ) THEN
        ALTER TABLE public.revisions 
        ADD CONSTRAINT revisions_note_id_fkey 
        FOREIGN KEY (note_id) REFERENCES public.notes(id);
    END IF;
END $$;

-- Create indexes (if not exists)
CREATE INDEX IF NOT EXISTS idx_notes_parent ON public.notes(parent);
CREATE INDEX IF NOT EXISTS idx_notes_user_parent ON public.notes(user_id, parent);
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON public.notes(user_id);
