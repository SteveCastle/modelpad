-- Migration to add parent field for hierarchical note structure
-- This allows notes to have parent-child relationships

ALTER TABLE public.notes 
ADD COLUMN parent uuid REFERENCES public.notes(id);

-- Add index for better performance on parent queries
CREATE INDEX idx_notes_parent ON public.notes(parent);

-- Add index for user_id + parent combination for efficient queries
CREATE INDEX idx_notes_user_parent ON public.notes(user_id, parent); 