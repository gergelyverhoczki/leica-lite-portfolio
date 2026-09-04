ALTER TABLE public.project_photos
  ADD COLUMN IF NOT EXISTS show_on_homepage boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS project_photos_homepage_idx
  ON public.project_photos (show_on_homepage)
  WHERE show_on_homepage;