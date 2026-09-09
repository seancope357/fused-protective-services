-- ==============================================================================
-- Staff access requires a second factor, enforced in the database.
-- is_staff() — the predicate every staff policy uses — is true only when the
-- session is at assurance level aal2 (password + TOTP). A staff user who has
-- not enrolled yet keeps aal1 access until they do, which is what lets them
-- reach the enrollment page; the proxy sends them there and nowhere else.
-- Once a verified factor exists, a password-only session sees nothing.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.has_verified_mfa()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM auth.mfa_factors
        WHERE user_id = auth.uid() AND status = 'verified'
    );
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT COALESCE(
        (SELECT role IN ('owner', 'staff') FROM public.profiles WHERE id = auth.uid()),
        false
    )
    AND (
        NOT public.has_verified_mfa()
        OR COALESCE(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    );
$$;

REVOKE ALL ON FUNCTION public.has_verified_mfa() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_verified_mfa() TO authenticated, service_role;
