CREATE POLICY "Anyone can read photo files"
ON storage.objects FOR SELECT
USING (bucket_id = 'photos');

CREATE POLICY "Admins can upload photo files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'photos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update photo files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'photos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete photo files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'photos' AND public.has_role(auth.uid(), 'admin'));