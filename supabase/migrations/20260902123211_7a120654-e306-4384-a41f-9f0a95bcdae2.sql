DROP POLICY "Published projects are publicly viewable" ON public.projects;

CREATE POLICY "Published projects are publicly viewable"
ON public.projects FOR SELECT TO anon, authenticated
USING (status = 'published');

CREATE POLICY "Admins can view all projects"
ON public.projects FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY "Project photos of published projects are viewable" ON public.project_photos;

CREATE POLICY "Project photos of published projects are viewable"
ON public.project_photos FOR SELECT TO anon, authenticated
USING (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.status = 'published')
);

CREATE POLICY "Admins can view all project photos"
ON public.project_photos FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));