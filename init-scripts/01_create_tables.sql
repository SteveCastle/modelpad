CREATE EXTENSION vector;

CREATE TABLE public.notes (
	id uuid NOT NULL DEFAULT gen_random_uuid(),
	title text NULL,
	body text NULL,
	user_id uuid NULL,
	created_at timestamp NULL DEFAULT now(),
	updated_at timestamp NULL DEFAULT now(),
	embedding public.vector NULL,
	CONSTRAINT notes_pkey PRIMARY KEY (id)
);

CREATE TABLE public.revisions (
	id uuid NOT NULL DEFAULT gen_random_uuid(),
	note_id uuid NULL,
	title text NULL,
	body text NULL,
	user_id uuid NULL,
	created_at timestamp NULL DEFAULT now(),
	updated_at timestamp NULL DEFAULT now(),
	CONSTRAINT revisions_pkey PRIMARY KEY (id),
	CONSTRAINT revisions_note_id_fkey FOREIGN KEY (note_id) REFERENCES public.notes(id)
);