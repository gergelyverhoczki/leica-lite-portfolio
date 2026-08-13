-- Full schema setup for an external Supabase project (no sample data).
-- Run once in the SQL editor of your own project.

-- 1. Roles ------------------------------------------------------------------
CREATE TYPE public.app_role AS ENUM ('admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- 2. Photos -----------------------------------------------------------------
CREATE TABLE public.photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  storage_path text,
  alt text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.photos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.photos TO authenticated;
GRANT ALL ON public.photos TO service_role;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Photos are publicly viewable"
ON public.photos FOR SELECT USING (true);

CREATE POLICY "Admins can insert photos"
ON public.photos FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update photos"
ON public.photos FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete photos"
ON public.photos FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX photos_sort_order_idx ON public.photos (sort_order, created_at);

-- 3. Owner bootstrap --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.owner_exists()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin')
$$;

REVOKE EXECUTE ON FUNCTION public.owner_exists() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_exists() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.claim_owner()
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  claimed boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  SELECT auth.uid(), 'admin'
  WHERE NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin');

  GET DIAGNOSTICS claimed = ROW_COUNT;
  RETURN claimed;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_owner() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_owner() FROM anon;
GRANT EXECUTE ON FUNCTION public.claim_owner() TO authenticated, service_role;

-- 4. Storage bucket "photos" (public) ---------------------------------------
-- Create the bucket in Storage UI as PUBLIC (id: photos), then run:
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
