CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  year text,
  description text,
  status text NOT NULL DEFAULT 'draft',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT projects_status_check CHECK (status IN ('draft','published'))
);

GRANT SELECT ON public.projects TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published projects are publicly viewable"
ON public.projects FOR SELECT USING (status = 'published' OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert projects"
ON public.projects FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update projects"
ON public.projects FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete projects"
ON public.projects FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.project_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  photo_id uuid NOT NULL REFERENCES public.photos(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, photo_id)
);

GRANT SELECT ON public.project_photos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_photos TO authenticated;
GRANT ALL ON public.project_photos TO service_role;
ALTER TABLE public.project_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project photos of published projects are viewable"
ON public.project_photos FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.status = 'published')
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can insert project photos"
ON public.project_photos FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update project photos"
ON public.project_photos FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete project photos"
ON public.project_photos FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.project_slug_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.project_slug_history TO anon;
GRANT SELECT, INSERT, DELETE ON public.project_slug_history TO authenticated;
GRANT ALL ON public.project_slug_history TO service_role;
ALTER TABLE public.project_slug_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Slug history is publicly viewable"
ON public.project_slug_history FOR SELECT USING (true);

CREATE POLICY "Admins can insert slug history"
ON public.project_slug_history FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete slug history"
ON public.project_slug_history FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.photos ADD COLUMN in_portfolio boolean NOT NULL DEFAULT true;

CREATE INDEX project_photos_project_idx ON public.project_photos (project_id, sort_order);
CREATE INDEX projects_status_idx ON public.projects (status, sort_order);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.record_project_slug_change()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.slug IS DISTINCT FROM OLD.slug THEN
    DELETE FROM public.project_slug_history WHERE slug = NEW.slug;
    INSERT INTO public.project_slug_history (project_id, slug)
    VALUES (OLD.id, OLD.slug)
    ON CONFLICT (slug) DO UPDATE SET project_id = EXCLUDED.project_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER projects_slug_history AFTER UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.record_project_slug_change();