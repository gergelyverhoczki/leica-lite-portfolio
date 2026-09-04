ALTER TABLE public.projects ADD COLUMN cover_photo_id uuid REFERENCES public.photos(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS projects_cover_photo_idx ON public.projects(cover_photo_id);