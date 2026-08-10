CREATE OR REPLACE FUNCTION public.owner_exists()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin')
$$;

REVOKE EXECUTE ON FUNCTION public.owner_exists() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_exists() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.claim_owner()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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