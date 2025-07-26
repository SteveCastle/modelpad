-- Add tags column to notes table to store an array of tag objects
ALTER TABLE public.notes ADD COLUMN tags JSONB DEFAULT '[]'::jsonb;

-- Add index for tags column for better query performance
CREATE INDEX idx_notes_tags ON public.notes USING GIN (tags); 