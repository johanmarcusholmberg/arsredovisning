-- Companion to 0003_phase_6_5_reclassification_rls.sql.
--
-- Defines the auth_profile_id() helper that all reclassification RLS
-- policies depend on. It returns the profile id for the currently
-- authenticated Supabase user (auth.uid() / JWT sub claim), or NULL
-- when the request is not made via a Supabase JWT (in which case the
-- service-role key still bypasses RLS, so this function only matters
-- for direct browser / anon-role queries).
--
-- profiles.auth_id is text (Supabase auth user id is a uuid stored as
-- text), so the JWT sub claim is matched as text.
--
-- The function is SECURITY DEFINER so it can read the profiles table
-- regardless of the caller's grants. It is marked STABLE because the
-- result depends only on the current session, not row state.

CREATE OR REPLACE FUNCTION public.auth_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p.id
  FROM public.profiles p
  WHERE p.auth_id = current_setting('request.jwt.claim.sub', true)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.auth_profile_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_profile_id() TO PUBLIC;
