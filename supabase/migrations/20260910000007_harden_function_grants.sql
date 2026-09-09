-- ==============================================================================
-- Function grants (Supabase linter 0028 / 0029). SECURITY DEFINER helpers are
-- for policies and triggers, not the public RPC surface: anon may call none of
-- them, and the auth-user trigger is callable by nobody but its trigger owner.
-- ==============================================================================

REVOKE EXECUTE ON FUNCTION public.current_role_name() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_staff() FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_client_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_officer_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.job_client_id(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.officer_on_job(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.next_quote_number() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_quote_number() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_job_number() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_invoice_number() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reserve_invoice_sequence(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.next_quote_number() TO authenticated, service_role;
